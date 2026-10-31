import db from "./database.js";
import { fideHash } from "./privacy.js";

// Deletion requests: recorded from the public form, decided by an admin, applied here.
// Erasure removes the FIDE profile and ratings, and replaces names with an anonymous player.
// Entries are repointed rather than deleted, so results and standings stay intact.

export interface DeletionInput {
  name: string;
  fideId: string | null;
  chessResultsTournamentId: string | null;
  chessResultsStartNo: number | null;
  contactEmail: string;
  note: string | null;
}

export function createDeletionRequest(input: DeletionInput, nowMs: number): number {
  return Number(
    db.prepare(
      `INSERT INTO deletion_requests (receivedAtMs, name, fideId, chessResultsTournamentId, chessResultsStartNo, contactEmail, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(nowMs, input.name, input.fideId, input.chessResultsTournamentId, input.chessResultsStartNo, input.contactEmail, input.note).lastInsertRowid,
  );
}

export function listDeletionRequests(status?: string) {
  return db
    .prepare(
      `SELECT id, receivedAtMs, name, fideId, chessResultsTournamentId, chessResultsStartNo, status, decidedAtMs, adminNote
       FROM deletion_requests ${status ? "WHERE status = ?" : ""} ORDER BY receivedAtMs DESC LIMIT 200`,
    )
    .all(...(status ? [status] : [])); // contact email is intentionally not listed
}

function anonymousPlayer(requestId: number, nowMs: number): number {
  return Number(
    db.prepare("INSERT INTO players (name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES (?, 'removed', 'UNK', ?, ?)")
      .run(`Removed player (request ${requestId})`, nowMs, nowMs).lastInsertRowid,
  );
}

/** Applies an erasure. Returns what was changed, or null if the request cannot be completed as-is. */
export function completeDeletion(requestId: number, nowMs: number): { fideErased: boolean; entriesErased: number } | null {
  const req = db.prepare("SELECT * FROM deletion_requests WHERE id = ?").get(requestId) as
    | { id: number; fideId: string | null; chessResultsTournamentId: string | null; chessResultsStartNo: number | null; status: string }
    | undefined;
  if (!req || req.status === "completed") return null;
  if (!req.fideId && !(req.chessResultsTournamentId && req.chessResultsStartNo)) return null; // needs manual review

  let fideErased = false;
  let entriesErased = 0;
  db.transaction(() => {
    if (req.fideId) {
      const hash = fideHash(req.fideId);
      const anon = anonymousPlayer(req.id, nowMs);
      const row = db.prepare("SELECT id FROM players WHERE fideId = ?").get(req.fideId) as { id: number } | undefined;
      if (row) {
        db.prepare("UPDATE tournament_entries SET playerId = ? WHERE playerId = ?").run(anon, row.id);
        db.prepare("DELETE FROM fide_ratings WHERE playerId = ?").run(row.id);
        db.prepare("DELETE FROM fide_profiles WHERE playerId = ?").run(row.id);
        db.prepare("DELETE FROM players WHERE id = ?").run(row.id);
      }
      db.prepare("INSERT OR REPLACE INTO suppressed_fide_ids (fideHash, anonPlayerId, requestId, createdAtMs) VALUES (?, ?, ?, ?)")
        .run(hash, anon, req.id, nowMs);
      fideErased = true;
    }
    if (req.chessResultsTournamentId && req.chessResultsStartNo) {
      const entry = db.prepare("SELECT playerId FROM tournament_entries WHERE tournamentId = ? AND snr = ?")
        .get(req.chessResultsTournamentId, req.chessResultsStartNo) as { playerId: number } | undefined;
      if (entry) {
        const anon = anonymousPlayer(req.id, nowMs);
        db.prepare("UPDATE tournament_entries SET playerId = ? WHERE tournamentId = ? AND snr = ?")
          .run(anon, req.chessResultsTournamentId, req.chessResultsStartNo);
        db.prepare("INSERT OR REPLACE INTO suppressed_entries (tournamentId, snr, anonPlayerId, requestId, createdAtMs) VALUES (?, ?, ?, ?, ?)")
          .run(req.chessResultsTournamentId, req.chessResultsStartNo, anon, req.id, nowMs);
        // Remove the old player row if nothing references it any more.
        db.prepare(`DELETE FROM players WHERE id = ? AND NOT EXISTS (SELECT 1 FROM tournament_entries WHERE playerId = ?)
                    AND NOT EXISTS (SELECT 1 FROM fide_profiles WHERE playerId = ?)`).run(entry.playerId, entry.playerId, entry.playerId);
        entriesErased = 1;
      }
    }
    db.prepare("UPDATE deletion_requests SET status = 'completed', decidedAtMs = ? WHERE id = ?").run(nowMs, req.id);
  })();
  return { fideErased, entriesErased };
}

export function setDeletionStatus(requestId: number, status: "in_review" | "rejected", note: string | null, nowMs: number): boolean {
  const r = db.prepare("UPDATE deletion_requests SET status = ?, adminNote = COALESCE(?, adminNote), decidedAtMs = ? WHERE id = ? AND status != 'completed'")
    .run(status, note, nowMs, requestId);
  return r.changes > 0;
}
