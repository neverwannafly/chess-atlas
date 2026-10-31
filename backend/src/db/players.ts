import db from "./database.js";

// Player queries. Players are the join point between tournaments (chess-results) and ratings (FIDE).

export interface PlayerSearchHit {
  id: number;
  name: string;
  fed: string;
  fideId: string | null;
  identNumber: string | null;
  title: string | null;
}

export function searchPlayers(q: string, limit: number): PlayerSearchHit[] {
  const like = `%${q.toLowerCase().replace(/[%_]/g, "").replace(/[^a-z0-9 ]/g, " ").trim()}%`;
  return db
    .prepare(
      `SELECT p.id, p.name, p.federationCode AS fed, p.fideId, p.identNumber, f.title
       FROM players p LEFT JOIN fide_profiles f ON f.playerId = p.id
       WHERE p.nameKey LIKE @like AND p.nameKey <> 'removed'
       ORDER BY (p.fideId IS NULL), p.name LIMIT @limit`,
    )
    .all({ like, limit }) as PlayerSearchHit[];
}

export function getPlayerDetail(id: number) {
  const player = db
    .prepare(
      `SELECT p.id, p.name, p.federationCode AS fed, p.fideId, p.identNumber, f.title, f.sex, f.inactive, f.fetchedAtMs AS fideFetchedAtMs
       FROM players p LEFT JOIN fide_profiles f ON f.playerId = p.id WHERE p.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!player) return null;

  const tournaments = db
    .prepare(
      `SELECT t.id AS tournamentId, t.name AS tournament, t.startDate, t.endDate, t.status,
              e.snr, e.ratingAtEvent AS rating, s.rank, s.points
       FROM tournament_entries e
       JOIN tournaments t ON t.id = e.tournamentId
       LEFT JOIN standings s ON s.tournamentId = e.tournamentId AND s.snr = e.snr
       WHERE e.playerId = ? ORDER BY COALESCE(t.startDate, '0000') DESC LIMIT 200`,
    )
    .all(id);

  const ratings = db
    .prepare(
      `SELECT list, period, rating, games FROM fide_ratings WHERE playerId = ? ORDER BY period DESC, list LIMIT 120`,
    )
    .all(id);

  // Records that share the chess-results Ident-Number. Shown as a grouping; rows are never merged.
  const sameIdent = player.identNumber
    ? db.prepare("SELECT id, name, federationCode AS fed FROM players WHERE identNumber = ? AND id <> ? AND nameKey <> 'removed'")
        .all(player.identNumber, id)
    : [];

  return { ...player, tournaments, fideRatings: ratings, sameIdentRecords: sameIdent };
}
