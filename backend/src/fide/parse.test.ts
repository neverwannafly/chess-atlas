import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRatingHistory, parsePeriod, parseRating, profileFromHistory } from "./parse.js";

const fixture = [
  { date_2: "2026-Feb", id_number: "1", rating: "2000", period_games: "5", rapid_rtng: "0", rapid_games: "0", blitz_rtng: "1900", blitz_games: "3", name: "Test, Player", country: "IND" },
  { date_2: "&2026-Jan", rating: "1990", period_games: "0", rapid_rtng: "", blitz_rtng: null },
  { date_2: "2026-Jan", rating: "1990", period_games: "0", rapid_rtng: "", blitz_rtng: null, name: "Test, Player", country: "IND" },
  "junk",
];

test("parsePeriod", () => {
  assert.equal(parsePeriod("2026-Jan"), "2026-01");
  assert.equal(parsePeriod("2026-Dec"), "2026-12");
  assert.equal(parsePeriod("bad"), null);
});

test("parseRating never returns 0", () => {
  assert.equal(parseRating("0"), null);
  assert.equal(parseRating(""), null);
  assert.equal(parseRating(undefined), null);
  assert.equal(parseRating("2743"), 2743);
});

test("parseRatingHistory sorts, nulls unknowns, skips junk", () => {
  const h = parseRatingHistory("1", fixture)!;
  assert.equal(h.points.length, 2);
  assert.equal(h.points[0].period, "2026-01");
  assert.equal(h.points[0].rapid, null);
  assert.equal(h.points[1].rapid, null);
  assert.equal(h.points[1].blitz, 1900);
  assert.equal(h.name, "Test, Player");
  assert.equal(h.federation, "IND");
});

test("non-array input yields null", () => {
  assert.equal(parseRatingHistory("1", "<html>"), null);
  assert.equal(parseRatingHistory("1", null), null);
});

test("profileFromHistory uses latest period; empty -> null", () => {
  const p = profileFromHistory(parseRatingHistory("1", fixture)!)!;
  assert.equal(p.period, "2026-02");
  assert.equal(p.standard, 2000);
  assert.equal(p.title, null);
  assert.equal(profileFromHistory({ fideId: "1", name: null, federation: null, points: [] }), null);
});
