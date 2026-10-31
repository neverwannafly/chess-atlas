import test from "node:test";
import assert from "node:assert/strict";
import { ageCategory } from "./age.js";
import { yearOf } from "../fide/ingest.js";

test("age category: youngest group that still admits the player on 1 January", () => {
  assert.equal(ageCategory(2014, 2026), "U14"); // age 12
  assert.equal(ageCategory(2019, 2026), "U8");  // age 7
  assert.equal(ageCategory(2018, 2026), "U10"); // age 8
  assert.equal(ageCategory(2008, 2026), "Open"); // age 18
  assert.equal(ageCategory(null, 2026), null);
  assert.equal(ageCategory(2030, 2026), null);
});

test("FIDE birthday: only a four-digit year is kept", () => {
  assert.equal(yearOf("2010"), 2010);
  assert.equal(yearOf("2010-05-12"), null);
  assert.equal(yearOf(""), null);
  assert.equal(yearOf(undefined), null);
});
