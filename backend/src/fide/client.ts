import {
  parseRatingHistory,
  profileFromHistory,
  type FidePlayerProfile,
  type FideRatingHistory,
} from "./parse.js";

export type { FidePlayerProfile, FideRatingHistory, FideRatingPoint } from "./parse.js";

const BASE = "https://ratings.fide.com";
const UA = "ChessAtlasBot/1.0 (India chess directory)";
const MIN_GAP_MS = 2000;
const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FideClient {
  private last = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly minGapMs = MIN_GAP_MS) {}

  /** Serialised, rate-limited GET returning parsed JSON, or null on any failure. */
  private getJson(path: string, referer: string): Promise<unknown | null> {
    const run = async () => {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const wait = this.last + this.minGapMs - Date.now();
        if (wait > 0) await sleep(wait);
        this.last = Date.now();
        try {
          const res = await fetch(BASE + path, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: {
              "User-Agent": UA,
              Accept: "application/json",
              "X-Requested-With": "XMLHttpRequest",
              Referer: referer,
            },
          });
          if (res.status === 429 || res.status >= 500) {
            await sleep(2000 * 2 ** attempt);
            continue;
          }
          if (!res.ok) return null;
          const text = (await res.text()).replace(/^﻿/, "").trim();
          if (!text.startsWith("[") && !text.startsWith("{")) return null;
          try {
            return JSON.parse(text) as unknown;
          } catch {
            return null;
          }
        } catch {
          await sleep(2000 * 2 ** attempt);
        }
      }
      return null;
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  /** period=1 is the only value verified live (returns the current-year monthly series). */
  async getPlayerRatingHistory(fideId: string, period = 1): Promise<FideRatingHistory | null> {
    if (!/^\d{5,9}$/.test(fideId)) return null;
    const raw = await this.getJson(
      `/a_chart_data.phtml?event=${fideId}&period=${period}`,
      `${BASE}/profile/${fideId}`,
    );
    return parseRatingHistory(fideId, raw);
  }

  /** Latest ratings derived from history; title/K/sex/birth year are not exposed as JSON. */
  async getPlayerProfile(fideId: string): Promise<FidePlayerProfile | null> {
    const h = await this.getPlayerRatingHistory(fideId);
    return h ? profileFromHistory(h) : null;
  }
}

const shared = new FideClient();
export const getPlayerRatingHistory = (fideId: string, period = 1) =>
  shared.getPlayerRatingHistory(fideId, period);
export const getPlayerProfile = (fideId: string) => shared.getPlayerProfile(fideId);
// listIndianPlayers intentionally absent: no JSON federation listing exists (see docs/FIDE.md).
