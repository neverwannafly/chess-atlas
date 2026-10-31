export const CR_BASE = "https://chess-results.com/";

const DEFAULT_UA = "ChessAtlasBot/1.0 (India chess directory)";

export class CrHttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

/**
 * Polite, single-connection fetcher for chess-results.com.
 * - one request at a time, at least `minIntervalMs` apart (default 3s)
 * - backs off on 429/5xx, gives up immediately on 403 (the caller should stop the whole cycle)
 * - identifies itself with CHESSRESULTS_USER_AGENT so the operator can reach us
 */
export class CrClient {
  /** Final URL (after redirects) of the most recent successful request. */
  lastUrl: string | null = null;
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private minIntervalMs = Number(process.env.CR_MIN_INTERVAL_MS ?? 3000),
    private userAgent = process.env.CHESSRESULTS_USER_AGENT ?? DEFAULT_UA,
  ) {}

  /** `path` is relative to CR_BASE, e.g. "tnr1531024.aspx?lan=1&art=2&rd=1". */
  get(path: string, attempts = 3): Promise<string> {
    const run = this.chain.then(() => this.fetchWithRetry(path, attempts));
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Form POST (ASP.NET postback). Same politeness and retry rules as `get`. */
  post(path: string, form: URLSearchParams, attempts = 3): Promise<string> {
    const run = this.chain.then(() => this.fetchWithRetry(path, attempts, form));
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async fetchWithRetry(path: string, attempts: number, form?: URLSearchParams): Promise<string> {
    const url = new URL(path, CR_BASE).toString();
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      const wait = this.last + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      try {
        const res = await fetch(url, {
          method: form ? "POST" : "GET",
          body: form,
          headers: {
            "User-Agent": this.userAgent,
            Accept: "text/html",
            "Accept-Language": "en;q=0.8",
            ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
          },
          signal: AbortSignal.timeout(30_000),
        });
        if (res.status === 403) throw new CrHttpError(403, url);
        if (res.status === 429 || res.status >= 500) throw new CrHttpError(res.status, url);
        if (!res.ok) throw new CrHttpError(res.status, url);
        this.lastUrl = res.url || url;
        return await res.text();
      } catch (err) {
        lastErr = err;
        if (err instanceof CrHttpError && err.status === 403) throw err;
        if (i < attempts - 1) {
          const retryAfter = err instanceof CrHttpError && err.status === 429 ? 60_000 : 2_000 * 2 ** i;
          await sleep(retryAfter);
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
