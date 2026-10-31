import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { runMigrations } from "../db/migrations.js";
import { ingestMonthlyList, looksLikeZip, parsePlayers } from "./ingest.js";

function player(id: string, name: string, country: string, o: Record<string, string> = {}): string {
  const f = { sex: "M", title: "", w_title: "", rating: "0", games: "0", k: "0", rapid_rating: "0", rapid_games: "0", rapid_k: "0",
    blitz_rating: "0", blitz_games: "0", blitz_k: "0", birthday: "1990", flag: "", ...o };
  return `<player>\n<fideid>${id}</fideid>\n<name>${name}</name>\n<country>${country}</country>\n` +
    Object.entries(f).map(([k, v]) => `<${k}>${v}</${k}>`).join("\n") + "\n</player>\n";
}

const XML =
  "<playerslist>\n" +
  player("900000001", ", , Testfrom, Anya", "NOR") +
  player("900000002", "Sample, Ravi &amp; Co", "IND", { title: "IM", rating: "2401", games: "9", k: "10", rapid_rating: "2300", rapid_k: "20", flag: "i" }) +
  player("900000003", "Demo, Meera", "IND", { sex: "F", w_title: "WFM", blitz_rating: "1800", blitz_games: "5", blitz_k: "40" }) +
  "</playerslist>\n";

async function* chunked(s: string, n: number) {
  for (let i = 0; i < s.length; i += n) yield s.slice(i, i + n);
}

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

test("parser keeps only IND, splits across chunks, zero -> null", async () => {
  const out = [];
  for await (const r of parsePlayers(chunked(XML, 37))) out.push(r);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "Sample, Ravi & Co");
  assert.equal(out[0].title, "IM");
  assert.equal(out[0].inactive, true);
  assert.deepEqual(out[0].ratings.standard, { rating: 2401, games: 9, k: 10 });
  assert.deepEqual(out[0].ratings.blitz, { rating: null, games: null, k: null });
  assert.equal(out[1].title, "WFM");
  assert.equal(out[1].sex, "F");
  assert.equal(out[1].ratings.blitz.rating, 1800);
  assert.equal(out[1].ratings.standard.rating, null);
});

test("ingest upserts, is idempotent, never merges by name, never stores 0", async () => {
  const db = freshDb();
  db.prepare("INSERT OR IGNORE INTO federations (code, name) VALUES ('IND', NULL)").run();
  db.prepare("INSERT INTO players (name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES ('Demo Meera', 'demo meera', 'IND', 1, 1)").run();
  const run = () => ingestMonthlyList({ period: "2026-10", db, chunks: chunked(XML, 101), nowMs: 5 });
  const s1 = await run();
  assert.equal(s1.seen, 2);
  // Players are matched on FIDE id only: the unlinked same-name row stays separate (duplicates allowed).
  assert.equal(s1.playersLinked, 0);
  assert.equal(s1.playersCreated, 2);
  const count = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }).c;
  const before = [count("players"), count("fide_profiles"), count("fide_ratings")];
  assert.deepEqual(before, [3, 2, 6]);
  await run();
  assert.deepEqual([count("players"), count("fide_profiles"), count("fide_ratings")], before);
  assert.equal((db.prepare("SELECT COUNT(*) c FROM fide_ratings WHERE rating = 0 OR k = 0").get() as { c: number }).c, 0);
  const p = db.prepare("SELECT inactive, title FROM fide_profiles WHERE fideId = '900000002'").get() as { inactive: number; title: string };
  assert.deepEqual(p, { inactive: 1, title: "IM" });
  await ingestMonthlyList({ period: "2026-11", db, chunks: chunked(XML, 500) });
  assert.equal(count("fide_ratings"), 12);
});

test("same normalised name, different FIDE ids stay separate players", async () => {
  const db = freshDb();
  const xml = "<playerslist>" + player("900000010", "Twin, Sam", "IND") + player("900000011", "Twin Sam", "IND") + "</playerslist>";
  await ingestMonthlyList({ period: "2026-10", db, chunks: chunked(xml, 64) });
  assert.equal((db.prepare("SELECT COUNT(*) c FROM players").get() as { c: number }).c, 2);
});

test("looksLikeZip rejects an HTML file", async () => {
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const d = mkdtempSync(join(tmpdir(), "fide-"));
  writeFileSync(join(d, "a.zip"), "<html>nope</html>");
  assert.equal(looksLikeZip(join(d, "a.zip")), false);
});
