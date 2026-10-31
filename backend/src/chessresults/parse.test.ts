import test from "node:test";
import assert from "node:assert/strict";
import { parseAgo, parseIstStamp, parseList, parseRanking, parseRound, parseTournamentPage } from "./parse.js";

// Snippets copied in shape from real chess-results.com markup. Names are invented.

test("parseAgo understands the relative times the list shows", () => {
  assert.equal(parseAgo("2 Minutes"), 2);
  assert.equal(parseAgo("1 Hour"), 60);
  assert.equal(parseAgo("3 Days"), 4320);
  assert.equal(parseAgo("45 Seconds"), 0.75);
  assert.equal(parseAgo("—"), null);
});

test("parseIstStamp reads the tournament page 'Last update' stamp as IST", () => {
  assert.equal(parseIstStamp("31.10.2026 08:53:42"), Date.parse("2026-10-31T08:53:42+05:30"));
  assert.equal(parseIstStamp("not a date"), null);
});

test("parseList extracts id, name, federation, status and age", () => {
  const html = `
    <table>
      <tr class="CRg1"><td class="CRc">1</td><td><a href="https://chess-results.com/tnr1531024.aspx?lan=1">Bolu Cumhuriyet Bayram 10 Yas</a></td>
        <td class="CR">TUR</td><td class="CRc"><div class="tn_TUR"></div></td>
        <td class="CRnowrap"><div class="p_5"></div><small>Rp</small> 2 Minutes</td></tr>
      <tr class="CRg2"><td class="CRc">2</td><td><a href="https://chess-results.com/tnr1356330.aspx?lan=1">31 San Andres - Azkoitia 2026</a></td>
        <td class="CR">ESP</td><td class="CRc"><div class="tn_ESP"></div></td>
        <td class="CRnowrap"><div class="p_5"></div><small>Bz</small> 1 Hour</td></tr>
      <tr><td><a href="https://example.com/unrelated">not chess-results</a></td></tr>
    </table>`;
  const rows = parseList(html);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { id: "1531024", name: "Bolu Cumhuriyet Bayram 10 Yas", fed: "TUR", status: "Rp", minutesAgo: 2 });
  assert.deepEqual(rows[1], { id: "1356330", name: "31 San Andres - Azkoitia 2026", fed: "ESP", status: "Bz", minutesAgo: 60 });
});

test("parseTournamentPage reads name, round count and last update", () => {
  const html = `<html><head><title> Chess-Results Server Chess-results.com - Bolu Cumhuriyet Bayram 10 Yas </title></head>
    <body><h2>Bolu Cumhuriyet Bayram 10 Yas</h2><p>Last update 31.10.2026 08:53:42, Creator/Last Upload: Bolu TCF</p>
    <td>Board Pairings</td><td><a>Rd.1/6</a> , <a>not paired</a></td></body></html>`;
  const p = parseTournamentPage(html);
  assert.equal(p.name, "Bolu Cumhuriyet Bayram 10 Yas");
  assert.equal(p.rounds, 6);
  assert.equal(p.lastUpdateMs, Date.parse("2026-10-31T08:53:42+05:30"));
});

test("parseTournamentPage tolerates missing pieces", () => {
  const p = parseTournamentPage("<html><head><title>Chess-results.com - Plain</title></head><body></body></html>");
  assert.deepEqual(p, { name: "Plain", rounds: null, lastUpdateMs: null });
});

