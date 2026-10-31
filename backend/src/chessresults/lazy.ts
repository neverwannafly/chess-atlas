import { CrClient, CrHttpError } from "./client.js";
import { parsePlayerCardFull } from "./parse.js";
import * as store from "../db/chessresults.js";
import { cooldownRemainingMs, noteHealthy, noteRateLimited } from "./guard.js";

// On-request refresh of a player's results. Nothing here runs on list pages. A request for a player
// queues one background refresh of that player's event cards (newest first, capped). The response does
// not wait for it; the next request shows the newer results.
//  - one request at a time through a single paced client (min 3 s apart, see client.ts)
//  - a player is refreshed at most once per debounce window, so repeated page loads do not repeat the work
//  - a 429 or 503 stops the refresh and starts the rest period (guard.ts)

const DEBOUNCE_MS = Number(process.env.CR_PLAYER_REFRESH_DEBOUNCE_MS ?? 60_000);
const MAX_EVENTS = Number(process.env.CR_PLAYER_MAX_EVENTS ?? 40);

const client = new CrClient();
const lastRequested = new Map<number, number>();
const pending: number[] = [];
let pumping = false;

export interface RefreshStatus {
  queued: boolean;
  reason: string | null;
}

export function requestPlayerRefresh(playerId: number, nowMs = Date.now()): RefreshStatus {
  if (cooldownRemainingMs(nowMs) > 0) return { queued: false, reason: "resting after rate limit" };
  const last = lastRequested.get(playerId);
  if (last !== undefined && nowMs - last < DEBOUNCE_MS) return { queued: false, reason: "refreshed recently" };
  if (pending.includes(playerId)) return { queued: false, reason: "already queued" };
  lastRequested.set(playerId, nowMs);
  pending.push(playerId);
  void pump();
  return { queued: true, reason: null };
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    while (pending.length) {
      const playerId = pending.shift()!;
      await refreshPlayer(playerId);
    }
  } finally {
    pumping = false;
  }
}

async function refreshPlayer(playerId: number): Promise<void> {
  for (const e of store.playerEntries(playerId, MAX_EVENTS)) {
    if (cooldownRemainingMs() > 0) return;
    const now = Date.now();
    let html: string;
    try {
      html = await client.get(`tnr${e.tournamentId}.aspx?lan=1&art=9&snr=${e.snr}`);
    } catch (err) {
      if (err instanceof CrHttpError && (err.status === 429 || err.status === 503 || err.status === 403)) {
        noteRateLimited();
        return;
      }
      store.markCardFailed(e.tournamentId, e.snr, now);
      continue;
    }
    const card = parsePlayerCardFull(html);
    store.saveIdentCard(playerId, card, now);
    store.saveCardResults(playerId, e.tournamentId, e.snr, card.rounds, now);
    noteHealthy();
  }
}
