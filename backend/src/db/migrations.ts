import type Database from "better-sqlite3";
import { parsePlace } from "../lib/place.js";

type Db = InstanceType<typeof Database>;

export interface Migration {
  version: number;
  name: string;
  up: (db: Db) => void;
}

const EVENTS_DDL = `
  CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventCode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    place TEXT,
    city TEXT,
    state TEXT,
    brochureUrl TEXT,

    extractionStatus TEXT NOT NULL DEFAULT 'pending'
      CHECK (extractionStatus IN ('pending','done','failed','no_brochure')),
    extractionAttempts INTEGER NOT NULL DEFAULT 0,
    extractionError TEXT,
    extractionJson TEXT,
    extractionModel TEXT,
    sourceHash TEXT,
    extractedAt TEXT,
    brochureUrlAtExtraction TEXT,
    lastAttemptAt TEXT,

    timeControlType TEXT,
    rounds INTEGER,
    fideRated INTEGER,
    totalPrizeInr INTEGER,
    entryFeeMinInr INTEGER,
    registrationDeadline TEXT,
    venueName TEXT,
    tagline TEXT,

    createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    lastSeenAt TEXT
  );
  CREATE INDEX idx_events_start ON events(startDate);
  CREATE INDEX idx_events_end ON events(endDate);
  CREATE INDEX idx_events_state ON events(state);
  CREATE INDEX idx_events_city ON events(city);
  CREATE INDEX idx_events_tc ON events(timeControlType);
  CREATE INDEX idx_events_prize ON events(totalPrizeInr);
  CREATE INDEX idx_events_xstatus ON events(extractionStatus);

  CREATE VIRTUAL TABLE events_fts USING fts5(
    name, city, state, venue, organizer,
    tokenize = 'unicode61 remove_diacritics 2'
  );
  -- rowid of events_fts == events.id

  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`;

export const migrations: Migration[] = [
  {
    version: 1,
    name: "new events schema + fts (replaces legacy LLM-column schema)",
    up(db) {
      const legacy = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='events'").get();
      if (legacy) db.exec("ALTER TABLE events RENAME TO events_legacy; DROP INDEX IF EXISTS idx_events_start_date; DROP INDEX IF EXISTS idx_events_end_date; DROP INDEX IF EXISTS idx_events_state; DROP INDEX IF EXISTS idx_events_time_control;");
      db.exec(EVENTS_DDL);
      if (legacy) {
        // Keep only scraped fields; extraction is reset and will be re-run by the worker.
        db.exec(`
          INSERT INTO events (eventCode, name, startDate, endDate, city, state, brochureUrl,
                              extractionStatus, createdAt, updatedAt, lastSeenAt)
          SELECT eventCode, name, startDate, endDate, city, state,
                 NULLIF(TRIM(brochureUrl), ''),
                 CASE WHEN brochureUrl IS NULL OR TRIM(brochureUrl) = '' THEN 'no_brochure' ELSE 'pending' END,
                 COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', createdAt), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                 COALESCE(strftime('%Y-%m-%dT%H:%M:%fZ', updatedAt), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                 NULL
          FROM events_legacy
          WHERE startDate GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND endDate   GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
            AND endDate >= startDate AND endDate <= date(startDate, '+60 days')
          ORDER BY id;
          DROP TABLE events_legacy;
        `);
        // Re-normalise the old (crude) city/state split with the new place parser.
        const upd = db.prepare("UPDATE events SET place = ?, city = ?, state = ? WHERE id = ?");
        for (const r of db.prepare("SELECT id, city, state FROM events").all() as { id: number; city: string | null; state: string | null }[]) {
          const place = [r.city, r.state].filter(Boolean).join(", ");
          const p = parsePlace(place);
          upd.run(place || null, p.city, p.state, r.id);
        }
        db.exec(`INSERT INTO events_fts(rowid, name, city, state, venue, organizer)
                 SELECT id, name, COALESCE(city,''), COALESCE(state,''), '', '' FROM events;`);
      }
    },
  },
];

export function runMigrations(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedAt TEXT NOT NULL)");
  const applied = new Set((db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version));
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      m.up(db);
      db.prepare("INSERT INTO schema_migrations (version, name, appliedAt) VALUES (?, ?, ?)").run(m.version, m.name, new Date().toISOString());
    })();
    console.log(`[db] applied migration ${m.version}: ${m.name}`);
  }
}
