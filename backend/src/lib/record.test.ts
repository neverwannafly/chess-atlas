import test from "node:test";
import assert from "node:assert/strict";
import { recordOf } from "./record.js";

test("win, draw and loss totals and points", () => {
  const t = recordOf([{ result: "1" }, { result: "½" }, { result: "0" }, { result: "+" }, { result: null }, { result: "" }]);
  assert.deepEqual(t, { games: 4, wins: 2, draws: 1, losses: 1, points: 2.5 });
});
