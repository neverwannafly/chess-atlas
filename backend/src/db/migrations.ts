import type Database from "better-sqlite3";
import { parsePlace } from "../lib/place.js";
import { pickEventSlug } from "../lib/slug.js";

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
  {
    version: 2,
    name: "normalised chess-results mirror: federations, locations, clubs, players, tournaments, entries, standings, games",
    up(db) {
      // Timestamps are epoch ms. Dates are YYYY-MM-DD (IST). Every fact is stored once: players and
      // tournaments are referenced by id, never copied as names into results tables.
      db.exec(`
        CREATE TABLE federations (
          code TEXT PRIMARY KEY,                -- 3-letter code, e.g. IND; UNK when unknown
          name TEXT
        );
        INSERT INTO federations (code, name) VALUES ('UNK', 'Unknown');

        CREATE TABLE locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          raw TEXT NOT NULL UNIQUE,             -- as printed by the source
          city TEXT,
          state TEXT,
          countryCode TEXT REFERENCES federations(code)
        );

        CREATE TABLE clubs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fideId TEXT UNIQUE,                   -- set once linked to a FIDE profile
          name TEXT NOT NULL,
          nameKey TEXT NOT NULL,                -- normalised name, for search only (never used to merge)
          federationCode TEXT NOT NULL DEFAULT 'UNK' REFERENCES federations(code),
          createdAtMs INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL
        );
        CREATE INDEX idx_players_namekey ON players(nameKey);

        CREATE TABLE tournaments (
          id TEXT PRIMARY KEY,                  -- chess-results tnr number
          name TEXT NOT NULL,
          federationCode TEXT NOT NULL DEFAULT 'UNK' REFERENCES federations(code),
          locationId INTEGER REFERENCES locations(id),
          startDate TEXT,
          endDate TEXT,
          timeControl TEXT,
          rounds INTEGER,
          status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','finished')),
          listMarker TEXT,                      -- raw marker from the list page (St / Rp / Bz ...)
          discoveredVia TEXT NOT NULL CHECK (discoveredVia IN ('home','federation','archive')),
          sourceUpdatedAtMs INTEGER,            -- "Last update" stamp on the tournament page
          listedUpdatedAtMs INTEGER,            -- "N minutes ago" from the list, as an absolute time
          listedAtMs INTEGER,                   -- last cycle in which a list page showed it
          lastFetchedAtMs INTEGER,
          nextFetchAtMs INTEGER,                -- NULL = never due again (finished and final pass done)
          finalFetchedAtMs INTEGER,             -- set after the last pass of a finished tournament
          backfilled INTEGER NOT NULL DEFAULT 0,
          errorCount INTEGER NOT NULL DEFAULT 0,
          fetchError TEXT,
          createdAtMs INTEGER NOT NULL,
          updatedAtMs INTEGER NOT NULL
        );
        CREATE INDEX idx_tournaments_next ON tournaments(nextFetchAtMs);
        CREATE INDEX idx_tournaments_status_dates ON tournaments(status, startDate, endDate);
        CREATE INDEX idx_tournaments_fed ON tournaments(federationCode, startDate);

        CREATE TABLE tournament_entries (
          tournamentId TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          snr INTEGER NOT NULL,                 -- starting number inside the tournament
          playerId INTEGER NOT NULL REFERENCES players(id),
          ratingAtEvent INTEGER,                -- rating printed for this event; NULL = unrated
          clubId INTEGER REFERENCES clubs(id),
          PRIMARY KEY (tournamentId, snr)
        );
        CREATE INDEX idx_entries_player ON tournament_entries(playerId);

        CREATE TABLE standings (
          tournamentId TEXT NOT NULL,
          snr INTEGER NOT NULL,
          rank INTEGER,
          points REAL,
          PRIMARY KEY (tournamentId, snr),
          FOREIGN KEY (tournamentId, snr) REFERENCES tournament_entries(tournamentId, snr) ON DELETE CASCADE
        );

        CREATE TABLE standing_tiebreaks (
          tournamentId TEXT NOT NULL,
          snr INTEGER NOT NULL,
          position INTEGER NOT NULL,            -- 1 = TB1
          value REAL,
          PRIMARY KEY (tournamentId, snr, position),
          FOREIGN KEY (tournamentId, snr) REFERENCES tournament_entries(tournamentId, snr) ON DELETE CASCADE
        );

        CREATE TABLE rounds (
          tournamentId TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          round INTEGER NOT NULL,
          fetchedAtMs INTEGER NOT NULL,
          PRIMARY KEY (tournamentId, round)
        );

        CREATE TABLE games (
          tournamentId TEXT NOT NULL,
          round INTEGER NOT NULL,
          match INTEGER NOT NULL,               -- team match within the round (1 for individual events)
          board INTEGER NOT NULL,
          whiteSnr INTEGER NOT NULL,
          blackSnr INTEGER NOT NULL,
          result TEXT CHECK (result IN ('1-0','0-1','½-½','+-','-+','0-0') OR result IS NULL),
          PRIMARY KEY (tournamentId, round, match, board),
          FOREIGN KEY (tournamentId, round) REFERENCES rounds(tournamentId, round) ON DELETE CASCADE,
          FOREIGN KEY (tournamentId, whiteSnr) REFERENCES tournament_entries(tournamentId, snr) ON DELETE CASCADE,
          FOREIGN KEY (tournamentId, blackSnr) REFERENCES tournament_entries(tournamentId, snr) ON DELETE CASCADE
        );

        CREATE TABLE sync_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL CHECK (kind IN ('cycle','archive','fide')),
          startedAtMs INTEGER NOT NULL,
          finishedAtMs INTEGER,
          requests INTEGER NOT NULL DEFAULT 0,
          errors INTEGER NOT NULL DEFAULT 0,
          outcome TEXT,
          detail TEXT
        );
      `);
    },
  },
  {
    version: 3,
    name: "FIDE profile and rating history (official monthly lists)",
    up(db) {
      db.exec(`
        CREATE TABLE fide_profiles (
          playerId INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
          fideId TEXT NOT NULL UNIQUE,
          title TEXT,                          -- e.g. GM, IM, WGM; NULL = none
          sex TEXT CHECK (sex IN ('M','F') OR sex IS NULL),
          federationCode TEXT REFERENCES federations(code),
          inactive INTEGER NOT NULL DEFAULT 0,
          source TEXT NOT NULL,                -- e.g. 'fide-monthly-list'
          fetchedAtMs INTEGER NOT NULL
        );

        CREATE TABLE fide_ratings (
          playerId INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          list TEXT NOT NULL CHECK (list IN ('standard','rapid','blitz')),
          period TEXT NOT NULL,                -- YYYY-MM of the published list
          rating INTEGER,                      -- NULL = not rated in that list
          games INTEGER,
          k INTEGER,
          source TEXT NOT NULL,
          fetchedAtMs INTEGER NOT NULL,
          PRIMARY KEY (playerId, list, period)
        );
        CREATE INDEX idx_fide_ratings_period ON fide_ratings(period, list);
      `);
    },
  },
  {
    version: 4,
    name: "privacy: deletion requests and suppression lists",
    up(db) {
      db.exec(`
        CREATE TABLE deletion_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          receivedAtMs INTEGER NOT NULL,
          name TEXT NOT NULL,                  -- as the requester typed it
          fideId TEXT,                         -- optional; digits only
          chessResultsTournamentId TEXT,       -- optional; the tnr number of the event
          chessResultsStartNo INTEGER,         -- optional; the snr shown on that event
          contactEmail TEXT NOT NULL,          -- used only to reply about this request
          note TEXT,
          status TEXT NOT NULL DEFAULT 'received'
            CHECK (status IN ('received','in_review','completed','rejected')),
          decidedAtMs INTEGER,
          adminNote TEXT
        );
        CREATE INDEX idx_deletion_status ON deletion_requests(status, receivedAtMs);

        -- Hash of a FIDE id whose data was erased. Later imports must not recreate it.
        CREATE TABLE suppressed_fide_ids (
          fideHash TEXT PRIMARY KEY,           -- sha256 of the FIDE id
          anonPlayerId INTEGER NOT NULL REFERENCES players(id),
          requestId INTEGER REFERENCES deletion_requests(id),
          createdAtMs INTEGER NOT NULL
        );

        -- A single tournament entry whose data was erased. Later refreshes keep it anonymous.
        CREATE TABLE suppressed_entries (
          tournamentId TEXT NOT NULL,
          snr INTEGER NOT NULL,
          anonPlayerId INTEGER NOT NULL REFERENCES players(id),
          requestId INTEGER REFERENCES deletion_requests(id),
          createdAtMs INTEGER NOT NULL,
          PRIMARY KEY (tournamentId, snr)
        );
      `);
    },
  },
  {
    version: 5,
    name: "chess-results Ident-Number on players (deterministic link key; no name matching)",
    up(db) {
      db.exec(`
        ALTER TABLE players ADD COLUMN identNumber TEXT;
        ALTER TABLE players ADD COLUMN identCheckedAtMs INTEGER;
        CREATE INDEX idx_players_ident ON players(identNumber);
      `);
    },
  },
  {
    version: 6,
    name: "data correctness: provenance for FIDE ids and Ident-Numbers; clear unverified FIDE ids",
    up(db) {
      db.exec(`
        ALTER TABLE players ADD COLUMN fideIdSource TEXT CHECK (fideIdSource IN ('list','card','starting') OR fideIdSource IS NULL);
        ALTER TABLE players ADD COLUMN identSource TEXT CHECK (identSource IN ('card','starting') OR identSource IS NULL);
      `);
      // FIDE ids that match the official list are verified.
      db.exec(`UPDATE players SET fideIdSource = 'list' WHERE fideId IN (SELECT fideId FROM fide_profiles);`);
      // Earlier starting-list parsing read the chess-results ID column as the FIDE id. Those values are
      // unverified: clear them so they are not shown, and re-queue their player cards for verification.
      db.exec(`
        UPDATE players SET fideId = NULL WHERE fideIdSource IS NULL AND fideId IS NOT NULL;
        UPDATE players SET identCheckedAtMs = NULL WHERE fideIdSource IS NULL;
      `);
      // Ident-Numbers so far all came from player cards.
      db.exec(`UPDATE players SET identSource = 'card' WHERE identNumber IS NOT NULL;`);
    },
  },
  {
    version: 7,
    name: "player results from player cards, fetched on request",
    up(db) {
      db.exec(`
        -- One row per round of a player's result in one event (from the player card).
        CREATE TABLE player_card_rounds (
          tournamentId TEXT NOT NULL,
          snr INTEGER NOT NULL,
          round INTEGER NOT NULL,
          playerId INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
          board INTEGER,
          opponentSnr INTEGER,
          color TEXT CHECK (color IN ('w','b') OR color IS NULL),
          result TEXT,
          fetchedAtMs INTEGER NOT NULL,
          PRIMARY KEY (tournamentId, snr, round)
        );
        CREATE INDEX idx_card_rounds_player ON player_card_rounds(playerId);

        -- When each event's card was last fetched for a player (drives the on-request refresh).
        CREATE TABLE entry_card_fetch (
          tournamentId TEXT NOT NULL,
          snr INTEGER NOT NULL,
          fetchedAtMs INTEGER NOT NULL,
          ok INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (tournamentId, snr)
        );
      `);
    },
  },
  {
    version: 8,
    name: "birth year for age categories (year only: the sources publish no full date)",
    up(db) {
      db.exec(`
        ALTER TABLE players ADD COLUMN birthYear INTEGER;
        ALTER TABLE players ADD COLUMN birthYearSource TEXT CHECK (birthYearSource IN ('fide','card') OR birthYearSource IS NULL);
      `);
    },
  },
  {
    version: 9,
    name: "tournament leases: one writer per tournament across worker and on-request refresh",
    up(db) {
      db.exec(`
        ALTER TABLE tournaments ADD COLUMN lockToken TEXT;
        ALTER TABLE tournaments ADD COLUMN lockUntilMs INTEGER;
      `);
    },
  },
  {
    version: 10,
    name: "event slugs: human-readable URL key, unique, backfilled from the event name",
    up(db) {
      // SQLite cannot add a UNIQUE column directly, so add it plain, backfill, then index it.
      db.exec("ALTER TABLE events ADD COLUMN slug TEXT");
      const rows = db.prepare("SELECT id, name, startDate FROM events ORDER BY startDate, id").all() as
        { id: number; name: string; startDate: string }[];
      const taken = new Set<string>();
      const upd = db.prepare("UPDATE events SET slug = ? WHERE id = ?");
      for (const r of rows) {
        const slug = pickEventSlug(r.name, r.startDate, (s) => taken.has(s));
        taken.add(slug);
        upd.run(slug, r.id);
      }
      db.exec("CREATE UNIQUE INDEX idx_events_slug ON events(slug)");
    },
  },
  {
    version: 11,
    name: "event to chess-results tournament links (automatic by name and date, or manual)",
    up(db) {
      db.exec(`
        CREATE TABLE event_chess_results (
          eventCode TEXT PRIMARY KEY,
          tournamentId TEXT NOT NULL,
          method TEXT NOT NULL CHECK (method IN ('auto','manual')),
          score REAL,
          matchedAtMs INTEGER NOT NULL
        );
        CREATE INDEX idx_ecr_tournament ON event_chess_results(tournamentId);
      `);
    },
  },
  {
    version: 12,
    name: "re-walk rounds for tournaments that have no stored games (round parser fix)",
    up(db) {
      // The round parser dropped every game in tables without a start-number column. Those tournaments
      // were marked as walked; clear the flag so the next refresh walks their rounds again.
      db.exec(`UPDATE tournaments SET backfilled = 0 WHERE id NOT IN (SELECT DISTINCT tournamentId FROM games);`);
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
