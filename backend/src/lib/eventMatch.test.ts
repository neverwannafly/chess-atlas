import test from "node:test";
import assert from "node:assert/strict";
import { nameScore, MATCH_THRESHOLD } from "./eventMatch.js";

test("the same tournament under different wording clears the threshold", () => {
  assert.ok(nameScore("8th SHAASTRA Rapid FIDE Rated Chess Tournament 2026", "8th Shaastra FIDE Rated Rapid Chess Tournament 2026") >= MATCH_THRESHOLD);
});

test("different sections of one event are not confused", () => {
  assert.ok(nameScore("Grandeur 10 International Open FIDE Blitz", "Grandeur 10 International Open FIDE Rapid") < 1);
});

test("unrelated names do not match", () => {
  assert.ok(nameScore("Kerala State Open", "Bihar State Senior Championship") < MATCH_THRESHOLD);
});
