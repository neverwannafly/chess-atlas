import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "./migrations.js";
import { replaceFromFile } from "./replace.js";
import { fideHash } from "./privacy.js";

function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

const dir = mkdtempSync(join(tmpdir(), "replace-"));

function localCopy(): string {
  const path = join(mkdtempSync(join(dir, "l-")), "local.db");
  const db = openDb(path);
  db.prepare("INSERT INTO federations (code, name) VALUES ('IND', 'India')").run();
  db.prepare("INSERT INTO tournaments (id, name, federationCode, discoveredVia, status, createdAtMs, updatedAtMs) VALUES ('1', 'Open', 'IND', 'home', 'finished', 1, 1)").run();
  // The erased FIDE id is present in the upload with a name, and has an entry in the upload's tournament.
  db.prepare("INSERT INTO players (fideId, fideIdSource, name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES ('900000001', 'list', 'Erased Person', 'erased person', 'IND', 1, 1)").run();
  db.prepare("INSERT INTO players (fideId, fideIdSource, name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES ('900000002', 'list', 'Kept Person', 'kept person', 'IND', 1, 1)").run();
  db.prepare("INSERT INTO players (name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES ('Entry Erased', 'entry erased', 'IND', 1, 1)").run();
  db.prepare("INSERT INTO tournament_entries (tournamentId, snr, playerId) VALUES ('1', 1, (SELECT id FROM players WHERE fideId = '900000001'))").run();
  db.prepare("INSERT INTO tournament_entries (tournamentId, snr, playerId) VALUES ('1', 2, (SELECT id FROM players WHERE fideId = '900000002'))").run();
  db.prepare("INSERT INTO tournament_entries (tournamentId, snr, playerId) VALUES ('1', 3, (SELECT id FROM players WHERE name = 'Entry Erased'))").run();
  db.close();
  return path;
}

function productionDb(): Database.Database {
  const db = openDb(join(mkdtempSync(join(dir, "p-")), "prod.db"));
  db.prepare("INSERT INTO federations (code, name) VALUES ('IND', 'India')").run();
  db.prepare("INSERT INTO tournaments (id, name, federationCode, discoveredVia, status, createdAtMs, updatedAtMs) VALUES ('1', 'Open', 'IND', 'home', 'finished', 1, 1)").run();
  db.prepare("INSERT INTO deletion_requests (id, receivedAtMs, name, fideId, contactEmail, status) VALUES (7, 1, 'Erased Person', '900000001', 'x@example.com', 'completed')").run();
  db.prepare("INSERT INTO deletion_requests (id, receivedAtMs, name, chessResultsTournamentId, chessResultsStartNo, contactEmail, status) VALUES (8, 1, 'Entry', '1', 3, 'y@example.com', 'completed')").run();
  db.prepare("INSERT INTO players (name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES ('Removed player (request 7)', 'removed', 'UNK', 1, 1)").run();
  db.prepare("INSERT INTO suppressed_fide_ids (fideHash, anonPlayerId, requestId, createdAtMs) VALUES (?, 1, 7, 1)").run(fideHash("900000001"));
  db.prepare("INSERT INTO suppressed_entries (tournamentId, snr, anonPlayerId, requestId, createdAtMs) VALUES ('1', 3, 1, 8, 1)").run();
  return db;
}

test("replace takes the upload's data but keeps production's erasures in force", () => {
  const prod = productionDb();
  const incoming = localCopy();
  const stats = replaceFromFile(prod, incoming, 100);

  assert.equal(stats.copied.players, 3);
  assert.equal(stats.erasureRequests, 2);
  assert.equal(stats.fideErasuresReapplied, 1);
  assert.equal(stats.entryErasuresReapplied, 1);

  // The erased FIDE id is gone from the players, and its entry now points at an anonymous player.
  const erased = prod.prepare("SELECT COUNT(*) c FROM players WHERE fideId = '900000001'").get() as { c: number };
  assert.equal(erased.c, 0);
  const entry1 = prod.prepare("SELECT p.nameKey k FROM tournament_entries e JOIN players p ON p.id = e.playerId WHERE e.tournamentId = '1' AND e.snr = 1").get() as { k: string };
  assert.equal(entry1.k, "removed");

  // The erased entry has no name left, and the other players are untouched.
  const entry3 = prod.prepare("SELECT p.name n FROM tournament_entries e JOIN players p ON p.id = e.playerId WHERE e.tournamentId = '1' AND e.snr = 3").get() as { n: string };
  assert.match(entry3.n, /^Removed player/);
  assert.equal((prod.prepare("SELECT COUNT(*) c FROM players WHERE name = 'Entry Erased'").get() as { c: number }).c, 0);
  assert.equal((prod.prepare("SELECT COUNT(*) c FROM players WHERE fideId = '900000002'").get() as { c: number }).c, 1);

  // Production's erasure records survive with their ids.
  assert.deepEqual(prod.prepare("SELECT id FROM deletion_requests ORDER BY id").all(), [{ id: 7 }, { id: 8 }]);
  assert.equal((prod.prepare("SELECT COUNT(*) c FROM suppressed_fide_ids").get() as { c: number }).c, 1);
  assert.equal((prod.prepare("SELECT COUNT(*) c FROM suppressed_entries").get() as { c: number }).c, 1);
  prod.close();
});

test("a failed replace leaves the database unchanged", () => {
  const prod = productionDb();
  const before = prod.prepare("SELECT COUNT(*) c FROM players").get() as { c: number };
  const bad = join(mkdtempSync(join(dir, "b-")), "bad.db");
  const b = openDb(bad);
  b.close();
  // The upload has no data, so the migration check passes but nothing is copied from a broken schema.
  // Simulate a broken upload by dropping a required table.
  const broken = new Database(bad);
  broken.exec("DROP TABLE events");
  broken.close();
  assert.throws(() => replaceFromFile(prod, bad, 100), /upload has no events table/);
  assert.equal((prod.prepare("SELECT COUNT(*) c FROM players").get() as { c: number }).c, before.c);
  prod.close();
});
