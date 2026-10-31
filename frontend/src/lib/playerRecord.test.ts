/// <reference types="node" />
// Run: npx tsx --test src/lib/playerRecord.test.ts (from frontend/, tsx from backend/node_modules works too)
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupEvents, headToHead, opponents, refreshPollDelay, resultLabel, scoreOf, withRunning, type EntryRow, type ResultRow } from "./playerRecord.ts";

const row = (o: Partial<ResultRow>): ResultRow => ({
  tournamentId: "1", tournament: "Open A", startDate: "2026-10-01", endDate: "2026-10-03", snr: 5, round: 1, board: 1,
  opponentSnr: 9, opponentPlayerId: 900, opponentName: "Rao, Arjun", opponentFideId: null, opponentRating: 1800, opponentFed: "IND",
  color: "w", result: "1", fetchedAtMs: 1000, ...o,
});

test("scoreOf reads card and forfeit results", () => {
  assert.equal(scoreOf("1"), 1);
  assert.equal(scoreOf("½"), 0.5);
  assert.equal(scoreOf("0"), 0);
  assert.equal(scoreOf("+"), 1);
  assert.equal(scoreOf("-"), 0);
  assert.equal(scoreOf("- 1K"), 1);
  assert.equal(scoreOf("0K"), 0);
  assert.equal(scoreOf(""), null);
  assert.equal(scoreOf(null), null);
  assert.equal(scoreOf("?"), null);
});

test("resultLabel marks forfeits and keeps unknown text", () => {
  assert.equal(resultLabel("½"), "½");
  assert.equal(resultLabel("+"), "1F");
  assert.equal(resultLabel("- 1K"), "1F");
  assert.equal(resultLabel(null), "");
  assert.equal(resultLabel("x"), "x");
});

test("withRunning sorts by round and skips unplayed rounds", () => {
  const r = withRunning([row({ round: 3, result: null }), row({ round: 1, result: "1" }), row({ round: 2, result: "½" })]);
  assert.deepEqual(r.map((x) => [x.round, x.running]), [[1, 1], [2, 1.5], [3, null]]);
});

test("groupEvents keeps entry order and appends result-only events", () => {
  const entries: EntryRow[] = [
    { tournamentId: "2", tournament: "New", startDate: "2026-10-20", endDate: null, status: "ongoing", snr: 3, rating: 1500, rank: 4, points: 2 },
    { tournamentId: "1", tournament: "Open A", startDate: "2026-10-01", endDate: null, status: "finished", snr: 5, rating: 1490, rank: 1, points: 2 },
  ];
  const g = groupEvents(entries, [row({}), row({ round: 2, result: "1", fetchedAtMs: 3000 }), row({ tournamentId: "7", tournament: "Card only" })]);
  assert.deepEqual(g.map((e) => e.tournamentId), ["2", "1", "7"]);
  assert.equal(g[0].rounds.length, 0);
  assert.equal(g[1].played, 2);
  assert.equal(g[1].scored, 2);
  assert.equal(g[1].lastFetchedAtMs, 3000);
});

test("opponents counts scored games, sorts by games, skips unlinked", () => {
  const o = opponents([
    row({ opponentPlayerId: 1, opponentName: "B", result: "1" }),
    row({ opponentPlayerId: 2, opponentName: "A", result: "½", tournamentId: "2" }),
    row({ opponentPlayerId: 2, opponentName: "A", result: "0", tournamentId: "3" }),
    row({ opponentPlayerId: 1, opponentName: "B", result: null, round: 2 }),
    row({ opponentPlayerId: null, result: "1" }),
  ]);
  assert.deepEqual(o.map((x) => [x.playerId, x.games, x.score, x.wins, x.draws, x.losses]), [[2, 2, 0.5, 0, 1, 1], [1, 1, 1, 1, 0, 0]]);
});

test("headToHead filters to one opponent", () => {
  const h = headToHead([row({ opponentPlayerId: 1 }), row({ opponentPlayerId: 2, result: "½" })], 2);
  assert.equal(h.length, 1);
  assert.equal(h[0].score, 0.5);
});

test("refreshPollDelay polls while running or within the cap", () => {
  assert.equal(refreshPollDelay("in_progress", null, 0), 5000);
  assert.equal(refreshPollDelay("idle", 10_000, 5_000), 5000);
  assert.equal(refreshPollDelay("idle", 10_000, 10_000), false);
  assert.equal(refreshPollDelay(undefined, null, 0), false);
});
