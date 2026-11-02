import type Database from "better-sqlite3";
import { fideHash } from "./privacy.js";

// Replaces the data of the live database with an uploaded copy (see POST /api/admin/replace-db).
// Erasure records are never taken from the upload: production's deletion requests and suppression
// lists are kept, and the erasures they describe are re-applied to the uploaded data. A person erased
// on production therefore stays erased after a replacement.

/** Tables whose content comes from the upload. */
export const REPLACE_TABLES = [
  "meta", "events", "federations", "locations", "clubs", "players", "tournaments", "tournament_entries",
  "standings", "standing_tiebreaks", "rounds", "games", "sync_runs", "fide_profiles", "fide_ratings",
  "player_card_rounds", "entry_card_fetch", "event_chess_results",
];

/** Tables that record erasures. They stay as they are on production. */
export const ERASURE_TABLES = ["deletion_requests", "suppressed_fide_ids", "suppressed_entries"];

export interface ReplaceStats {
  copied: Record<string, number>;
  erasureRequests: number;
  fideErasuresReapplied: number;
  entryErasuresReapplied: number;
}

type Row = Record<string, unknown>;

function insertRows(db: Database.Database, table: string, rows: Row[]): void {
  for (const row of rows) {
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO main.${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((c) => row[c]));
  }
}

/**
 * Replaces the contents of `db` with the tables of the SQLite file at `incomingPath`. Runs in one
 * transaction: any failure, including a foreign-key violation, leaves `db` unchanged.
 * The caller must make sure the upload has the same migrations as `db`.
 */
export function replaceFromFile(db: Database.Database, incomingPath: string, nowMs: number): ReplaceStats {
  db.prepare("ATTACH DATABASE ? AS src").run(incomingPath);
  try {
    const srcTables = new Set(
      (db.prepare("SELECT name FROM src.sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name),
    );
    for (const t of [...REPLACE_TABLES, ...ERASURE_TABLES, "schema_migrations"]) {
      if (!srcTables.has(t)) throw new Error(`upload has no ${t} table`);
    }
    const versions = (schema: "main" | "src") =>
      (db.prepare(`SELECT version FROM ${schema}.schema_migrations ORDER BY version`).all() as { version: number }[]).map((r) => r.version).join(",");
    if (versions("main") !== versions("src")) {
      throw new Error(`upload migrations (${versions("src")}) do not match the server (${versions("main")})`);
    }

    // Production's erasure records, read before anything changes.
    const requests = db.prepare("SELECT * FROM main.deletion_requests").all() as Row[];
    const fideSup = db.prepare("SELECT fideHash, requestId, createdAtMs FROM main.suppressed_fide_ids").all() as Row[];
    const entrySup = db.prepare("SELECT tournamentId, snr, requestId, createdAtMs FROM main.suppressed_entries").all() as Row[];

    const copied: Record<string, number> = {};
    db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        for (const t of REPLACE_TABLES) {
          const cols = (db.prepare(`PRAGMA main.table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
          const srcCols = new Set((db.prepare(`PRAGMA src.table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
          const missing = cols.filter((c) => !srcCols.has(c));
          if (missing.length) throw new Error(`upload table ${t} lacks columns: ${missing.join(", ")}`);
          db.prepare(`DELETE FROM main.${t}`).run();
          copied[t] = db.prepare(`INSERT INTO main.${t} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM src.${t}`).run().changes;
        }

        // Erasure records: production's requests are restored as they were; their suppressions are rebuilt.
        db.prepare("DELETE FROM main.suppressed_entries").run();
        db.prepare("DELETE FROM main.suppressed_fide_ids").run();
        db.prepare("DELETE FROM main.deletion_requests").run();
        insertRows(db, "deletion_requests", requests);

        const anonFor = (requestId: unknown): number =>
          Number(
            db.prepare("INSERT INTO main.players (name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES (?, 'removed', 'UNK', ?, ?)")
              .run(`Removed player (request ${requestId})`, nowMs, nowMs).lastInsertRowid,
          );

        // FIDE ids: each erased id gets one anonymous player; uploaded rows with that id are removed.
        const anonByHash = new Map<string, number>();
        for (const s of fideSup) anonByHash.set(s.fideHash as string, anonFor(s.requestId));
        let fideErasures = 0;
        const withFide = db.prepare("SELECT id, fideId FROM main.players WHERE fideId IS NOT NULL").all() as { id: number; fideId: string }[];
        for (const p of withFide) {
          const anon = anonByHash.get(fideHash(p.fideId));
          if (anon === undefined) continue;
          db.prepare("UPDATE main.tournament_entries SET playerId = ? WHERE playerId = ?").run(anon, p.id);
          db.prepare("DELETE FROM main.fide_ratings WHERE playerId = ?").run(p.id);
          db.prepare("DELETE FROM main.fide_profiles WHERE playerId = ?").run(p.id);
          db.prepare("DELETE FROM main.players WHERE id = ?").run(p.id);
          fideErasures++;
        }
        for (const s of fideSup) {
          db.prepare("INSERT INTO main.suppressed_fide_ids (fideHash, anonPlayerId, requestId, createdAtMs) VALUES (?, ?, ?, ?)")
            .run(s.fideHash, anonByHash.get(s.fideHash as string), s.requestId, s.createdAtMs);
        }

        // Single entries: the entry is repointed to an anonymous player; the old player row goes if unused.
        let entryErasures = 0;
        for (const s of entrySup) {
          const anon = anonFor(s.requestId);
          const old = db.prepare("SELECT playerId FROM main.tournament_entries WHERE tournamentId = ? AND snr = ?")
            .get(s.tournamentId, s.snr) as { playerId: number } | undefined;
          if (old) {
            db.prepare("UPDATE main.tournament_entries SET playerId = ? WHERE tournamentId = ? AND snr = ?").run(anon, s.tournamentId, s.snr);
            db.prepare(`DELETE FROM main.players WHERE id = ? AND NOT EXISTS (SELECT 1 FROM main.tournament_entries WHERE playerId = ?)
                        AND NOT EXISTS (SELECT 1 FROM main.fide_profiles WHERE playerId = ?)`).run(old.playerId, old.playerId, old.playerId);
            entryErasures++;
          }
          db.prepare("INSERT INTO main.suppressed_entries (tournamentId, snr, anonPlayerId, requestId, createdAtMs) VALUES (?, ?, ?, ?, ?)")
            .run(s.tournamentId, s.snr, anon, s.requestId, s.createdAtMs);
        }

        const violations = db.prepare("PRAGMA main.foreign_key_check").all();
        if (violations.length) throw new Error(`foreign key violations after replace: ${violations.length} (first: ${JSON.stringify(violations[0])})`);

        copied.__erasureRequests = requests.length;
        copied.__fideErasures = fideErasures;
        copied.__entryErasures = entryErasures;
      })();
    } finally {
      db.pragma("foreign_keys = ON");
    }

    const { __erasureRequests, __fideErasures, __entryErasures, ...tables } = copied;
    return {
      copied: tables,
      erasureRequests: __erasureRequests,
      fideErasuresReapplied: __fideErasures,
      entryErasuresReapplied: __entryErasures,
    };
  } finally {
    db.prepare("DETACH DATABASE src").run();
  }
}
