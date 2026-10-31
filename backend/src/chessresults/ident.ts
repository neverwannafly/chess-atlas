import { CrClient, CrHttpError } from "./client.js";
import { parsePlayerCard } from "./parse.js";
import * as store from "../db/chessresults.js";
import { noteHealthy, noteRateLimited, sleep } from "./guard.js";

// Ident-Number job. Fetches the player card (art=9) for players whose Ident-Number is unknown.
//  - `concurrency` clients run in parallel, each still spaced by its own minimum interval.
//  - work goes out in batches; after each batch the job pauses so the load stays low.
//  - a 429 or 503 stops the job and starts the rest period (see guard.ts).

export const IDENT_PER_CYCLE = Number(process.env.CR_IDENT_PER_CYCLE ?? 150);
export const IDENT_CONCURRENCY = Number(process.env.CR_IDENT_CONCURRENCY ?? 2);
export const IDENT_BATCH = Number(process.env.CR_IDENT_BATCH ?? 10);
export const IDENT_BATCH_PAUSE_MS = Number(process.env.CR_IDENT_BATCH_PAUSE_MS ?? 20_000);
const RECHECK_AFTER_MS = 30 * 24 * 3600_000;

export interface IdentStats {
  attempted: number;
  found: number;
  noIdent: number;
  errors: number;
  rateLimited: boolean;
}

export async function runIdentJob(limit = IDENT_PER_CYCLE, clients?: CrClient[]): Promise<IdentStats> {
  const stats: IdentStats = { attempted: 0, found: 0, noIdent: 0, errors: 0, rateLimited: false };
  const pool = clients ?? Array.from({ length: IDENT_CONCURRENCY }, () => new CrClient());
  const queue = store.identCandidates(limit, Date.now(), RECHECK_AFTER_MS);
  let stop = false;

  const one = async (client: CrClient, c: store.IdentCandidate) => {
    if (stop) return;
    const url = `tnr${c.tournamentId}.aspx?lan=1&art=9&fed=${encodeURIComponent(c.fed)}&snr=${c.snr}`;
    try {
      const card = parsePlayerCard(await client.get(url));
      const now = Date.now();
      stats.attempted++;
      if (card.identNumber) stats.found++;
      else stats.noIdent++;
      store.saveIdentCard(c.playerId, card, now);
      noteHealthy();
    } catch (err) {
      if (err instanceof CrHttpError && (err.status === 429 || err.status === 503 || err.status === 403)) {
        stop = true;
        stats.rateLimited = true;
        noteRateLimited();
        return;
      }
      stats.errors++;
      store.markIdentChecked(c.playerId, Date.now()); // do not retry the same card in a tight loop
    }
  };

  for (let i = 0; i < queue.length && !stop; i += IDENT_BATCH) {
    const batch = queue.slice(i, i + IDENT_BATCH);
    // Deal the batch across the clients so they run in parallel.
    const lanes = pool.map((client, lane) => (async () => {
      for (let j = lane; j < batch.length; j += pool.length) await one(client, batch[j]);
    })());
    await Promise.all(lanes);
    if (!stop && i + IDENT_BATCH < queue.length) await sleep(IDENT_BATCH_PAUSE_MS);
  }
  return stats;
}
