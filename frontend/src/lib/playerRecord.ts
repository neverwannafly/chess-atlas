// Pure helpers for the player page: per-event round tables, running scores, opponents and head to head.
// No imports, so the node test runner can load this file directly (see playerRecord.test.ts).

export interface ResultRow {
  tournamentId: string;
  tournament: string;
  startDate: string | null;
  endDate: string | null;
  snr: number;
  round: number;
  board: number | null;
  opponentSnr: number | null;
  opponentPlayerId: number | null;
  opponentName: string | null;
  opponentFideId: string | null;
  opponentRating: number | null;
  opponentFed: string | null;
  opponentTitle?: string | null;
  color: "w" | "b" | null;
  /** From this player's side: "1", "½", "0", "+" / "-" (forfeit), or null/"" while unplayed. */
  result: string | null;
  fetchedAtMs: number | null;
  source?: "card" | "pairings";
}

export interface EntryRow {
  tournamentId: string;
  tournament: string;
  startDate: string | null;
  endDate: string | null;
  status: "ongoing" | "upcoming" | "finished";
  snr: number | null;
  rating: number | null;
  rank: number | null;
  points: number | null;
}

/** Points a result is worth to this player; null when it is not (yet) a scored game. */
export function scoreOf(result: string | null | undefined): number | null {
  if (result == null) return null;
  const r = result.replace(/\s+/g, "").replace(/[Kk]$/, "");
  if (r === "") return null;
  if (r === "1" || r === "+" || r === "-1" || r === "1-0") return 1;
  if (r === "½" || r === "0.5" || r === "1/2" || r === "-½") return 0.5;
  if (r === "0" || r === "-" || r === "-0") return 0;
  return null;
}

/** "1", "½", "0" as printed; forfeits read "1F" / "0F"; anything unknown is shown as given. */
export function resultLabel(result: string | null | undefined): string {
  if (result == null || result.trim() === "") return "";
  const forfeit = /^[+-]$/.test(result.trim()) || /K$/i.test(result.trim());
  const s = scoreOf(result);
  if (s === null) return result.trim();
  const base = s === 1 ? "1" : s === 0.5 ? "½" : "0";
  return forfeit ? `${base}F` : base;
}

export const isForfeit = (result: string | null | undefined) => !!result && (/^[+-]$/.test(result.trim()) || /K$/i.test(result.trim()));

export interface RoundLine extends ResultRow {
  score: number | null;
  /** Points after this round; null until the round is scored. */
  running: number | null;
}

export interface EventRecord extends Omit<EntryRow, "snr"> {
  snr: number | null;
  rounds: RoundLine[];
  played: number;
  scored: number;
  lastFetchedAtMs: number | null;
}

/** Adds the running score to one event's rounds (sorted by round). */
export function withRunning(rows: ResultRow[]): RoundLine[] {
  let total = 0;
  return [...rows]
    .sort((a, b) => a.round - b.round)
    .map((r) => {
      const score = scoreOf(r.result);
      if (score !== null) total += score;
      return { ...r, score, running: score === null ? null : total };
    });
}

/**
 * One record per event, in the entries' order (newest first), with that event's rounds attached.
 * Events that appear only in the results are added in the results' order.
 */
export function groupEvents(entries: EntryRow[], results: ResultRow[]): EventRecord[] {
  const byEvent = new Map<string, ResultRow[]>();
  for (const r of results) byEvent.set(r.tournamentId, [...(byEvent.get(r.tournamentId) ?? []), r]);
  const out: EventRecord[] = [];
  const seen = new Set<string>();
  const build = (e: EntryRow, rows: ResultRow[]): EventRecord => {
    const rounds = withRunning(rows);
    const scoredRows = rounds.filter((r) => r.score !== null);
    const times = rows.map((r) => r.fetchedAtMs ?? 0).filter((t) => t > 0);
    return {
      ...e,
      rounds,
      played: scoredRows.length,
      scored: scoredRows.reduce((s, r) => s + (r.score ?? 0), 0),
      lastFetchedAtMs: times.length ? Math.max(...times) : null,
    };
  };
  for (const e of entries) {
    if (seen.has(e.tournamentId)) continue;
    seen.add(e.tournamentId);
    out.push(build(e, byEvent.get(e.tournamentId) ?? []));
  }
  for (const [id, rows] of byEvent) {
    if (seen.has(id)) continue;
    seen.add(id);
    const f = rows[0];
    out.push(build({ tournamentId: id, tournament: f.tournament, startDate: f.startDate, endDate: f.endDate, status: "finished", snr: f.snr, rating: null, rank: null, points: null }, rows));
  }
  return out;
}

export interface OpponentSummary {
  playerId: number;
  name: string;
  fed: string | null;
  rating: number | null;
  title: string | null;
  games: number;
  score: number;
  wins: number;
  draws: number;
  losses: number;
  /** Newest event in which they met (results are newest first). */
  lastTournament: string;
}

/**
 * Distinct opponents with games played (scored rounds only), score against them and W/D/L.
 * Sorted by games, then score, then name. Rounds without a linked opponent are left out.
 */
export function opponents(results: ResultRow[]): OpponentSummary[] {
  const m = new Map<number, OpponentSummary>();
  for (const r of results) {
    const s = scoreOf(r.result);
    if (r.opponentPlayerId == null || s === null) continue;
    let o = m.get(r.opponentPlayerId);
    if (!o) {
      o = { playerId: r.opponentPlayerId, name: r.opponentName ?? "Unknown player", fed: r.opponentFed, rating: r.opponentRating, title: r.opponentTitle ?? null, games: 0, score: 0, wins: 0, draws: 0, losses: 0, lastTournament: r.tournament };
      m.set(r.opponentPlayerId, o);
    }
    o.games += 1;
    o.score += s;
    if (s === 1) o.wins += 1;
    else if (s === 0.5) o.draws += 1;
    else o.losses += 1;
  }
  return [...m.values()].sort((a, b) => b.games - a.games || b.score - a.score || a.name.localeCompare(b.name));
}

/** Games against one opponent, newest event first, then by round. */
export function headToHead(results: ResultRow[], opponentId: number): RoundLine[] {
  return results
    .filter((r) => r.opponentPlayerId === opponentId)
    .map((r) => ({ ...r, score: scoreOf(r.result), running: null }));
}

/** Latest fetch time across all rows, or null. */
export function lastRefreshed(results: ResultRow[]): number | null {
  let t = 0;
  for (const r of results) if (r.fetchedAtMs && r.fetchedAtMs > t) t = r.fetchedAtMs;
  return t || null;
}

/**
 * How long to wait before re-reading the player while a background refresh may still be running.
 * Polls every `everyMs` while the server says the refresh is running, or until `untilMs` after it
 * said one was queued. The cap stays under the server's 60-second debounce, so polling never queues
 * a second refresh. Returns false to stop.
 */
export function refreshPollDelay(state: string | null | undefined, untilMs: number | null, nowMs: number, everyMs = 5_000): number | false {
  if (state === "in_progress") return everyMs;
  if (untilMs != null && nowMs < untilMs) return everyMs;
  return false;
}
