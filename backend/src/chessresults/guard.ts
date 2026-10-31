import { getMeta, setMeta } from "../db/events.js";

// Rate-limit guard shared by the cycle and the Ident job. When chess-results answers 429 or 503 we rest:
// 15 minutes after the first, doubling each time, capped at 2 hours. A clean run resets the streak.

const COOLDOWN_KEY = "chessresults.cooldownUntil";
const STREAK_KEY = "chessresults.rateLimitStreak";
const BASE_MS = 15 * 60_000;
const MAX_MS = 2 * 3600_000;

export function cooldownRemainingMs(nowMs = Date.now()): number {
  const until = Number(getMeta(COOLDOWN_KEY) ?? 0);
  return Math.max(0, until - nowMs);
}

export function noteRateLimited(nowMs = Date.now()): number {
  const streak = Number(getMeta(STREAK_KEY) ?? 0) + 1;
  const wait = Math.min(MAX_MS, BASE_MS * 2 ** (streak - 1));
  setMeta(STREAK_KEY, String(streak));
  setMeta(COOLDOWN_KEY, String(nowMs + wait));
  console.warn(`[chessresults] rate limited; resting ${Math.round(wait / 60_000)} min (streak ${streak})`);
  return wait;
}

export function noteHealthy(): void {
  if (getMeta(STREAK_KEY)) setMeta(STREAK_KEY, "0");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
