import db from "./database.js";
import { parsePlace } from "../lib/place.js";
import { addDays, todayIST } from "../lib/dates.js";

/** Earliest date we accept from the archive (the archive window starts in 2024; older rows are kept without dates). */
const ARCHIVE_EARLIEST = "2000-01-01";

/** Finished tournaments are fetched (results, final pass) only this long after they end. */
export const FETCH_FINISHED_DAYS = Number(process.env.CR_FETCH_FINISHED_DAYS ?? 180);
import type { CardRound, GameRow, ListRow, StandingRow, StartingRankRow, TournamentPage } from "../chessresults/parse.js";
import { fideHash } from "./privacy.js";

// Storage for the chess-results mirror, in normalised form. Each fact lives in one table:
// players, clubs, locations and federations are referenced by id. Timestamps are epoch ms.
// Dates are YYYY-MM-DD in IST.

export const MAX_ERRORS = 5;
const UNKNOWN_FED = "UNK";

export type Status = "upcoming" | "ongoing" | "finished";

export interface TournamentRow {
  id: string;
  name: string;
  federationCode: string;
  locationRaw: string | null;
  startDate: string | null;
  endDate: string | null;
  timeControl: string | null;
  rounds: number | null;
  status: Status;
  listMarker: string | null;
  discoveredVia: string;
  sourceUpdatedAtMs: number | null;
  listedUpdatedAtMs: number | null;
  lastFetchedAtMs: number | null;
  nextFetchAtMs: number | null;
  finalFetchedAtMs: number | null;
  backfilled: number;
  errorCount: number;
  fetchError: string | null;
  currentRound: number | null;
}

const T_COLS = `t.id, t.name, t.federationCode, l.raw AS locationRaw, t.startDate, t.endDate, t.timeControl, t.rounds,
  t.status, t.listMarker, t.discoveredVia, t.sourceUpdatedAtMs, t.listedUpdatedAtMs, t.lastFetchedAtMs,
  t.nextFetchAtMs, t.finalFetchedAtMs, t.backfilled, t.errorCount, t.fetchError,
  (SELECT MAX(r.round) FROM rounds r WHERE r.tournamentId = t.id) AS currentRound`;

// ---- lookups -------------------------------------------------------------------------------

export function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ensureFederation(code: string | null): string {
  const c = code && /^[A-Z]{3}$/.test(code) ? code : UNKNOWN_FED;
  db.prepare("INSERT OR IGNORE INTO federations (code, name) VALUES (?, NULL)").run(c);
  return c;
}

function locationId(raw: string | null): number | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const existing = db.prepare("SELECT id FROM locations WHERE raw = ?").get(clean) as { id: number } | undefined;
  if (existing) return existing.id;
  const p = parsePlace(clean);
  return Number(db.prepare("INSERT INTO locations (raw, city, state, countryCode) VALUES (?, ?, ?, 'IND')").run(clean, p.city, p.state).lastInsertRowid);
}

function clubId(name: string | null): number | null {
  if (!name || !name.trim()) return null;
  const clean = name.replace(/\s+/g, " ").trim();
  db.prepare("INSERT OR IGNORE INTO clubs (name) VALUES (?)").run(clean);
  return (db.prepare("SELECT id FROM clubs WHERE name = ?").get(clean) as { id: number }).id;
}

/**
 * Finds or creates a player. A FIDE id is the only key that links players. Without one, every
 * tournament entry gets its own player row, so people can appear twice (see docs/DECISIONS.md).
 * Erased FIDE ids resolve to their anonymous replacement and never get their name back.
 */
