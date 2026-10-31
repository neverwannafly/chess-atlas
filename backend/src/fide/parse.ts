// Pure mappers from FIDE chart-data JSON (a_chart_data.phtml) to typed objects.

export interface FideRatingPoint {
  /** Rating period as YYYY-MM, e.g. "2026-01". */
  period: string;
  standard: number | null;
  rapid: number | null;
  blitz: number | null;
  standardGames: number | null;
  rapidGames: number | null;
  blitzGames: number | null;
}

export interface FideRatingHistory {
  fideId: string;
  name: string | null;
  federation: string | null;
  points: FideRatingPoint[];
}

/** Limited profile derived from the history endpoint (no title/K/sex/birth year available as JSON). */
export interface FidePlayerProfile {
  fideId: string;
  name: string | null;
  federation: string | null;
  period: string | null;
  standard: number | null;
  rapid: number | null;
  blitz: number | null;
  title: null;
  kFactor: null;
  sex: null;
  birthYear: null;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

export function parseRating(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function parseGames(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

/** "2026-Jan" -> "2026-01"; null when unrecognised. */
export function parsePeriod(v: unknown): string | null {
  const m = /^(\d{4})-([A-Za-z]{3})/.exec(String(v ?? "").trim());
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  return mm ? `${m[1]}-${mm}` : null;
}

function str(v: unknown): string | null {
  const s = typeof v === "string" ? v.replace(/^﻿/, "").trim() : "";
  return s === "" ? null : s;
}

export function parseRatingHistory(fideId: string, raw: unknown): FideRatingHistory | null {
  if (!Array.isArray(raw)) return null;
  const points: FideRatingPoint[] = [];
  let name: string | null = null;
  let federation: string | null = null;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const period = parsePeriod(r.date_2);
    if (!period) continue;
    name = str(r.name) ?? name;
    federation = str(r.country) ?? federation;
    points.push({
      period,
      standard: parseRating(r.rating),
      rapid: parseRating(r.rapid_rtng),
      blitz: parseRating(r.blitz_rtng),
      standardGames: parseGames(r.period_games),
      rapidGames: parseGames(r.rapid_games),
      blitzGames: parseGames(r.blitz_games),
    });
  }
  points.sort((a, b) => a.period.localeCompare(b.period));
  return { fideId, name, federation, points };
}

export function profileFromHistory(h: FideRatingHistory): FidePlayerProfile | null {
  const last = h.points[h.points.length - 1];
  if (!last) return null;
  return {
    fideId: h.fideId,
    name: h.name,
    federation: h.federation,
    period: last.period,
    standard: last.standard,
    rapid: last.rapid,
    blitz: last.blitz,
    title: null,
    kFactor: null,
    sex: null,
    birthYear: null,
  };
}
