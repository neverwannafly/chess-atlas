import * as cheerio from "cheerio";
import { CrClient } from "./client.js";

// Discovery of ALL Indian tournaments on chess-results.com through the tournament search
// (turniersuche.aspx, an ASP.NET WebForms page). See docs/CHESS_RESULTS_ARCHIVE.md.
//
// The search returns at most MAX_LINES rows per query and has no pager, so date windows are
// bisected until every window comes back below the cap.

export interface ArchiveRow {
  id: string;
  name: string;
  /** ISO YYYY-MM-DD */
  startDate: string | null;
  /** ISO YYYY-MM-DD */
  endDate: string | null;
  location: string | null;
  timeControl: string | null;
  /** True when the tournament's end date is before today (the search itself has no status column). */
  finished: boolean;
  /** Indian state as shown in the "State" column (English part only), when present. */
  state?: string | null;
}

export const SEARCH_PATH = "turniersuche.aspx?lan=1";
/** Option value of "2000" in the "Maximum number of lines" select; the largest choice. */
const MAX_LINES_OPTION = "5";
export const MAX_LINES = 2000;

const F = "ctl00$P1$";

export interface HiddenFields {
  fields: Record<string, string>;
  /** Form action resolved against `base`, or null if the page has no form. */
  action: string | null;
}

/** Collect the ASP.NET hidden inputs (__VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION, ...) to echo back. */
export function extractHiddenFields(html: string, base = "https://chess-results.com/"): HiddenFields {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr("name");
    if (name) fields[name] = $(el).attr("value") ?? "";
  });
  const action = $("form").first().attr("action");
  return { fields, action: action ? new URL(action, base).toString() : null };
}