export function resolvePlayer(args: { name: string; fed: string | null; fideId: string | null; fideSource?: "starting" | "card"; nowMs: number }): number {
  const code = ensureFederation(args.fed);
  const name = args.name.replace(/\s+/g, " ").trim();
  if (args.fideId) {
    const erased = db.prepare("SELECT anonPlayerId FROM suppressed_fide_ids WHERE fideHash = ?").get(fideHash(args.fideId)) as { anonPlayerId: number } | undefined;
    if (erased) return erased.anonPlayerId;
    const hit = db.prepare("SELECT id, federationCode FROM players WHERE fideId = ?").get(args.fideId) as { id: number; federationCode: string } | undefined;
    if (hit) {
      db.prepare("UPDATE players SET name = ?, nameKey = ?, federationCode = CASE WHEN federationCode = 'UNK' THEN ? ELSE federationCode END, updatedAtMs = ? WHERE id = ?")
        .run(name, normaliseName(name), code, args.nowMs, hit.id);
      return hit.id;
    }
    return Number(
      db.prepare("INSERT INTO players (fideId, fideIdSource, name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(args.fideId, args.fideSource ?? "starting", name, normaliseName(name), code, args.nowMs, args.nowMs).lastInsertRowid,
    );
  }
  return Number(
    db.prepare("INSERT INTO players (name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES (?, ?, ?, ?, ?)")
      .run(name, normaliseName(name), code, args.nowMs, args.nowMs).lastInsertRowid,
  );
}

/**
 * The player behind one start number in one tournament. Without a FIDE id, an existing entry keeps
 * its player; no name matching is done. Erased entries stay anonymous.
 */
export function entryPlayer(tournamentId: string, snr: number, args: { name: string; fed: string | null; fideId: string | null; nowMs: number }): number {
  const erased = db.prepare("SELECT anonPlayerId FROM suppressed_entries WHERE tournamentId = ? AND snr = ?").get(tournamentId, snr) as { anonPlayerId: number } | undefined;
  if (erased) return erased.anonPlayerId;
  if (!args.fideId) {
    const existing = db.prepare("SELECT playerId FROM tournament_entries WHERE tournamentId = ? AND snr = ?").get(tournamentId, snr) as { playerId: number } | undefined;
    if (existing) return existing.playerId;
  }
  return resolvePlayer(args);
}

// ---- tournaments ---------------------------------------------------------------------------

export interface ArchiveTournament {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  timeControl: string | null;
}

/** Records the list-page view of a tournament (home or federation page). */
export function upsertListed(rows: ListRow[], nowMs: number, via: "home" | "federation", fed: string | null): void {
  const insert = db.prepare(`
    INSERT INTO tournaments (id, name, federationCode, status, listMarker, discoveredVia, listedUpdatedAtMs, listedAtMs, nextFetchAtMs, createdAtMs, updatedAtMs)
    VALUES (@id, @name, @fed, 'ongoing', @marker, @via, @est, @now, @now, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      listMarker = excluded.listMarker,
      listedUpdatedAtMs = excluded.listedUpdatedAtMs,
      listedAtMs = excluded.listedAtMs,
      nextFetchAtMs = CASE
        WHEN tournaments.nextFetchAtMs IS NULL AND excluded.listedUpdatedAtMs IS NOT NULL
             AND (tournaments.finalFetchedAtMs IS NULL OR excluded.listedUpdatedAtMs > tournaments.finalFetchedAtMs)
          THEN excluded.nextFetchAtMs
        ELSE tournaments.nextFetchAtMs END,
      federationCode = CASE WHEN tournaments.federationCode = 'UNK' THEN excluded.federationCode ELSE tournaments.federationCode END,
      updatedAtMs = excluded.updatedAtMs
  `);
  db.transaction(() => {
    for (const r of rows) {
      const est = r.minutesAgo === null ? null : Math.round(nowMs - r.minutesAgo * 60_000);
      insert.run({ id: r.id, name: r.name, fed: ensureFederation(r.fed ?? fed), marker: r.status, via, est, now: nowMs });
    }
  })();
}

/**
 * Tournaments with no end date that have dropped off the list are treated as finished, so they get a
 * final pass and stop being polled. Dated tournaments follow their dates instead.
 */
export function closeStaleListings(nowMs: number): void {
  db.prepare(
    `UPDATE tournaments SET status = 'finished',
       nextFetchAtMs = CASE WHEN finalFetchedAtMs IS NULL THEN @now ELSE NULL END,
       updatedAtMs = @now
     WHERE endDate IS NULL AND status <> 'finished' AND listedAtMs < @cut`,
  ).run({ now: nowMs, cut: nowMs - 36 * 3600_000 });
}

/**
 * Finished tournaments older than `keepDays` keep their archive row but are not fetched again.
 * Called each cycle, so it also covers rows written before the limit was set.
 */
export function retireOldFinished(nowMs: number, keepDays: number): number {
  const cutoff = addDays(todayIST(new Date(nowMs)), -keepDays);
  return db.prepare(
    `UPDATE tournaments SET nextFetchAtMs = NULL, updatedAtMs = @now
     WHERE status = 'finished' AND endDate IS NOT NULL AND endDate < @cutoff
       AND nextFetchAtMs IS NOT NULL`,
  ).run({ now: nowMs, cutoff }).changes + 0;
}

/** Records an archive row. Status comes from the dates; existing tournaments only gain missing facts. */
export function upsertArchive(rows: ArchiveTournament[], nowMs: number): number {
  const today = todayIST(new Date(nowMs));
  const stmt = db.prepare(`
    INSERT INTO tournaments (id, name, federationCode, locationId, startDate, endDate, timeControl, status, discoveredVia, nextFetchAtMs, createdAtMs, updatedAtMs)
    VALUES (@id, @name, 'IND', @loc, @start, @end, @tc, @status, 'archive', @next, @now, @now)
    ON CONFLICT(id) DO UPDATE SET
      startDate = COALESCE(tournaments.startDate, excluded.startDate),
      endDate = COALESCE(tournaments.endDate, excluded.endDate),
      locationId = COALESCE(tournaments.locationId, excluded.locationId),
      timeControl = COALESCE(tournaments.timeControl, excluded.timeControl),
      updatedAtMs = excluded.updatedAtMs
  `);
  let n = 0;
  db.transaction(() => {
    for (const r of rows) {
      // Dates from the source are sanity-checked: a start before the archive window or after the end is dropped.
      const start = r.startDate && r.startDate >= ARCHIVE_EARLIEST && (!r.endDate || r.startDate <= r.endDate) ? r.startDate : null;
      const end = r.endDate && r.endDate >= ARCHIVE_EARLIEST && (!start || r.endDate >= start) ? r.endDate : null;
      const status: Status = !start || !end ? "finished" : today < start ? "upcoming" : today > end ? "finished" : "ongoing";
      const next = status === "finished" ? nowMs : status === "upcoming" ? nowMs + 24 * 3600_000 : nowMs + 30 * 60_000;
      const retired = status === "finished" && end !== null && end < addDays(today, -FETCH_FINISHED_DAYS);
      stmt.run({ id: r.id, name: r.name, loc: locationId(r.location), start, end, tc: r.timeControl, status, next: retired ? null : next, now: nowMs });
      n++;
    }
  })();
  return n;
}

/** Stores the main-page facts and, when known, the schedule that follows from the status. */
export function markFetched(id: string, nowMs: number, page: TournamentPage, status: Status, nextFetchAtMs: number | null, finalPass: boolean): void {
  db.prepare(
    `UPDATE tournaments SET
       name = @name,
       rounds = COALESCE(@rounds, rounds),
       sourceUpdatedAtMs = COALESCE(@src, sourceUpdatedAtMs),
       status = @status,
       lastFetchedAtMs = @now,
       nextFetchAtMs = @next,
       finalFetchedAtMs = CASE WHEN @final = 1 THEN @now ELSE finalFetchedAtMs END,
       backfilled = CASE WHEN @final = 1 OR backfilled = 1 THEN 1 ELSE backfilled END,
       errorCount = 0,
       fetchError = NULL,
       updatedAtMs = @now
     WHERE id = @id`,
  ).run({
    id,
    name: page.name,
    rounds: page.rounds,
    src: page.lastUpdateMs,
    status,
    now: nowMs,
    next: nextFetchAtMs,
    final: finalPass ? 1 : 0,
  });
}

export function markError(id: string, message: string, nowMs: number): void {
  db.prepare("UPDATE tournaments SET errorCount = errorCount + 1, fetchError = ?, lastFetchedAtMs = ?, updatedAtMs = ? WHERE id = ?")
    .run(message.slice(0, 500), nowMs, nowMs, id);
}

export function setStatus(id: string, status: Status, nextFetchAtMs: number | null, nowMs: number): void {
  db.prepare("UPDATE tournaments SET status = ?, nextFetchAtMs = ?, updatedAtMs = ? WHERE id = ?").run(status, nextFetchAtMs, nowMs, id);
}

/** Tournaments whose next fetch is due, most urgent first. */
export function dueTournaments(nowMs: number, limit: number): string[] {
  return (
    db.prepare(
      `SELECT id FROM tournaments
       WHERE nextFetchAtMs IS NOT NULL AND nextFetchAtMs <= @now AND errorCount < @maxErr
       ORDER BY
         CASE status WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
         nextFetchAtMs ASC
       LIMIT @limit`,
    ).all({ now: nowMs, maxErr: MAX_ERRORS, limit }) as { id: string }[]
  ).map((r) => r.id);
}

/** Finished tournaments that still have no backfill (no rounds walked yet). */
export function backfillQueue(limit: number): string[] {
  return (
    db.prepare("SELECT id FROM tournaments WHERE backfilled = 0 AND errorCount < @maxErr ORDER BY nextFetchAtMs ASC LIMIT @limit")
      .all({ maxErr: MAX_ERRORS, limit }) as { id: string }[]
  ).map((r) => r.id);
}

export function getTournamentRow(id: string): TournamentRow | undefined {
  return db.prepare(`SELECT ${T_COLS} FROM tournaments t LEFT JOIN locations l ON l.id = t.locationId WHERE t.id = ?`).get(id) as TournamentRow | undefined;
}

export function listTournaments(opts: { status?: Status; fed?: string; q?: string; limit: number; offset: number }) {
  const where: string[] = [];
  const params: Record<string, string | number> = { limit: opts.limit, offset: opts.offset };
  if (opts.status) { where.push("t.status = @status"); params.status = opts.status; }
  if (opts.fed) { where.push("t.federationCode = @fed"); params.fed = opts.fed.toUpperCase(); }
  if (opts.q) { where.push("t.name LIKE @q"); params.q = `%${opts.q.replace(/[%_]/g, "")}%`; }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM tournaments t ${w}`).get(params) as { n: number }).n;
  const rows = db
    .prepare(
      `SELECT ${T_COLS} FROM tournaments t LEFT JOIN locations l ON l.id = t.locationId ${w}
       ORDER BY CASE t.status WHEN 'ongoing' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
                COALESCE(t.startDate, '9999') ASC, t.name
       LIMIT @limit OFFSET @offset`,
    )
    .all(params) as TournamentRow[];
  return { rows, total };
}

// ---- standings, rounds, games --------------------------------------------------------------

/** Starting list from the tournament page: the only place the FIDE id is printed for each entry. */
export function replaceStartingRank(id: string, rows: StartingRankRow[], nowMs: number): void {
  db.transaction(() => {
    for (const r of rows) {
      const player = entryPlayer(id, r.snr, { name: r.name, fed: r.fed, fideId: r.fideId, nowMs });
      if (r.identNumber) {
        db.prepare("UPDATE players SET identNumber = ?, identSource = 'starting' WHERE id = ? AND identSource IS NULL").run(r.identNumber, player);
      }
      upsertEntry(id, r.snr, player, r.rating, clubId(r.club));
    }
  })();
}

function upsertEntry(id: string, snr: number, playerId: number, rating: number | null, club: number | null): void {
  db.prepare(`
    INSERT INTO tournament_entries (tournamentId, snr, playerId, ratingAtEvent, clubId)
    VALUES (@id, @snr, @player, @rating, @club)
    ON CONFLICT(tournamentId, snr) DO UPDATE SET
      playerId = excluded.playerId,
      ratingAtEvent = COALESCE(excluded.ratingAtEvent, tournament_entries.ratingAtEvent),
      clubId = COALESCE(excluded.clubId, tournament_entries.clubId)`)
    .run({ id, snr, player: playerId, rating, club });
}

/** Replaces the standings of one tournament. */
export function replaceStandings(id: string, rows: StandingRow[], nowMs: number): void {
  const standing = db.prepare("INSERT INTO standings (tournamentId, snr, rank, points) VALUES (?, ?, ?, ?)");
  const tb = db.prepare("INSERT INTO standing_tiebreaks (tournamentId, snr, position, value) VALUES (?, ?, ?, ?)");
  db.transaction(() => {
    db.prepare("DELETE FROM standings WHERE tournamentId = ?").run(id);
    db.prepare("DELETE FROM standing_tiebreaks WHERE tournamentId = ?").run(id);
    for (const r of rows) {
      const player = entryPlayer(id, r.snr, { name: r.name, fed: r.fed, fideId: null, nowMs });
      upsertEntry(id, r.snr, player, r.rating, clubId(r.club));
      standing.run(id, r.snr, r.rank, r.points);
      r.tiebreaks.forEach((v, i) => tb.run(id, r.snr, i + 1, v));
    }
  })();
}

export function roundState(id: string): { maxRound: number; backfilled: boolean } {
  const row = db
    .prepare(
      `SELECT COALESCE((SELECT MAX(round) FROM rounds WHERE tournamentId = @id), 0) AS maxRound,
              COALESCE((SELECT backfilled FROM tournaments WHERE id = @id), 0) AS backfilled`,
    )
    .get({ id }) as { maxRound: number; backfilled: number };
  return { maxRound: row.maxRound, backfilled: row.backfilled === 1 };
}

/** Replaces one round. Entries seen only on the pairings page are created as well. */
export function replaceRound(id: string, round: number, games: GameRow[], nowMs: number): void {
  const game = db.prepare(
    "INSERT INTO games (tournamentId, round, match, board, whiteSnr, blackSnr, result) VALUES (@id, @round, @match, @board, @w, @b, @result)",
  );
  db.transaction(() => {
    db.prepare("DELETE FROM games WHERE tournamentId = ? AND round = ?").run(id, round);
    db.prepare("INSERT INTO rounds (tournamentId, round, fetchedAtMs) VALUES (?, ?, ?) ON CONFLICT(tournamentId, round) DO UPDATE SET fetchedAtMs = excluded.fetchedAtMs")
      .run(id, round, nowMs);
    for (const g of games) {
      if (g.whiteSnr === null || g.blackSnr === null) continue;
      const w = entryPlayer(id, g.whiteSnr, { name: g.whiteName, fed: g.whiteFed, fideId: null, nowMs });
      const b = entryPlayer(id, g.blackSnr, { name: g.blackName, fed: g.blackFed, fideId: null, nowMs });
      upsertEntry(id, g.whiteSnr, w, g.whiteRating, null);
      upsertEntry(id, g.blackSnr, b, g.blackRating, null);
      game.run({ id, round, match: g.match, board: g.board, w: g.whiteSnr, b: g.blackSnr, result: g.result });
    }
  })();
}

// A FIDE id is returned only when verified (decision 16). A removed player (privacy erasure) keeps the
// row so pairings still add up, but gets no player id, so no page links to it.
const VERIFIED_FIDE = (a: string) => `CASE WHEN ${a}.fideIdSource IN ('list','card') THEN ${a}.fideId END`;
const PLAYER_ID = (a: string) => `CASE WHEN ${a}.nameKey <> 'removed' THEN ${a}.id END`;

export function getStandings(id: string, limit: number) {
  const rows = db
    .prepare(
      `SELECT s.snr, s.rank, s.points, ${PLAYER_ID("p")} AS playerId, p.name, ${VERIFIED_FIDE("p")} AS fideId, p.federationCode AS fed,
              f.title, e.ratingAtEvent AS rating, c.name AS club
       FROM standings s
       JOIN tournament_entries e ON e.tournamentId = s.tournamentId AND e.snr = s.snr
       JOIN players p ON p.id = e.playerId
       LEFT JOIN fide_profiles f ON f.playerId = p.id
       LEFT JOIN clubs c ON c.id = e.clubId
       WHERE s.tournamentId = ? ORDER BY s.rank, s.snr LIMIT ?`,
    )
    .all(id, limit) as Record<string, unknown>[];
  const tbs = db
    .prepare("SELECT snr, position, value FROM standing_tiebreaks WHERE tournamentId = ? ORDER BY snr, position")
    .all(id) as { snr: number; position: number; value: number | null }[];
  return rows.map((r) => ({ ...r, tiebreaks: tbs.filter((t) => t.snr === r.snr).map((t) => t.value) }));
}

export function getRounds(id: string) {
  return db
    .prepare(
      `SELECT r.round, COUNT(g.board) AS games, SUM(CASE WHEN g.result IS NOT NULL THEN 1 ELSE 0 END) AS played
       FROM rounds r LEFT JOIN games g ON g.tournamentId = r.tournamentId AND g.round = r.round
       WHERE r.tournamentId = ? GROUP BY r.round ORDER BY r.round`,
    )
    .all(id);
}

export function getRoundGames(id: string, round: number) {
  return db
    .prepare(
      `SELECT g.match, g.board, g.result,
              g.whiteSnr, ${PLAYER_ID("pw")} AS whitePlayerId, pw.name AS whiteName, ${VERIFIED_FIDE("pw")} AS whiteFideId,
              ew.ratingAtEvent AS whiteRating, pw.federationCode AS whiteFed,
              g.blackSnr, ${PLAYER_ID("pb")} AS blackPlayerId, pb.name AS blackName, ${VERIFIED_FIDE("pb")} AS blackFideId,
              eb.ratingAtEvent AS blackRating, pb.federationCode AS blackFed
       FROM games g
       JOIN tournament_entries ew ON ew.tournamentId = g.tournamentId AND ew.snr = g.whiteSnr
       JOIN players pw ON pw.id = ew.playerId
       JOIN tournament_entries eb ON eb.tournamentId = g.tournamentId AND eb.snr = g.blackSnr
       JOIN players pb ON pb.id = eb.playerId
       WHERE g.tournamentId = ? AND g.round = ? ORDER BY g.match, g.board`,
    )
    .all(id, round);
}

export function mirrorStats() {
  return db
    .prepare(
      `SELECT COUNT(*) AS tournaments,
              SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing,
              SUM(CASE WHEN status = 'upcoming' THEN 1 ELSE 0 END) AS upcoming,
              SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished,
              SUM(CASE WHEN backfilled = 1 THEN 1 ELSE 0 END) AS backfilled,
              SUM(CASE WHEN errorCount >= ${MAX_ERRORS} THEN 1 ELSE 0 END) AS parked,
              (SELECT COUNT(*) FROM players) AS players,
              MAX(lastFetchedAtMs) AS lastFetchedAtMs
       FROM tournaments`,
    )
    .get() as Record<string, number | null>;
}

export function recordSyncRun(kind: "cycle" | "archive", startedAtMs: number, stats: { requests: number; errors: number; outcome: string | null; detail?: string }) {
  db.prepare("INSERT INTO sync_runs (kind, startedAtMs, finishedAtMs, requests, errors, outcome, detail) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(kind, startedAtMs, Date.now(), stats.requests, stats.errors, stats.outcome, stats.detail ?? null);
}

export function lastSyncRun(kind: "cycle" | "archive") {
  return db.prepare("SELECT * FROM sync_runs WHERE kind = ? ORDER BY id DESC LIMIT 1").get(kind) as
    | { startedAtMs: number; finishedAtMs: number; requests: number; errors: number; outcome: string | null; detail: string | null }
    | undefined;
}

// ---- player cards (Ident-Number) ------------------------------------------------------------

export interface IdentCandidate {
  playerId: number;
  tournamentId: string;
  snr: number;
  fed: string;
}

/**
 * Players whose Ident-Number is unknown, one entry each, least recently checked first.
 * Erased (anonymous) players are never fetched.
 */
export function identCandidates(limit: number, nowMs: number, recheckAfterMs: number): IdentCandidate[] {
  return db
    .prepare(
      `SELECT p.id AS playerId, e.tournamentId, e.snr, p.federationCode AS fed
       FROM players p
       JOIN tournament_entries e ON e.playerId = p.id
       JOIN tournaments t ON t.id = e.tournamentId
       WHERE (p.identSource IS NULL OR p.identSource <> 'card') AND p.nameKey <> 'removed'
         AND (t.status <> 'finished' OR t.endDate >= @recent)
         AND (p.identCheckedAtMs IS NULL OR p.identCheckedAtMs < @before)
         AND e.rowid = (SELECT MIN(e2.rowid) FROM tournament_entries e2 WHERE e2.playerId = p.id)
       ORDER BY (p.identCheckedAtMs IS NULL) DESC, p.identCheckedAtMs ASC
       LIMIT @limit`,
    )
    .all({ before: nowMs - recheckAfterMs, limit, recent: addDays(todayIST(new Date(nowMs)), -FETCH_FINISHED_DAYS) }) as IdentCandidate[];
}

/**
 * Stores what the player card showed. The card is authoritative for this player's Ident-Number and
 * FIDE id. A FIDE id already held by another record is not moved: the duplicate stays separate.
 */
export function saveIdentCard(playerId: number, card: { identNumber: string | null; fideId: string | null; birthYear?: number | null }, nowMs: number): void {
  db.transaction(() => {
    if (card.birthYear) {
      db.prepare("UPDATE players SET birthYear = ?, birthYearSource = 'card' WHERE id = ?").run(card.birthYear, playerId);
    }
    if (card.identNumber) {
      db.prepare("UPDATE players SET identNumber = ?, identSource = 'card' WHERE id = ?").run(card.identNumber, playerId);
    }
    const own = db.prepare("SELECT fideId, fideIdSource FROM players WHERE id = ?").get(playerId) as { fideId: string | null; fideIdSource: string | null };
    if (card.fideId) {
      const taken = db.prepare("SELECT id FROM players WHERE fideId = ? AND id <> ?").get(card.fideId, playerId);
      const erased = db.prepare("SELECT 1 FROM suppressed_fide_ids WHERE fideHash = ?").get(fideHash(card.fideId));
      if (!taken && !erased) {
        const onList = db.prepare("SELECT 1 FROM fide_profiles WHERE fideId = ?").get(card.fideId);
        db.prepare("UPDATE players SET fideId = ?, fideIdSource = ? WHERE id = ?").run(card.fideId, onList ? "list" : "card", playerId);
      }
    } else if (own.fideIdSource === "starting" || own.fideIdSource === null) {
      // The card shows no FIDE id: an unverified value is dropped. A value from the official list stays.
      db.prepare("UPDATE players SET fideId = NULL, fideIdSource = NULL WHERE id = ?").run(playerId);
    }
    db.prepare("UPDATE players SET identCheckedAtMs = ?, updatedAtMs = ? WHERE id = ?").run(nowMs, nowMs, playerId);
  })();
}

export function markIdentChecked(playerId: number, nowMs: number): void {
  db.prepare("UPDATE players SET identCheckedAtMs = ? WHERE id = ?").run(nowMs, playerId);
}

/** Records that a player card was fetched, even when it had no Ident-Number, so it is not re-fetched at once. */
export function identStats() {
  return db.prepare(
    `SELECT COUNT(*) AS players, SUM(CASE WHEN identNumber IS NOT NULL THEN 1 ELSE 0 END) AS withIdent,
            SUM(CASE WHEN identCheckedAtMs IS NOT NULL THEN 1 ELSE 0 END) AS checked
     FROM players WHERE nameKey <> 'removed'`,
  ).get() as { players: number; withIdent: number | null; checked: number | null };
}

// ---- player results (from player cards, fetched on request) --------------------------------

export interface EntryToRefresh {
  tournamentId: string;
  snr: number;
}

/** A player's events, most recent first. Only events that have a start number are listed. */
export function playerEntries(playerId: number, limit: number): EntryToRefresh[] {
  return db.prepare(
    `SELECT e.tournamentId, e.snr FROM tournament_entries e
     LEFT JOIN tournaments t ON t.id = e.tournamentId
     WHERE e.playerId = ? ORDER BY COALESCE(t.startDate, '0000') DESC LIMIT ?`,
  ).all(playerId, limit) as EntryToRefresh[];
}

/** Stores one event's card results for a player and marks that event as fetched. */
export function saveCardResults(playerId: number, tournamentId: string, snr: number, rounds: CardRound[], nowMs: number): void {
  db.transaction(() => {
    db.prepare("DELETE FROM player_card_rounds WHERE tournamentId = ? AND snr = ?").run(tournamentId, snr);
    const ins = db.prepare(
      `INSERT INTO player_card_rounds (tournamentId, snr, round, playerId, board, opponentSnr, color, result, fetchedAtMs)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rounds) ins.run(tournamentId, snr, r.round, playerId, r.board, r.opponentSnr, r.color, r.result || null, nowMs);
    db.prepare(
      `INSERT INTO entry_card_fetch (tournamentId, snr, fetchedAtMs, ok) VALUES (?, ?, ?, 1)
       ON CONFLICT(tournamentId, snr) DO UPDATE SET fetchedAtMs = excluded.fetchedAtMs, ok = 1`,
    ).run(tournamentId, snr, nowMs);
  })();
}

