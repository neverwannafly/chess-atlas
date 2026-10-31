import db from "./database.js";
import { fideHash, suppressedHashes } from "./privacy.js";
import { normaliseName } from "./chessresults.js";

// Upload of player data prepared elsewhere (for example a local FIDE profile run). Matching is by FIDE id
// only, never by name. The official monthly list stays authoritative: a rating row that came from the list is
// never overwritten by an upload. Erased FIDE ids are skipped.

export interface ImportRating { list: "standard" | "rapid" | "blitz"; period: string; rating: number | null; games?: number | null }
export interface ImportPlayer {
  fideId: string;
  name: string;
  federationCode?: string;
  title?: string | null;
  sex?: "M" | "F" | null;
  birthYear?: number | null;
  identNumber?: string | null;
  ratings?: ImportRating[];
}
export interface ImportStats { created: number; updated: number; skipped: number; ratingRows: number }

export function importPlayers(players: ImportPlayer[], nowMs: number): ImportStats {
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, ratingRows: 0 };
  const erased = suppressedHashes(db);
  const find = db.prepare("SELECT id FROM players WHERE fideId = ?");
  db.transaction(() => {
    for (const p of players) {
      if (erased.has(fideHash(p.fideId))) { stats.skipped++; continue; }
      const name = p.name.replace(/\s+/g, " ").trim();
      const fed = p.federationCode ?? "UNK";
      db.prepare("INSERT OR IGNORE INTO federations (code, name) VALUES (?, NULL)").run(fed);
      let row = find.get(p.fideId) as { id: number } | undefined;
      if (!row) {
        const id = Number(db.prepare(
          "INSERT INTO players (fideId, fideIdSource, name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES (?, 'list', ?, ?, ?, ?, ?)",
        ).run(p.fideId, name, normaliseName(name), fed, nowMs, nowMs).lastInsertRowid);
        row = { id };
        stats.created++;
      } else {
        db.prepare("UPDATE players SET name = ?, nameKey = ?, federationCode = CASE WHEN federationCode = 'UNK' THEN ? ELSE federationCode END, updatedAtMs = ? WHERE id = ?")
          .run(name, normaliseName(name), fed, nowMs, row.id);
        stats.updated++;
      }
      if (p.birthYear) db.prepare("UPDATE players SET birthYear = ?, birthYearSource = 'card' WHERE id = ?").run(p.birthYear, row.id);
      if (p.identNumber) db.prepare("UPDATE players SET identNumber = ?, identSource = 'card' WHERE id = ?").run(p.identNumber, row.id);
      db.prepare(
        `INSERT INTO fide_profiles (playerId, fideId, title, sex, federationCode, inactive, source, fetchedAtMs)
         VALUES (?, ?, ?, ?, ?, 0, 'upload', ?)
         ON CONFLICT(playerId) DO UPDATE SET title = excluded.title, sex = excluded.sex, federationCode = excluded.federationCode, fetchedAtMs = excluded.fetchedAtMs`,
      ).run(row.id, p.fideId, p.title ?? null, p.sex ?? null, fed, nowMs);
      const rate = db.prepare(
        `INSERT INTO fide_ratings (playerId, list, period, rating, games, k, source, fetchedAtMs)
         VALUES (?, ?, ?, ?, ?, NULL, 'upload', ?)
         ON CONFLICT(playerId, list, period) DO UPDATE SET rating = excluded.rating, games = excluded.games,
           source = excluded.source, fetchedAtMs = excluded.fetchedAtMs
         WHERE fide_ratings.source <> 'fide-monthly-list'`,
      );
      for (const r of p.ratings ?? []) {
        rate.run(row.id, r.list, r.period, r.rating, r.games ?? null, nowMs);
        stats.ratingRows++;
      }
      db.prepare("UPDATE players SET fideStatsFetchedAtMs = ? WHERE id = ?").run(nowMs, row.id);
    }
  })();
  return stats;
}