test("parseRound reads board, players, ratings and result", () => {
  const html = `<table>
    <tr class="CRg1"><td class="CRc">1</td><td class="CRc">27</td><td class="CR"></td>
      <td class="TUR"><a href="x.aspx?lan=1&amp;art=9&amp;fed=TUR&amp;snr=27">Ozcakir, Kuzey</a></td><td class="CRc">1006</td><td class="CRc">0</td>
      <td class="CRc">1-0</td><td class="CRc">0</td><td class="CR"></td>
      <td class="TUR"><a href="x.aspx?lan=1&amp;art=9&amp;fed=TUR&amp;snr=1">Erdem, Deniz</a></td><td class="CRc">1427</td><td class="CRc">1</td></tr>
    <tr class="CRg2"><td class="CRc">2</td><td class="CRc">3</td><td class="CR"></td>
      <td class="TUR"><a href="x.aspx?snr=3">Sensoy, Mustafa</a></td><td class="CRc">1371</td><td class="CRc">0</td>
      <td class="CRc"></td><td class="CRc">0</td><td class="CR"></td>
      <td class="TUR"><a href="x.aspx?snr=4">Akay, Burak</a></td><td class="CRc">1328</td><td class="CRc">4</td></tr>
    <tr><td>header row without links</td></tr>
  </table>`;
  const games = parseRound(html);
  assert.equal(games.length, 2);
  assert.deepEqual(games[0], {
    match: 1, board: 1, whiteSnr: 27, whiteName: "Ozcakir, Kuzey", whiteFed: "TUR", whiteRating: 1006,
    blackSnr: 1, blackName: "Erdem, Deniz", blackFed: "TUR", blackRating: 1427, result: "1-0",
  });
  assert.equal(games[1].result, null, "unplayed board has no result");
  assert.equal(games[1].blackRating, 1328);
});

test("parseRanking reads rank, name, federation, rating, club, points and tiebreaks", () => {
  const html = `<table>
    <tr><td>Rk.</td><td>SNo</td><td>Name</td><td>FED</td><td>Rtg</td><td>Club/City</td><td>Pts.</td><td>TB1</td></tr>
    <tr class="CRg2 TUR"><td class="CRc">1</td><td class="CRc">1</td><td class="CR"></td>
      <td class="CR"><a href="x.aspx?art=9&amp;snr=1">Erdem, Deniz</a></td><td class="CR">TUR</td><td class="CRr">1427</td>
      <td class="CR">Ankara</td><td class="CRc">3.5</td><td class="CRc">7</td></tr>
    <tr class="CRg1 TUR"><td class="CRc">2</td><td class="CRc">2</td><td class="CR"></td>
      <td class="CR"><a href="x.aspx?art=9&amp;snr=2">Ekiz, Bertug</a></td><td class="CR">TUR</td><td class="CRr">1398</td>
      <td class="CR">Ankara</td><td class="CRc">3</td><td class="CRc">6.5</td></tr>
  </table>`;
  const rows = parseRanking(html);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { rank: 1, snr: 1, name: "Erdem, Deniz", fed: "TUR", rating: 1427, club: "Ankara", points: 3.5, tiebreaks: [7] });
  assert.equal(rows[1].points, 3);
});

test("parseRound reads results printed with spaces and treats rating 0 as unknown", () => {
  const html = `<table>
    <tr><td class="CRc">1</td><td class="CRc">19</td><td class="CR"></td><td class="IND"><a href="x.aspx?snr=19">Krishvanth, P C</a></td>
      <td class="CRc">0</td><td class="CRc">0</td><td class="CRc">0 - 1</td><td class="CRc">0</td><td class="CR"></td>
      <td class="IND"><a href="x.aspx?snr=1">Aadhikesavan, U V</a></td><td class="CRc">0</td><td class="CR"></td><td class="CRc">1</td></tr>
  </table>`;
  const [g] = parseRound(html);
  assert.equal(g.result, "0-1");
  assert.equal(g.whiteRating, null);
  assert.equal(g.blackRating, null);
  assert.equal(g.blackSnr, 1);
});

