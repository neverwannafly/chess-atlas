import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const MIN_TEXT_CHARS = 200;
/** Image-heavy brochures often keep a thin text layer (URLs, event codes) that hides the content. */
export const MIN_CHARS_PER_PAGE = 200;
const UA = "Mozilla/5.0 (compatible; ChessAtlasBot/1.0; +https://chessatlas.app)";

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfError";
  }
}

export interface PdfResult {
  bytes: Buffer;
  sha256: string;
  text: string;
  pages: number;
}

/** Convert Google Drive share links to direct-download links. */
export function normalizeUrl(url: string): string {
  const u = url.trim();
  const m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ?? u.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return u.replace(/ /g, "%20");
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

async function fetchOnce(url: string, timeoutMs: number): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/pdf,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status >= 400) {
    const e = new PdfError(`HTTP ${res.status}`);
    (e as any).retryable = res.status >= 500 || res.status === 429;
    throw e;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  if (buf.subarray(0, 1024).includes("%PDF")) return buf;
  // Google Drive virus-scan interstitial for larger files
  if (/text\/html/.test(ct) && url.includes("drive.google.com")) {
    const html = buf.toString("utf8");
    const action = html.match(/action="([^"]*download[^"]*)"/)?.[1]?.replace(/&amp;/g, "&");
    if (action) {
      const params = [...html.matchAll(/name="(\w+)"\s+value="([^"]*)"/g)].map((x) => `${x[1]}=${encodeURIComponent(x[2])}`);
      const next = action + (action.includes("?") ? "&" : "?") + params.join("&");
      return fetchOnce(next, timeoutMs);
    }
    throw new PdfError("not a pdf (google drive page, not publicly downloadable)");
  }
  if (/^image\//.test(ct)) throw new PdfError(`not a pdf (image: ${ct})`);
  if (/html/.test(ct)) throw new PdfError("not a pdf (html page)");
  throw new PdfError(`not a pdf (content-type ${ct || "unknown"})`);
}

export async function downloadPdf(rawUrl: string, opts: { retries?: number; timeoutMs?: number } = {}): Promise<Buffer> {
  const { retries = 3, timeoutMs = 60_000 } = opts;
  const url = normalizeUrl(rawUrl);
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchOnce(url, timeoutMs);
    } catch (e) {
      last = e;
      if (e instanceof PdfError && (e as any).retryable !== true) throw e;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  if (last instanceof PdfError) throw last;
  throw new PdfError(`download failed: ${(last as Error)?.message ?? last}`);
}

export async function extractText(bytes: Buffer): Promise<{ text: string; pages: number }> {
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer, o?: any) => Promise<{ text: string; numpages: number }>;
  // pdf.js is chatty on stderr/console for malformed fonts; silence while parsing.
  const origWarn = console.warn;
  const origLog = console.log;
  console.warn = () => {};
  console.log = () => {};
  try {
    const out = await pdfParse(bytes);
    // strip control chars (NUL etc. from odd font encodings): they can't be passed in argv to agy
    const text = out.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return { text, pages: out.numpages };
  } catch (e) {
    throw new PdfError(`pdf parse error: ${(e as Error).message}`);
  } finally {
    console.warn = origWarn;
    console.log = origLog;
  }
}

/** Parse bytes already in hand: verifies magic, hashes, extracts text. Throws PdfError("scanned/no text") when empty. */
export async function processPdfBytes(bytes: Buffer): Promise<PdfResult> {
  if (!bytes.subarray(0, 1024).includes("%PDF")) throw new PdfError("not a pdf");
  const hash = sha256(bytes);
  const { text, pages } = await extractText(bytes);
  const dense = text.replace(/\s+/g, " ").trim().length;
  if (dense < MIN_TEXT_CHARS || dense / Math.max(1, pages) < MIN_CHARS_PER_PAGE) {
    throw Object.assign(new PdfError("scanned/no text"), { sha256: hash });
  }
  return { bytes, sha256: hash, text, pages };
}