/** "2026/10/31" -> "2026-10-31"; anything else -> null. */
export function crDateToIso(s: string): string | null {
  const m = s.trim().match(/^(\d{4})[/.-](\d{2})[/.-](\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

const text = ($: cheerio.CheerioAPI, el: unknown) =>
  $(el as never).text().replace(/\s+/g, " ").trim();

export interface ParsedResults {
  rows: ArchiveRow[];
  /** True when the page says the output was cut off at the line limit. */
  truncated: boolean;
  /** True when a results table with the expected header was found (possibly with zero rows). */
  hasTable: boolean;
}

/** Parse the result table of a search response. `today` (ISO) decides `finished`. */
export function parseArchiveResultsFull(html: string, today = new Date().toISOString().slice(0, 10)): ParsedResults {
  const $ = cheerio.load(html);
  const truncated = /output is limited to \d+ lines/i.test($.root().text());
  let table: cheerio.Cheerio<never> | null = null;
  $("table").each((_, t) => {
    const head = $(t).find("tr").first().children("td,th").map((__, c) => text($, c)).get();
    if (head.includes("Tournament") && head.includes("from") && head.includes("to")) {
      table = $(t) as never;
      return false;
    }
  });
  if (!table) return { rows: [], truncated, hasTable: false };
  const trs = (table as cheerio.Cheerio<never>).find("tr");
  const head = trs.first().children("td,th").map((_, c) => text($, c)).get();
  const col = (name: string) => head.indexOf(name);
  const iName = col("Tournament"), iFrom = col("from"), iTo = col("to");
  const iLoc = col("Location"), iTc = col("Time control"), iState = col("State");
  const rows: ArchiveRow[] = [];
  trs.slice(1).each((_, tr) => {
    const tds = $(tr).children("td");
    const a = tds.eq(iName).find("a").first();
    const id = (a.attr("href") ?? "").match(/tnr(\d+)\.aspx/i)?.[1];
    if (!id) return;
    const cell = (i: number) => (i >= 0 ? text($, tds.get(i)) || null : null);
    const endDate = crDateToIso(cell(iTo) ?? "");
    const state = cell(iState)?.split(" / ")[0]?.trim() || null;
    rows.push({
      id,
      name: text($, a),
      startDate: crDateToIso(cell(iFrom) ?? ""),
      endDate,
      location: cell(iLoc),
      timeControl: cell(iTc),
      finished: endDate !== null && endDate < today,
      state,
    });
  });
  return { rows, truncated, hasTable: true };
}

export function parseArchiveResults(html: string, today?: string): ArchiveRow[] {
  return parseArchiveResultsFull(html, today).rows;
}

export function buildSearchForm(hidden: Record<string, string>, p: { from: string; to: string; art?: string }): URLSearchParams {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) f.set(k, v);
  f.set(F + "combo_art", p.art ?? "5"); // 5 = all tournaments
  f.set(F + "combo_sort", "4"); // end date
  f.set(F + "combo_land", "IND");
  f.set(F + "combo_bedenkzeit", "0");
  f.set(F + "combo_anzahl_zeilen", MAX_LINES_OPTION);
  f.set(F + "txt_von_tag", p.from);
  f.set(F + "txt_bis_tag", p.to);
  f.set(F + "cb_suchen", "Search");
  return f;
}

const dayMs = 86_400_000;
const toMs = (iso: string) => Date.parse(iso + "T00:00:00Z");
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Fetch every Indian tournament whose end date lies in [from, to] (YYYY-MM-DD, inclusive). */
export async function fetchIndiaArchive(opts: {
  from: string;
  to: string;
  client?: CrClient;
  /** Override "today" (ISO) used for the finished flag; for tests. */
  today?: string;
}): Promise<ArchiveRow[]> {
  const { from, to } = opts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    throw new Error(`fetchIndiaArchive: bad window ${from}..${to}`);
  }
  const client = opts.client ?? new CrClient();
  const today = opts.today ?? new Date().toISOString().slice(0, 10);

  // GET once: the server redirects to a node host (s2/s3...), and the POST must go to that host,
  // otherwise the redirect turns the POST into a GET and the form is silently ignored.
  const page = await client.get(SEARCH_PATH);
  const base = client.lastUrl ?? undefined;
  let hidden = extractHiddenFields(page, base);
  if (!hidden.action || !hidden.fields.__VIEWSTATE) throw new Error("chess-results search form not found (no __VIEWSTATE)");

  const byId = new Map<string, ArchiveRow>();

  const search = async (a: string, b: string, art?: string): Promise<ParsedResults> => {
    const html = await client.post(hidden.action!, buildSearchForm(hidden.fields, { from: a, to: b, art }));
    const res = parseArchiveResultsFull(html, today);
    if (!res.hasTable) {
      // A genuine empty result has no table, but the page still carries the form with our echoed values.
      const echoed = cheerio.load(html)(`select[name="${F}combo_land"] option[selected]`).attr("value");
      if (echoed !== "IND") throw new Error(`chess-results search ${a}..${b}: response has neither results nor the echoed form`);
    }
    const next = extractHiddenFields(html, hidden.action!);
    if (next.fields.__VIEWSTATE) hidden = { fields: next.fields, action: hidden.action };
    return res;
  };

  const add = (rows: ArchiveRow[]) => rows.forEach((r) => byId.set(r.id, r));

  const run = async (a: string, b: string): Promise<void> => {
    const res = await search(a, b);
    const capped = res.truncated || res.rows.length >= MAX_LINES;
    if (!capped) return add(res.rows);
    if (a < b) {
      const mid = toIso(Math.floor((toMs(a) + toMs(b)) / 2 / dayMs) * dayMs);
      await run(a, mid);
      await run(toIso(toMs(mid) + dayMs), b);
      return;
    }
    // A single day above the cap: split by tournament type (0..3) to get below it.
    add(res.rows);
    for (const art of ["0", "1", "2", "3"]) {
      const sub = await search(a, a, art);
      if (sub.truncated || sub.rows.length >= MAX_LINES) {
        throw new Error(`chess-results: ${a} still exceeds ${MAX_LINES} rows for tournament type ${art}; cannot enumerate`);
      }
      add(sub.rows);
    }
  };

  await run(from, to);
  return [...byId.values()];
}
