import { CrClient, CrHttpError } from "./client.js";
import { parseList, parseRanking, parseRound, parseStartingRank, parseTournamentPage, type TournamentPage } from "./parse.js";
import * as store from "../db/chessresults.js";
import { addDays, todayIST } from "../lib/dates.js";
import { getMeta, setMeta } from "../db/events.js";
import { fetchIndiaArchive } from "./archive.js";
import { cooldownRemainingMs, noteHealthy, noteRateLimited } from "./guard.js";
import { runIdentJob } from "./ident.js";

// One refresh cycle, run every 30 minutes by the worker:
//   1. read the home page and the India federation page (two requests) and record what is listed
//   2. once a day, run the India archive search (older tournaments), if an archive function is wired in
//   3. refresh every tournament that is due:
//        ongoing   -> every 30 minutes until its end date
//        upcoming  -> once a day
//        finished  -> one final pass, then never again (unless the list shows a new update)
// Each cycle has a request budget, so a large first backfill is spread over several cycles.

export const REQUESTS_PER_CYCLE = Number(process.env.CR_REQUESTS_PER_CYCLE ?? 300);
const MAX_CONSECUTIVE_ERRORS = 5;
const PROBE_ROUNDS = 30; // pages that omit "Rd.x/y" are probed until the first empty round
const ONGOING_MS = 30 * 60_000;
const UPCOMING_MS = 24 * 3600_000;
const ARCHIVE_EVERY_MS = 24 * 3600_000;
const ARCHIVE_FROM = process.env.CR_ARCHIVE_FROM ?? "2024-01-01";
const FED_PAGE = "fed.aspx?lan=1&fed=IND";

// Archive sweep: one window of ARCHIVE_WINDOW_DAYS per cycle, walking backwards from the newest date
// to ARCHIVE_FROM, then wrapping. A full sweep takes many cycles, which keeps each cycle short.
const ARCHIVE_WINDOW_DAYS = 90;
const ARCHIVE_CURSOR_KEY = "chessresults.archiveCursor";

export interface CycleStats {
  skipped: boolean;
  identFetched?: number;
  listed: number;
  archived: number;
  due: number;
  refreshed: number;
  requests: number;
  errors: number;
  stoppedReason: string | null;
  finishedAt: string;
}

let running = false;
class OutOfBudget extends Error {}

export async function runCycle(client = new CrClient(), budget = REQUESTS_PER_CYCLE): Promise<CycleStats> {
  const blank = (over: Partial<CycleStats>): CycleStats => ({
    skipped: false, listed: 0, archived: 0, due: 0, refreshed: 0, requests: 0, errors: 0,
    stoppedReason: null, finishedAt: new Date().toISOString(), ...over,
  });
  if (running) return blank({ skipped: true, stoppedReason: "already running" });
  const resting = cooldownRemainingMs();
  if (resting > 0) return blank({ skipped: true, stoppedReason: `resting after rate limit for ${Math.ceil(resting / 60_000)} more min` });
  running = true;
  const startedAt = Date.now();
  const stats = blank({});
  let left = budget;
  const get = async (path: string) => {
    if (left <= 0) throw new OutOfBudget();
    left--;
    stats.requests++;
    return client.get(path);
  };

  try {
    const now = Date.now();

    // 1. listings
    const home = parseList(await get(""));
    if (home.length === 0) throw new Error("home page parsed to zero tournaments; layout may have changed");
    store.upsertListed(home, now, "home", null);
    try {
      const fed = parseList(await get(FED_PAGE));
      store.upsertListed(fed, now, "federation", "IND");
    } catch (err) {
      if (err instanceof OutOfBudget) throw err;
      stats.errors++;
      console.warn(`[chessresults] federation page failed: ${(err as Error).message}`);
    }
    stats.listed = home.length;
    store.closeStaleListings(now);

    // 2. one archive window per cycle (older tournaments; see ARCHIVE_WINDOW_DAYS)
    const archStart = Date.now();
    try {
      const newest = addDays(todayIST(new Date(now)), 7);
      const cursor = getMeta(ARCHIVE_CURSOR_KEY) ?? newest;
      const to = cursor < ARCHIVE_FROM ? newest : cursor;
      const from = addDays(to, -ARCHIVE_WINDOW_DAYS) < ARCHIVE_FROM ? ARCHIVE_FROM : addDays(to, -ARCHIVE_WINDOW_DAYS);
      const rows = await fetchIndiaArchive({ from, to, client });
      stats.archived = store.upsertArchive(rows, Date.now());
      setMeta(ARCHIVE_CURSOR_KEY, from <= ARCHIVE_FROM ? "0000-00-00" : addDays(from, -1));
      store.recordSyncRun("archive", archStart, { requests: 0, errors: 0, outcome: "ok", detail: `${from}..${to} rows=${rows.length}` });
    } catch (err) {
      stats.errors++;
      store.recordSyncRun("archive", archStart, { requests: 0, errors: 1, outcome: "error", detail: (err as Error).message });
      console.warn(`[chessresults] archive window failed: ${(err as Error).message}`);
    }

    // 3. due refreshes (old finished events are retired from polling first)
    store.retireOldFinished(Date.now(), store.FETCH_FINISHED_DAYS);
    const due = store.dueTournaments(Date.now(), 1000);
    stats.due = due.length;
    let consecutive = 0;
    for (const id of due) {
      try {
        await refreshTournament(id, get);
        stats.refreshed++;
        consecutive = 0;
      } catch (err) {
        if (err instanceof OutOfBudget) {
          stats.stoppedReason = "request budget used";
          break;
        }
        if (err instanceof CrHttpError && err.status === 403) {
          stats.stoppedReason = "403 from chess-results.com; stopped and not retrying";
          break;
        }
        if (err instanceof CrHttpError && (err.status === 429 || err.status === 503)) {
          noteRateLimited();
          stats.stoppedReason = `HTTP ${err.status}; resting before the next cycle`;
          break;
        }
        stats.errors++;
        consecutive++;
        store.markError(id, (err as Error).message, Date.now());
        console.warn(`[chessresults] ${id} failed: ${(err as Error).message}`);
        if (consecutive >= MAX_CONSECUTIVE_ERRORS) {
          stats.stoppedReason = "too many consecutive errors";
          break;
        }
      }
    }
    // 4. Ident-Number cards, in their own job with their own pacing (see ident.ts)
    if (!stats.stoppedReason || stats.stoppedReason === "request budget used") {
      const ident = await runIdentJob();
      stats.identFetched = ident.attempted;
      if (ident.rateLimited) stats.stoppedReason = stats.stoppedReason ?? "ident job rate limited; resting";
      else noteHealthy();
    }
  } catch (err) {
    if (err instanceof OutOfBudget) stats.stoppedReason = "request budget used";
    else {
      stats.stoppedReason = (err as Error).message;
      stats.errors++;
      console.warn(`[chessresults] cycle failed: ${(err as Error).message}`);
    }
  } finally {
    running = false;
    stats.finishedAt = new Date().toISOString();
    store.recordSyncRun("cycle", startedAt, { requests: stats.requests, errors: stats.errors, outcome: stats.stoppedReason ?? "ok" });
  }
  return stats;
}

