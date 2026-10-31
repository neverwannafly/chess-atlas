import { CrClient, CrHttpError } from "./client.js";
import { LEASE_MS, refreshLeased } from "./cycle.js";
import * as store from "../db/chessresults.js";
import { cooldownRemainingMs, noteRateLimited } from "./guard.js";

// On-request live refresh for ongoing tournaments. Opening a tournament page calls this:
//  - only ongoing tournaments are refreshed, and only when our last fetch is at least LIVE_STALE_MS old
//  - one refresh per tournament at a time in this process, and a lease in the database across processes
//    (so the worker and a page view never write the same tournament at once)
//  - the response waits a short time for the refresh and returns; if it is still running the page polls

export const LIVE_STALE_MS = Number(process.env.CR_LIVE_STALE_MS ?? 5 * 60_000);
export const LIVE_WAIT_MS = Number(process.env.CR_LIVE_WAIT_MS ?? 8_000);

export type LiveState = "fresh" | "updated" | "in_progress" | "skipped";

const client = new CrClient();
const inFlight = new Map<string, Promise<LiveState>>();

export interface LiveStart {
  state: LiveState;
  reason: string | null;
  promise: Promise<LiveState> | null;
}

export function startLiveRefresh(id: string, nowMs = Date.now()): LiveStart {
  const row = store.getTournamentRow(id);
  if (!row) return { state: "skipped", reason: "not mirrored", promise: null };
  if (row.status !== "ongoing") return { state: "fresh", reason: "not ongoing", promise: null };
  if (row.lastFetchedAtMs !== null && nowMs - row.lastFetchedAtMs < LIVE_STALE_MS) {
    return { state: "fresh", reason: "refreshed recently", promise: null };
  }
  if (cooldownRemainingMs(nowMs) > 0) return { state: "skipped", reason: "resting after rate limit", promise: null };

  const running = inFlight.get(id);
  if (running) return { state: "in_progress", reason: null, promise: running };

  const promise = refreshLeased(id, (path) => client.get(path))
    .then((r): LiveState => (r === "done" ? "updated" : "in_progress"))
    .catch((err: unknown): LiveState => {
      if (err instanceof CrHttpError && (err.status === 429 || err.status === 503 || err.status === 403)) noteRateLimited();
      console.warn(`[live] ${id} refresh failed: ${(err as Error).message}`);
      return "skipped";
    })
    .finally(() => inFlight.delete(id));
  inFlight.set(id, promise);
  return { state: "in_progress", reason: null, promise };
}

/** Waits up to LIVE_WAIT_MS for a started refresh and reports where it got to. */
export async function settleLiveRefresh(start: LiveStart): Promise<LiveState> {
  if (!start.promise) return start.state;
  let settled: LiveState | null = null;
  start.promise.then((s) => (settled = s));
  await Promise.race([start.promise, new Promise((r) => setTimeout(r, LIVE_WAIT_MS))]);
  return settled ?? "in_progress";
}
