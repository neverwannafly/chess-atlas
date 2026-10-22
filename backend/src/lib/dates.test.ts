import test from "node:test";
import assert from "node:assert/strict";
import { addDays, parseDate, todayIST } from "../lib/dates.js";

test("parseDate formats", () => {
  assert.equal(parseDate("01-04-2026"), "2026-04-01");
  assert.equal(parseDate("1/4/2026"), "2026-04-01");
  assert.equal(parseDate("31.12.2025"), "2025-12-31");
  assert.equal(parseDate("10 Apr 2025"), "2025-04-10");
  assert.equal(parseDate("10th April, 2025"), "2025-04-10");
  assert.equal(parseDate("April 10, 2025"), "2025-04-10");
  assert.equal(parseDate("2025-04-10"), "2025-04-10");
  assert.equal(parseDate(" 05-04-2026 "), "2026-04-05");
});

test("parseDate tolerates typos seen on AICF", () => {
  assert.equal(parseDate("20-092-2026"), "2026-09-20");
  assert.equal(parseDate("-03-10-2026"), "2026-10-03");
});

test("parseDate rejects garbage and impossible dates", () => {
  assert.equal(parseDate("31-02-2026"), null);
  assert.equal(parseDate("TBA"), null);
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate("10 Foo 2025"), null);
});

test("addDays / todayIST", () => {
  assert.equal(addDays("2026-02-27", 2), "2026-03-01");
  assert.equal(todayIST(new Date("2026-01-01T20:00:00Z")), "2026-01-02"); // 01:30 IST next day
  assert.match(todayIST(), /^\d{4}-\d{2}-\d{2}$/);
});
