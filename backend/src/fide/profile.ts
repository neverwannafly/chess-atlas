import db from "../db/database.js";
import { parseFideStatistics } from "./statistics.js";

// On-request import of a player's FIDE monthly history from the public profile statistics page.
// Only for a player who is being viewed, at most once a week per player, one request at a time, at least
// 3 seconds apart. The official monthly list stays authoritative: a period already stored is not replaced.

const STALE_MS = 7 * 24 * 3600_000;
const DEBOUNCE_MS = 60_000;
const MIN_INTERVAL_MS = 3_000;
const USER_AGENT = "ChessAtlasBot/1.0 (India chess directory)";

const lastRequested = new Map<number, number>();
const pending: { playerId: number; fideId: string }[] = [];
let pumping = false;
let lastCall = 0;

export function requestFideProfile(playerId: number, fideId: string | null, nowMs = Date.now()): "queued" | "fresh" | "skipped" {
  if (!fideId) return "skipped";
  const row = db.prepare("SELECT fideStatsFetchedAtMs FROM players WHERE id = ?").get(playerId) as { fideStatsFetchedAtMs: number | null } | undefined;
  if (row?.fideStatsFetchedAtMs && nowMs - row.fideStatsFetchedAtMs < STALE_MS) return "fresh";
  const last = lastRequested.get(playerId);
  if (last !== undefined && nowMs - last < DEBOUNCE_MS) return "skipped";
  if (pending.some((p) => p.playerId === playerId)) return "skipped";
  lastRequested.set(playerId, nowMs);
  pending.push({ playerId, fideId });
  void pump();
  return "queued";
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (pending.length) {
      const job = pending.shift()!;
      await importProfile(job.playerId, job.fideId);
    }
  } finally {
    pumping = false;
  }
}

async function importProfile(playerId: number, fideId: string): Promise<void> {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  try {
    const res = await fetch(`https://ratings.fide.com/profile/${encodeURIComponent(fideId)}/statistics`, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = parseFideStatistics(await res.text());
    const now = Date.now();
    const ins = db.prepare(
      `INSERT INTO fide_ratings (playerId, list, period, rating, games, k, source, fetchedAtMs)
       VALUES (?, ?, ?, ?, ?, NULL, 'fide-profile', ?)
       ON CONFLICT(playerId, list, period) DO NOTHING`,
    );
    db.transaction(() => {
      for (const r of rows) ins.run(playerId, r.list, r.period, r.rating, r.games, now);
      db.prepare("UPDATE players SET fideStatsFetchedAtMs = ? WHERE id = ?").run(now, playerId);
    })();
  } catch (err) {
    console.warn(`[fide-profile] ${fideId}: ${(err as Error).message}`);
    // Mark the attempt so the same profile is not retried on every page view.
    db.prepare("UPDATE players SET fideStatsFetchedAtMs = ? WHERE id = ?").run(Date.now(), playerId);
  }
}
