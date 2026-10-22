#!/usr/bin/env tsx
/**
 * Extraction worker. See README.md.
 *   tsx src/extraction/worker.ts [--api URL] [--token T] [--limit N] [--concurrency N] [--force]
 *        [--model M] [--event CODE] [--dry-run] [--out DIR] [--url PDF_URL ...]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrochureExtraction, ExtractionSubmission, QueueItem } from "../types/event.js";
import { DEFAULT_MODEL, runAgy } from "./agy.js";
import { PdfError, downloadPdf, processPdfBytes, sha256 } from "./pdf.js";
import { buildPrompt } from "./prompt.js";
import { brochureExtractionSchema, normalizeExtraction } from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const PROMPT_VERSION = "v2"; // bump to invalidate cached LLM results

interface Opts {
  api: string;
  token: string;
  limit: number;
  concurrency: number;
  force: boolean;
  model: string;
  event: string | null;
  dryRun: boolean;
  out: string;
  urls: string[];
}

function parseArgs(argv: string[]): Opts {
  const o: Opts = {
    api: process.env.CHESSATLAS_API_URL || "http://localhost:8080",
    token: process.env.ADMIN_TOKEN || "",
    limit: 20,
    concurrency: 3,
    force: false,
    model: DEFAULT_MODEL,
    event: null,
    dryRun: false,
    out: resolve(here, "../../data/extraction-cache"),
    urls: [],
  };
  const need = (i: number) => {
    if (i >= argv.length) throw new Error(`missing value for ${argv[i - 1]}`);
    return argv[i];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--api") o.api = need(++i);
    else if (a === "--token") o.token = need(++i);
    else if (a === "--limit") o.limit = parseInt(need(++i), 10);
    else if (a === "--concurrency") o.concurrency = Math.max(1, parseInt(need(++i), 10));
    else if (a === "--force") o.force = true;
    else if (a === "--model") o.model = need(++i);
    else if (a === "--event") o.event = need(++i);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--out") o.out = resolve(need(++i));
    else if (a === "--url") o.urls.push(...need(++i).split(",").filter(Boolean));
    else if (a === "--help" || a === "-h") {
      console.log("usage: tsx src/extraction/worker.ts [--api URL] [--token T] [--limit N] [--concurrency N] [--force] [--model M] [--event CODE] [--dry-run] [--out DIR] [--url PDF_URL]");
      process.exit(0);
    } else throw new Error(`unknown argument ${a}`);
  }
  o.api = o.api.replace(/\/+$/, "");
  return o;
}

const ts = () => new Date().toISOString().slice(11, 19);
const log = (m: string) => console.error(`[${ts()}] ${m}`);

interface Cached {
  model: string;
  promptVersion: string;
  extraction: BrochureExtraction;
}

export interface ExtractOutcome {
  extraction: BrochureExtraction;
  sourceHash: string;
  cached: boolean;
  tokens: number;
  seconds: number;
  mode: "text" | "ocr";
}

function formatIssues(err: import("zod").ZodError): string {
  return err.issues.slice(0, 20).map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

/** download → text → agy → validate (one repair retry) */
export async function extractBrochure(
  url: string,
  ctx: { name?: string; startDate?: string },
  o: Pick<Opts, "model" | "out">,
): Promise<ExtractOutcome> {
  mkdirSync(o.out, { recursive: true });
  const bytes = await downloadPdf(url);
  const hash = sha256(bytes);
  const pdfPath = join(o.out, `${hash}.pdf`);
  const resPath = join(o.out, `${hash}.json`);
  if (!existsSync(pdfPath)) writeFileSync(pdfPath, bytes);

  if (existsSync(resPath)) {
    try {
      const c = JSON.parse(readFileSync(resPath, "utf8")) as Cached;
      if (c.model === o.model && c.promptVersion === PROMPT_VERSION) {
        return { extraction: c.extraction, sourceHash: hash, cached: true, tokens: 0, seconds: 0, mode: "text" };
      }
    } catch {}
  }

  let text: string | null = null;
  let mode: "text" | "ocr" = "text";
  try {
    text = (await processPdfBytes(bytes)).text;
  } catch (e) {
    if (e instanceof PdfError && e.message === "scanned/no text") mode = "ocr";
    else throw e;
  }

  let tokens = 0;
  let seconds = 0;
  let errors: string | undefined;
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildPrompt(text, ctx, { pdfFile: mode === "ocr" ? "brochure.pdf" : undefined, errors });
    const r = await runAgy(prompt, { model: o.model, pdfBytes: mode === "ocr" ? bytes : undefined, timeoutSec: mode === "ocr" ? 600 : 420 });
    tokens += r.tokens;
    seconds += r.seconds;
    const parsed = brochureExtractionSchema.safeParse(normalizeExtraction(r.output));
    if (parsed.success) {
      const extraction = parsed.data as BrochureExtraction;
      writeFileSync(resPath, JSON.stringify({ model: o.model, promptVersion: PROMPT_VERSION, extraction } satisfies Cached, null, 2));
      return { extraction, sourceHash: hash, cached: false, tokens, seconds, mode };
    }
    errors = formatIssues(parsed.error);
    lastErr = errors;
  }
  throw new Error(`validation failed after retry: ${lastErr.replace(/\n/g, "; ").slice(0, 300)}`);
}

