import * as cheerio from "cheerio";

// The FIDE profile statistics page (ratings.fide.com/profile/<id>/statistics) carries a server-rendered
// monthly table: period, standard rating and games, rapid rating and games, blitz rating and games.
// Only that table is read. The page's chart data is filled in by JavaScript and is not used.

export interface FideMonthRow {
  period: string; // YYYY-MM
  list: "standard" | "rapid" | "blitz";
  rating: number | null;
  games: number | null;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** "2026-Nov" -> "2026-11"; anything else -> null. */
export function fidePeriod(raw: string): string | null {
  const m = /^(\d{4})-([A-Za-z]{3})$/.exec(raw.trim());
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[1]}-${MONTHS[m[2]]}`;
}

const num = (s: string): number | null => {
  const t = s.replace(/\s+/g, "");
  return /^\d+$/.test(t) ? Number(t) : null;
};

export function parseFideStatistics(html: string): FideMonthRow[] {
  const $ = cheerio.load(html);
  const rows: FideMonthRow[] = [];
  $("table.profile-table_calc tbody tr").each((_, tr) => {
    const cells = $(tr).children("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    if (cells.length < 7) return;
    const period = fidePeriod(cells[0]);
    if (!period) return;
    const lists = [
      { list: "standard" as const, rating: num(cells[1]), games: num(cells[2]) },
      { list: "rapid" as const, rating: num(cells[3]), games: num(cells[4]) },
      { list: "blitz" as const, rating: num(cells[5]), games: num(cells[6]) },
    ];
    for (const l of lists) {
      // A list with no rating and no games that month is not recorded.
      if (l.rating === null && l.games === null) continue;
      rows.push({ period, ...l });
    }
  });
  return rows;
}