export function markCardFailed(tournamentId: string, snr: number, nowMs: number): void {
  db.prepare(
    `INSERT INTO entry_card_fetch (tournamentId, snr, fetchedAtMs, ok) VALUES (?, ?, ?, 0)
     ON CONFLICT(tournamentId, snr) DO UPDATE SET fetchedAtMs = excluded.fetchedAtMs, ok = 0`,
  ).run(tournamentId, snr, nowMs);
}

/**
 * A player's results, newest event first, one row per round. Rounds come from the player's card when it
 * has been fetched for that event (source "card"); otherwise they are read from the stored pairings of
 * that event (source "pairings"). `result` is from this player's side: "1", "½", "0", "+" / "-" for a
 * forfeit win or loss, or null while the game is unplayed.
 */
export function playerResults(playerId: number) {
  return db.prepare(
    `WITH mine AS (SELECT tournamentId, snr FROM tournament_entries WHERE playerId = @pid),
     card AS (
       SELECT r.tournamentId, r.snr, r.round, r.board, r.opponentSnr, r.color, r.result, r.fetchedAtMs, 'card' AS source
       FROM player_card_rounds r WHERE r.playerId = @pid
     ),
     pairings AS (
       SELECT g.tournamentId, m.snr, g.round, g.board,
              CASE WHEN g.whiteSnr = m.snr THEN g.blackSnr ELSE g.whiteSnr END AS opponentSnr,
              CASE WHEN g.whiteSnr = m.snr THEN 'w' ELSE 'b' END AS color,
              CASE WHEN g.result IS NULL THEN NULL
                   WHEN g.whiteSnr = m.snr THEN CASE g.result WHEN '1-0' THEN '1' WHEN '½-½' THEN '½' WHEN '+-' THEN '+' WHEN '-+' THEN '-' ELSE '0' END
                   ELSE CASE g.result WHEN '0-1' THEN '1' WHEN '½-½' THEN '½' WHEN '-+' THEN '+' WHEN '+-' THEN '-' ELSE '0' END
              END AS result,
              rd.fetchedAtMs, 'pairings' AS source
       FROM mine m
       JOIN games g ON g.tournamentId = m.tournamentId AND (g.whiteSnr = m.snr OR g.blackSnr = m.snr)
       JOIN rounds rd ON rd.tournamentId = g.tournamentId AND rd.round = g.round
       WHERE NOT EXISTS (SELECT 1 FROM player_card_rounds c WHERE c.tournamentId = m.tournamentId AND c.snr = m.snr)
     ),
     rows AS (SELECT * FROM card UNION ALL SELECT * FROM pairings)
     SELECT r.tournamentId, t.name AS tournament, t.startDate, t.endDate, r.snr, r.round, r.board,
            r.opponentSnr, ${PLAYER_ID("op")} AS opponentPlayerId, op.name AS opponentName, ${VERIFIED_FIDE("op")} AS opponentFideId,
            oe.ratingAtEvent AS opponentRating, op.federationCode AS opponentFed, ofp.title AS opponentTitle,
            r.color, r.result, r.fetchedAtMs, r.source
     FROM rows r
     JOIN tournaments t ON t.id = r.tournamentId
     LEFT JOIN tournament_entries oe ON oe.tournamentId = r.tournamentId AND oe.snr = r.opponentSnr
     LEFT JOIN players op ON op.id = oe.playerId
     LEFT JOIN fide_profiles ofp ON ofp.playerId = op.id
     ORDER BY COALESCE(t.startDate, '0000') DESC, r.tournamentId DESC, r.round`,
  ).all({ pid: playerId }) as PlayerResultRow[];
}

