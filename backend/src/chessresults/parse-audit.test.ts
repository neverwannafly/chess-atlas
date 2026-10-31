import test from "node:test";
import assert from "node:assert/strict";
import { parseStartingRank, parsePlayerCardFull } from "./parse.js";

// Regression tests for the audit: the starting list has an "ID" column (Ident-Number) in front of
// "FideID" in some events, and the FIDE id must never be read from the ID column.

test("starting rank: ID column is the Ident-Number, FideID comes from the profile link", () => {
  const html = `<h2>Starting rank</h2><table class="CRs1">
    <tr class="CRng1b"><th>No.</th><th>&nbsp;</th><th></th><th>Name</th><th>ID</th><th>FideID</th><th>RtgI</th><th>sex</th><th>Typ</th><th>Gr</th><th>Club/City</th></tr>
    <tr class="CRng1 IND"><td class="CRc">4</td><td class="CR"></td><td class="CR"></td>
      <td class="CR"><a href="x.aspx?lan=1&amp;art=9&amp;fed=IND&amp;snr=4">Sample A.</a></td>
      <td class="CRr">80412021</td><td><a href="http://ratings.fide.com/profile/5029520">5029520</a></td>
      <td class="CRr">2108</td><td></td><td class="CR"></td><td class="CRc">NA</td><td class="CR">Karnataka</td></tr>
    <tr class="CRng2 IND"><td class="CRc">5</td><td class="CR"></td><td class="CR"></td>
      <td class="CR"><a href="x.aspx?snr=5">Sample B</a></td>
      <td class="CRr">838662022</td><td></td><td class="CRr">0</td><td></td><td class="CR"></td><td class="CRc">NA</td><td class="CR">Kerala</td></tr>
    </table>`;
  const rows = parseStartingRank(html);
  assert.deepEqual(rows[0], { snr: 4, name: "Sample A.", identNumber: "80412021", fideId: "5029520", fed: "IND", rating: 2108, club: "Karnataka" });
  assert.deepEqual(rows[1], { snr: 5, name: "Sample B", identNumber: "838662022", fideId: null, fed: "IND", rating: null, club: "Kerala" });
});

test("starting rank without an ID column never reads a number as a FIDE id", () => {
  const html = `<h2>Starting rank</h2><table>
    <tr><th>No.</th><th></th><th>Name</th><th>FideID</th><th>FED</th><th>Rtg</th><th>Club/City</th></tr>
    <tr><td>1</td><td></td><td><a href="x.aspx?snr=1">Demo, Meera</a></td><td></td><td>TUR</td><td>0</td><td>Ankara</td></tr></table>`;
  assert.equal(parseStartingRank(html)[0].fideId, null);
});

test("player card: identity and per-round results with colour", () => {
  const html = `<table><tr><td>Ident-Number</td><td>80412021</td></tr><tr><td>Fide-ID</td><td>5029520</td></tr>
    <tr><td>Year of birth </td><td>1993</td></tr></table>
    <table><tr><th>Rd.</th><th>Bo.</th><th>SNo</th><th></th><th>Name</th><th>RtgI</th><th>Club/City</th><th>Pts.</th><th>Res.</th></tr>
    <tr><td>1</td><td>4</td><td>85</td><td></td><td><a href="x.aspx?snr=85">Opp One</a></td><td>1547</td><td>Kerala</td><td>3</td>
      <td><table><tr><td><div class="FarbesT"></div></td><td>1</td></tr></table></td></tr>
    <tr><td>2</td><td>4</td><td>45</td><td></td><td><a href="x.aspx?snr=45">Opp Two</a></td><td>1802</td><td>TN</td><td>4</td>
      <td><table><tr><td><div class="FarbewT"></div></td><td>&frac12;</td></tr></table></td></tr></table>`;
  const card = parsePlayerCardFull(html);
  assert.equal(card.identNumber, "80412021");
  assert.equal(card.fideId, "5029520");
  assert.deepEqual(card.rounds, [
    { round: 1, board: 4, opponentSnr: 85, color: "b", result: "1" },
    { round: 2, board: 4, opponentSnr: 45, color: "w", result: "½" },
  ]);
  assert.equal(Object.keys(card).some((k) => k.toLowerCase().includes("dob") || k.toLowerCase().includes("date")), false);
});

test("round table without a start-number column still yields every game (start numbers from links)", async () => {
  const { parseRound } = await import("./parse.js");
  const html = `<table>
    <tr class="CRg2"><td class="CRc">1</td><td class="CR">GM</td><td class="IND"><a href="x.aspx?lan=1&amp;art=9&amp;snr=1">Sample One</a></td>
      <td class="CRc">2399</td><td class="CRc">0</td><td class="CRc">1 - 0</td><td class="CRc">0</td><td class="CR"></td>
      <td class="IND"><a href="x.aspx?lan=1&amp;art=9&amp;snr=175">Sample Two</a></td><td class="CRc">1512</td></tr></table>`;
  const games = parseRound(html);
  assert.equal(games.length, 1);
  assert.equal(games[0].whiteSnr, 1);
  assert.equal(games[0].blackSnr, 175);
  assert.equal(games[0].result, "1-0");
  assert.equal(games[0].whiteRating, 2399);
  assert.equal(games[0].blackRating, 1512);
});