async function api(o: Opts, method: string, path: string, body?: unknown, tries = 5): Promise<any> {
  const res = await fetch(o.api + path, {
    method,
    headers: { Authorization: `Bearer ${o.token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const txt = await res.text();
  // admin API is rate limited per minute; cached replays can outrun it
  if (res.status === 429 && tries > 1) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 10, 70);
    await new Promise((r) => setTimeout(r, wait * 1000 + Math.random() * 1000));
    return api(o, method, path, body, tries - 1);
  }
  if (!res.ok) throw new Error(`${method} ${path} -> HTTP ${res.status} ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

async function main() {
  let o: Opts;
  try {
    o = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`config error: ${(e as Error).message}`);
    process.exit(2);
  }

  let queue: QueueItem[];
  const direct = o.urls.length > 0;
  if (direct) {
    queue = o.urls.map((u, i) => ({ eventCode: `url-${i + 1}`, name: u.split("/").pop() ?? u, brochureUrl: u, startDate: "", attempts: 0 }));
    o.dryRun = true; // no API involved
  } else {
    if (!o.token) {
      console.error("config error: ADMIN_TOKEN (or --token) is required to read the queue");
      process.exit(2);
    }
    try {
      const q = await api(o, "GET", `/api/admin/extraction-queue?limit=${o.limit}&force=${o.force}`);
      queue = q.data as QueueItem[];
    } catch (e) {
      console.error(`config error: cannot fetch queue from ${o.api}: ${(e as Error).message}`);
      process.exit(2);
    }
    if (o.event) queue = queue.filter((x) => x.eventCode === o.event);
    queue = queue.slice(0, o.limit);
  }

  log(`${queue.length} item(s) · model=${o.model} · concurrency=${o.concurrency}${o.dryRun ? " · dry-run" : ""}`);
  const stat = { ok: 0, failed: 0, skipped: 0, tokens: 0, seconds: 0, llmRuns: 0 };
  const failures: string[] = [];

  await pool(queue, o.concurrency, async (item, i) => {
    const tag = `(${i + 1}/${queue.length}) ${item.eventCode}`;
    try {
      const r = await extractBrochure(item.brochureUrl, { name: item.name, startDate: item.startDate || undefined }, o);
      stat.tokens += r.tokens;
      if (!r.cached) {
        stat.seconds += r.seconds;
        stat.llmRuns++;
      }
      if (o.dryRun) {
        console.log(JSON.stringify({ eventCode: item.eventCode, url: item.brochureUrl, sourceHash: r.sourceHash, mode: r.mode, extraction: r.extraction }, null, 2));
      } else {
        const body: ExtractionSubmission = { extraction: r.extraction, model: o.model, sourceHash: r.sourceHash };
        await api(o, "PUT", `/api/admin/events/${encodeURIComponent(item.eventCode)}/extraction`, body);
      }
      if (r.cached) stat.skipped++;
      else stat.ok++;
      log(`${tag} ${r.cached ? "cached" : "ok"} ${r.cached ? "" : `(${r.mode}, ${r.seconds.toFixed(0)}s, ${r.tokens} tok)`} ${item.name}`);
    } catch (e) {
      const reason = ((e as Error).message || String(e)).slice(0, 300);
      stat.failed++;
      failures.push(`${item.eventCode}: ${reason}`);
      log(`${tag} FAILED: ${reason}`);
      if (!o.dryRun) {
        try {
          await api(o, "POST", `/api/admin/events/${encodeURIComponent(item.eventCode)}/extraction-failure`, { error: reason });
        } catch (e2) {
          log(`${tag} could not report failure: ${(e2 as Error).message}`);
        }
      }
    }
  });

  log(
    `done: ok=${stat.ok} cached=${stat.skipped} failed=${stat.failed} · agy tokens=${stat.tokens} · avg ${stat.llmRuns ? (stat.seconds / stat.llmRuns).toFixed(0) : 0}s/brochure`,
  );
  for (const f of failures) log(`  failed ${f}`);
}

// run only when executed directly
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`fatal: ${(e as Error).stack || e}`);
    process.exit(1);
  });
}