test("parseRanking maps columns from the header when a table has no club column", () => {
  const html = `<table>
    <tr><td>Rk.</td><td>SNo</td><td>&nbsp;</td><td>&nbsp;</td><td>Name</td><td>FED</td><td>Rtg</td><td>Pts.</td><td>&nbsp;TB1&nbsp;</td><td>&nbsp;TB2&nbsp;</td></tr>
    <tr class="CRng2 IND"><td class="CRc">1</td><td class="CRc">5</td><td class="CR"></td><td class="CR"></td>
      <td class="CR"><a href="x.aspx?snr=5">Akshith, T A</a></td><td class="CR">IND</td><td class="CRr">0</td>
      <td class="CRc">3</td><td class="CRc">5</td><td class="CRc">5</td></tr>
  </table>`;
  const [r] = parseRanking(html);
  assert.deepEqual(r, { rank: 1, snr: 5, name: "Akshith, T A", fed: "IND", rating: null, club: null, points: 3, tiebreaks: [5, 5] });
});

test("parseRound numbers team matches when boards restart at 1", () => {
  const row = (board: number, w: number, b: number) =>
    `<tr><td class="CRc">${board}</td><td class="CRc">${w}</td><td class="CR"></td><td><a href="x.aspx?snr=${w}">P${w}</a></td>
     <td class="CRc">0 - 0</td><td class="CR"></td><td><a href="x.aspx?snr=${b}">P${b}</a></td><td class="CRc">${b}</td></tr>`;
  const html = `<table>${[row(1, 1, 11), row(2, 2, 12), row(1, 3, 13), row(2, 4, 14)].join("")}</table>`;
  const games = parseRound(html);
  assert.deepEqual(games.map((g) => [g.match, g.board]), [[1, 1], [1, 2], [2, 1], [2, 2]]);
});

test("parseStartingRank reads FIDE ids from the starting-rank table and tolerates blanks", async () => {
  const { parseStartingRank } = await import("./parse.js");
  const html = `<html><body><h2>Starting rank</h2>
    <table class="CRs1"><tr class="CRg1b"><th>No.</th><th></th><th>Name</th><th>FideID</th><th>FED</th><th>Rtg</th><th>Club/City</th></tr>
    <tr class="CRg2 TUR"><td class="CRc">1</td><td class="CR"></td><td class="CR"><a href="x.aspx?art=9&amp;snr=1">Sample, Ravi</a></td>
      <td><a href="http://ratings.fide.com/profile/525057278" target="_blank">525057278</a></td><td class="CR">TUR</td><td class="CRr">1427</td><td class="CR">Ankara</td></tr>
    <tr class="CRg1 TUR"><td class="CRc">2</td><td class="CR"></td><td class="CR"><a href="x.aspx?art=9&amp;snr=2">Demo, Meera</a></td>
      <td></td><td class="CR">TUR</td><td class="CRr">0</td><td class="CR"></td></tr>
    </table>
    <h2>Pairings</h2><table><tr><td><a href="x.aspx?snr=99">Not a starting-rank row</a></td></tr></table></body></html>`;
  const rows = parseStartingRank(html);
  assert.deepEqual(rows, [
    { snr: 1, name: "Sample, Ravi", identNumber: null, fideId: "525057278", fed: "TUR", rating: 1427, club: "Ankara" },
    { snr: 2, name: "Demo, Meera", identNumber: null, fideId: null, fed: "TUR", rating: null, club: null },
  ]);
});

test("parsePlayerCard reads Ident-Number, Fide-ID and year of birth (year only)", async () => {
  const { parsePlayerCard } = await import("./parse.js");
  const html = `<table class="CRs1">
    <tr><td class="CR">Name</td><td class="CR">Sample Player</td></tr>
    <tr><td class="CR">Ident-Number</td><td class="CR">1234567890</td></tr>
    <tr><td class="CR">Fide-ID</td><td class="CR">33000001</td></tr>
    <tr><td class="CR">Year of birth </td><td class="CR">2010</td></tr></table>`;
  const card = parsePlayerCard(html);
  assert.deepEqual(card, { identNumber: "1234567890", fideId: "33000001", birthYear: 2010 });
  assert.deepEqual(parsePlayerCard("<table><tr><td>Ident-Number</td><td></td></tr></table>"), { identNumber: null, fideId: null, birthYear: null });
});