/** Status from dates when we have them; otherwise from whether the list still shows recent updates. */
export function deriveStatus(row: { startDate: string | null; endDate: string | null; listedUpdatedAtMs: number | null }, nowMs: number): store.Status {
  const today = todayIST(new Date(nowMs));
  if (row.startDate && row.endDate) {
    if (today < row.startDate) return "upcoming";
    if (today > row.endDate) return "finished";
    return "ongoing";
  }
  return row.listedUpdatedAtMs && nowMs - row.listedUpdatedAtMs < 24 * 3600_000 ? "ongoing" : "finished";
}

export function nextFetchFor(status: store.Status, nowMs: number): number | null {
  if (status === "ongoing") return nowMs + ONGOING_MS;
  if (status === "upcoming") return nowMs + UPCOMING_MS;
  return null; // finished: the final pass is recorded by the caller
}

async function refreshTournament(id: string, get: (path: string) => Promise<string>): Promise<void> {
  const base = `tnr${id}.aspx?lan=1`;
  const mainHtml = await get(base);
  const page: TournamentPage = parseTournamentPage(mainHtml);
  const nowMs = Date.now();
  store.replaceStartingRank(id, parseStartingRank(mainHtml), nowMs);

  // Unchanged since our last pass (same "Last update" stamp, already backfilled): skip the standings
  // and round requests. This is the common case for ongoing events between uploads.
  const before = store.getTournamentRow(id);
  const unchanged = !!before && before.backfilled === 1 && before.sourceUpdatedAtMs !== null && page.lastUpdateMs === before.sourceUpdatedAtMs;
  if (unchanged) {
    const status = deriveStatus(before, nowMs);
    store.markFetched(id, nowMs, page, status, nextFetchFor(status, nowMs), status === "finished");
    return;
  }

  const standings = parseRanking(await get(`${base}&art=1`));
  store.replaceStandings(id, standings, nowMs);

  // First full pass walks rounds from 1; later passes start at the last stored round.
  // Stop at the first round with no pairings: later rounds are not played yet.
  const state = store.roundState(id);
  const total = page.rounds ?? PROBE_ROUNDS;
  let round = state.backfilled ? Math.max(1, state.maxRound) : 1;
  for (; round <= total; round++) {
    const games = parseRound(await get(`${base}&art=2&rd=${round}`));
    if (games.length === 0) break;
    store.replaceRound(id, round, games, Date.now());
  }

  const row = store.getTournamentRow(id);
  const status = row ? deriveStatus(row, Date.now()) : "ongoing";
  const finalPass = status === "finished";
  store.markFetched(id, Date.now(), page, status, nextFetchFor(status, Date.now()), finalPass);
}

export function lastCycleSummary() {
  return store.lastSyncRun("cycle");
}
