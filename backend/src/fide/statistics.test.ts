import test from "node:test";
import assert from "node:assert/strict";
import { fidePeriod, parseFideStatistics } from "./statistics.js";

test("period labels map to YYYY-MM", () => {
  assert.equal(fidePeriod("2026-Nov"), "2026-11");
  assert.equal(fidePeriod("2023-Jun"), "2023-06");
  assert.equal(fidePeriod("Total"), null);
});

test("statistics table: one row per list per month, empty lists skipped", () => {
  const html = `<table class="profile-table_calc"><thead><tr><th>Period</th></tr></thead><tbody>
    <tr><td> 2026-Nov </td><td> 1595 </td><td> 0 </td><td> 1621 </td><td> 0 </td><td> </td><td> </td></tr>
    <tr><td> 2026-Oct </td><td> 1590 </td><td> 7 </td><td> </td><td> </td><td> </td><td> </td></tr>
    </tbody></table>`;
  const rows = parseFideStatistics(html);
  assert.deepEqual(rows, [
    { period: "2026-11", list: "standard", rating: 1595, games: 0 },
    { period: "2026-11", list: "rapid", rating: 1621, games: 0 },
    { period: "2026-10", list: "standard", rating: 1590, games: 7 },
  ]);
});