export interface PlayerResultRow {
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
  opponentTitle: string | null;
  color: "w" | "b" | null;
  result: string | null;
  fetchedAtMs: number;
  source: "card" | "pairings";
}

export function entryCardFetchedAt(tournamentId: string, snr: number): number | null {
  const row = db.prepare("SELECT fetchedAtMs FROM entry_card_fetch WHERE tournamentId = ? AND snr = ?").get(tournamentId, snr) as { fetchedAtMs: number } | undefined;
  return row?.fetchedAtMs ?? null;
}

// ---- leases: one writer per tournament -----------------------------------------------------
// A refresh talks to chess-results over the network, so it cannot hold a SQLite transaction for its whole
// length. Instead it holds a lease on the tournament row: a compare-and-set that succeeds only when no
// lease is held or the held one has expired. Every write checks the lease first, so a holder whose lease
// expired (and was taken by someone else) cannot overwrite the newer writer's rows.

export class LeaseLost extends Error {
  constructor(id: string) {
    super(`lease lost for tournament ${id}`);
  }
}

export function acquireLease(id: string, token: string, nowMs: number, ttlMs: number): boolean {
  const r = db.prepare(
    `UPDATE tournaments SET lockToken = @token, lockUntilMs = @until
     WHERE id = @id AND (lockUntilMs IS NULL OR lockUntilMs < @now)`,
  ).run({ id, token, now: nowMs, until: nowMs + ttlMs });
  return r.changes === 1;
}

export function assertLease(id: string, token: string, nowMs: number): void {
  const r = db.prepare("SELECT 1 FROM tournaments WHERE id = ? AND lockToken = ? AND lockUntilMs >= ?").get(id, token, nowMs);
  if (!r) throw new LeaseLost(id);
}

export function releaseLease(id: string, token: string): void {
  db.prepare("UPDATE tournaments SET lockToken = NULL, lockUntilMs = NULL WHERE id = ? AND lockToken = ?").run(id, token);
}

/** Tournaments currently leased by someone else are not due for the worker right now. */
export function isLeased(id: string, nowMs: number): boolean {
  return !!db.prepare("SELECT 1 FROM tournaments WHERE id = ? AND lockUntilMs >= ?").get(id, nowMs);
}
