import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchForm, crDateToIso, extractHiddenFields, fetchIndiaArchive, parseArchiveResults, parseArchiveResultsFull } from "./archive.js";
import type { CrClient } from "./client.js";

const HEAD =
  '<tr class="CRg1b"><td class="CR">No.</td><td class="CR">Tournament</td><th class="CR">FED</th><th class="CRc">flag</th>' +
  '<td class="CRnowrap">Last update</td><th class="CRc">from</th><th class="CRc">to</th><td class="CR">Organizer(s)</td>' +
  '<td class="CR">Location</td><td class="CR">Time control</td><td class="CR">State</td><td class="CRc">n</td></tr>';

function row(i: number, id: string, name: string, from: string, to: string, loc: string, tc: string, state: string) {
  return (
    `<tr class="CRg${(i % 2) + 1}"><td class="CRc">${i}</td><td class="CRnowrap"><a href="tnr${id}.aspx?lan=1">${name}</a></td>` +
    `<td class="CR">IND</td><td class="CRc"><div class="tn_IND"></div></td><td>2 Days</td><td class="CRc">${from}</td><td class="CRc">${to}</td>` +
    `<td>Org</td><td>${loc}</td><td>${tc}</td><td>${state}</td><td class="CRc">12</td></tr>`
  );
}

const form = (selected: string) =>
  `<form method="post" action="./turniersuche.aspx?lan=1&amp;SNode=S0" id="form1">
   <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="vs1==" />
   <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="ABC" />
   <input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="ev1==" />
   <select name="ctl00$P1$combo_land"><option value="">-</option><option ${selected} value="IND">India</option></select>`;

const page = (rows: string, extra = "") =>
  form('selected="selected"') + `<table class="CRs2">${HEAD}${rows}</table>${extra}</form>`;

test("crDateToIso", () => {
  assert.equal(crDateToIso("2026/10/31"), "2026-10-31");
  assert.equal(crDateToIso(" "), null);
  assert.equal(crDateToIso("31.10.2026"), null);
});

test("extractHiddenFields echoes ASP.NET state and resolves the action", () => {
  const h = extractHiddenFields(form(""), "https://s3.chess-results.com/turniersuche.aspx?lan=1");
  assert.equal(h.fields.__VIEWSTATE, "vs1==");
  assert.equal(h.fields.__EVENTVALIDATION, "ev1==");
  assert.equal(h.action, "https://s3.chess-results.com/turniersuche.aspx?lan=1&SNode=S0");
});

test("buildSearchForm sets country, window and max lines", () => {
  const f = buildSearchForm({ __VIEWSTATE: "x" }, { from: "2020-01-01", to: "2020-01-31" });
  assert.equal(f.get("ctl00$P1$combo_land"), "IND");
  assert.equal(f.get("ctl00$P1$txt_von_tag"), "2020-01-01");
  assert.equal(f.get("ctl00$P1$txt_bis_tag"), "2020-01-31");
  assert.equal(f.get("ctl00$P1$combo_anzahl_zeilen"), "5");
  assert.equal(f.get("__VIEWSTATE"), "x");
});

test("parseArchiveResults reads rows by header name", () => {
  const html = page(
    row(1, "100001", "Sample Open 2026", "2026/10/30", "2026/10/31", "Hall A, Testville", "15 min + 5 sec", "Goa / &#2327;&#2379;&#2310;") +
      row(2, "100002", "Old Rapid", "2019/01/05", "2019/01/05", "", "", ""),
  );
  const rows = parseArchiveResults(html, "2026-10-31");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    id: "100001",
    name: "Sample Open 2026",
    startDate: "2026-10-30",
    endDate: "2026-10-31",
    location: "Hall A, Testville",
    timeControl: "15 min + 5 sec",
    finished: false,
    state: "Goa",
  });
  assert.equal(rows[1].finished, true);
  assert.equal(rows[1].location, null);
  assert.equal(rows[1].state, null);
});

test("parseArchiveResultsFull flags truncation and missing table", () => {
  const t = parseArchiveResultsFull(page(row(1, "1", "A", "2020/01/01", "2020/01/01", "", "", ""), "<div>The output is limited to 2000 lines.</div>"));
  assert.equal(t.truncated, true);
  const none = parseArchiveResultsFull("<html><body>error</body></html>");
  assert.equal(none.hasTable, false);
});

function fakeClient(posts: string[]) {
  const seen: URLSearchParams[] = [];
  const client = {
    lastUrl: "https://s2.chess-results.com/turniersuche.aspx?lan=1&SNode=S0",
    get: async () => form(""),
    post: async (_url: string, f: URLSearchParams) => {
      seen.push(f);
      const next = posts.shift();
      if (next === undefined) throw new Error("unexpected post");
      return next;
    },
  };
  return { client: client as unknown as CrClient, seen };
}

test("fetchIndiaArchive bisects a capped window and de-duplicates", async () => {
  const many = Array.from({ length: 2000 }, (_, i) => row(i, String(200000 + i), "X", "2020/01/01", "2020/01/10", "", "", "")).join("");
  const a = page(row(1, "1", "A", "2020/01/01", "2020/01/02", "", "", ""));
  const b = page(row(1, "1", "A", "2020/01/01", "2020/01/02", "", "", "") + row(2, "2", "B", "2020/01/20", "2020/01/20", "", "", ""));
  const { client, seen } = fakeClient([page(many), a, b]);
  const rows = await fetchIndiaArchive({ from: "2020-01-01", to: "2020-01-31", client });
  assert.deepEqual(rows.map((r) => r.id).sort(), ["1", "2"]);
  assert.equal(seen[1].get("ctl00$P1$txt_bis_tag"), "2020-01-16");
  assert.equal(seen[2].get("ctl00$P1$txt_von_tag"), "2020-01-17");
  assert.equal(seen[1].get("__VIEWSTATE"), "vs1==");
});

test("fetchIndiaArchive returns [] for a valid empty result", async () => {
  const { client } = fakeClient([form('selected="selected"') + "</form>"]);
  assert.deepEqual(await fetchIndiaArchive({ from: "1990-01-01", to: "1990-01-02", client }), []);
});

test("fetchIndiaArchive throws on a response that is neither results nor the echoed form", async () => {
  const { client } = fakeClient(["<html><body>Server busy</body></html>"]);
  await assert.rejects(fetchIndiaArchive({ from: "2020-01-01", to: "2020-01-02", client }), /neither results/);
});
