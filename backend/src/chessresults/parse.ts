import * as cheerio from "cheerio";

// Parsers for chess-results.com pages. The site is server-rendered ASP.NET, so plain HTML parsing
// is enough. Every parser returns plain data and never throws on odd markup: a missing piece is
// null or an empty array, and the caller decides what to do with it.

export interface ListRow {
  id: string;
  name: string;
  fed: string | null;
  status: string | null;
  /** Minutes since the tournament last uploaded, as shown on the list page. */
  minutesAgo: number | null;
}

export interface TournamentPage {
  name: string;
  rounds: number | null;
  /** Epoch ms of the "Last update" timestamp shown on the tournament page (IST). */
  lastUpdateMs: number | null;
}

export interface GameRow {
  /** Team match number within the round (1 for individual events). Boards restart at 1 for each team match. */
  match: number;
  board: number;
  whiteSnr: number | null;
  whiteName: string;
  whiteFed: string | null;
  whiteRating: number | null;
  blackSnr: number | null;
  blackName: string;
  blackFed: string | null;
  blackRating: number | null;
  result: string | null;
}

export interface StandingRow {
  rank: number;
  snr: number;
  name: string;
  fed: string | null;
  rating: number | null;
  club: string | null;
  points: number | null;
  tiebreaks: number[];
}

const TNR_HREF = /tnr(\d+)\.aspx/i;
const RESULT_RE = /^(1-0|0-1|½-½|1\/2-1\/2|0-0|\+-|-\+)$/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function toInt(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = /-?\d+/.exec(s);
  return m ? Number(m[0]) : null;
}

/** Round rows carry the federation as the name cell's CSS class, e.g. class="IND". */
function fedOf(td: cheerio.Cheerio<any>): string | null {
  const cls = (td.attr("class") ?? "").trim();
  return /^[A-Z]{3}$/.test(cls) ? cls : null;
}

/** Chess-results prints 0 for unrated players; the contract wants null for unknown. */
function rating(s: string | undefined | null): number | null {
  const n = toInt(s);
  return n && n > 0 ? n : null;
}

function toNumber(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(clean(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "2 Minutes", "1 Hour", "3 Days" → minutes. Null when the text has no relative time. */
export function parseAgo(text: string): number | null {
  const m = /(\d+)\s*(second|minute|hour|day)s?/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const perUnit = unit === "second" ? 1 / 60 : unit === "minute" ? 1 : unit === "hour" ? 60 : 1440;
  return n * perUnit;
}

/** "31.10.2026 08:53:42" (Indian Standard Time) → epoch ms. */
export function parseIstStamp(s: string): number | null {
  const m = /(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi, ss] = m;
  const ms = Date.parse(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+05:30`);
  return Number.isFinite(ms) ? ms : null;
}

/** Tournament rows on the home page (current, running and recently finished events). */
export function parseList(html: string): ListRow[] {
  const $ = cheerio.load(html);
  const out = new Map<string, ListRow>();
  $("tr").each((_, tr) => {
    const link = $(tr).find('a[href*="tnr"]').first();
    const m = TNR_HREF.exec(link.attr("href") ?? "");
    if (!m || out.has(m[1])) return;
    const nameCell = link.closest("td");
    const fed = clean(nameCell.next("td").text());
    const lastCell = $(tr).children("td").last();
    out.set(m[1], {
      id: m[1],
      name: clean(link.text()),
      fed: /^[A-Z]{2,3}$/.test(fed) ? fed : null,
      status: clean($(tr).find("small").first().text()) || null,
      minutesAgo: parseAgo(lastCell.text()),
    });
  });
  return [...out.values()];
}

/** Name, round count and last-update stamp from a tournament's main page. */
export function parseTournamentPage(html: string): TournamentPage {
  const $ = cheerio.load(html);
  const title = clean($("title").text());
  const name = clean(title.replace(/^.*?chess-results\.com\s*-\s*/i, "")) || title;
  const text = clean($("body").text());
  const rounds = toInt(/Rd\.\s*\d+\s*\/\s*(\d+)/.exec(text)?.[1]);
  const stamp = /Last update\s+(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}:\d{2})/.exec(text)?.[1];
  return { name, rounds, lastUpdateMs: stamp ? parseIstStamp(stamp) : null };
}

/** Board-level results for one round (the "Board Pairings" view). */
export function parseRound(html: string): GameRow[] {
  const $ = cheerio.load(html);
  const games: GameRow[] = [];
  let match = 1;
  let prevBoard = 0;
  $("tr").each((_, tr) => {
    const links = $(tr).find('a[href*="snr="]');
    if (links.length !== 2) return;
    const tds = $(tr).children("td");
    const cells = tds.toArray();
    const wIdx = tds.index(links.eq(0).closest("td"));
    const bIdx = tds.index(links.eq(1).closest("td"));
    if (wIdx < 0 || bIdx < 0) return;
    const text = (i: number) => clean($(cells[i]).text());
    const board = toInt(text(0));
    if (board === null) return;
    if (board <= prevBoard) match++;
    prevBoard = board;
    // Results are printed as "1 - 0" in the page, so compare with spaces removed.
    const result = cells.map((_, i) => text(i).replace(/\s+/g, "")).find((t) => RESULT_RE.test(t)) ?? null;
    // Start numbers come from the player links: some events put a title column in front of the name
    // and no start-number column, so a fixed column position silently drops every game.
    const snrOf = (href: string | undefined) => toInt(/snr=(\d+)/.exec(href ?? "")?.[1]);
    games.push({
      match,
      board,
      whiteSnr: snrOf(links.eq(0).attr("href")),
      whiteName: clean(links.eq(0).text()),
      whiteFed: fedOf($(cells[wIdx])),
      whiteRating: rating(text(wIdx + 1)),
      blackSnr: snrOf(links.eq(1).attr("href")),
      blackName: clean(links.eq(1).text()),
      blackFed: fedOf($(cells[bIdx])),
      blackRating: rating(text(bIdx + 1)),
      result: result ? result.replace("1/2-1/2", "½-½") : null,
    });
  });
  return games;
}

type Field = "rank" | "snr" | "name" | "fed" | "rating" | "club" | "points" | "tb";

/** Maps a header cell's label to a standings field; "TBn" columns keep their order. */
function fieldOf(label: string): Field | null {
  const t = label.toLowerCase().replace(/&nbsp;|\s/g, "").replace(/\.$/, "");
  if (t === "rk" || t === "rank") return "rank";
  if (t === "sno" || t === "snr" || t === "no") return "snr";
  if (t === "name") return "name";
  if (t === "fed") return "fed";
  if (t === "rtg" || t === "rating" || t === "elo") return "rating";
  if (t.startsWith("club")) return "club";
  if (t === "pts" || t === "pt") return "points";
  if (/^tb\d*$/.test(t)) return "tb";
  return null;
}

/**
 * Standings ("Rk. / SNo / Name / FED / Rtg / Club / Pts. / TB1..") for a tournament.
 * Columns differ between tournaments (some have no club), so they are mapped from the header row.
 */
export function parseRanking(html: string): StandingRow[] {
  const $ = cheerio.load(html);
  const headerCols = findHeader($);
  const rows: StandingRow[] = [];
  $("tr").each((_, tr) => {
    const links = $(tr).find('a[href*="snr="]');
    if (links.length === 0) return;
    const tds = $(tr).children("td");
    const cells = tds.toArray();
    const nameIdx = tds.index(links.eq(0).closest("td"));
    if (nameIdx < 1) return;
    const text = (i: number | undefined) => (i !== undefined && i < cells.length ? clean($(cells[i]).text()) : "");

    // Fallback layout (no header found): rank, snr, [title], name, fed, rating, club, points, tiebreaks.
    const col = headerCols ?? { rank: 0, snr: 1, fed: 1, rating: 2, club: 3, points: 4, tb: [5, 6, 7] };
    const at = (rel: number | undefined) => (rel === undefined ? "" : text(nameIdx + rel));
    const rank = toInt(text(col.rank));
    const snr = toInt(text(col.snr));
    if (rank === null || snr === null) return;
    rows.push({
      rank,
      snr,
      name: clean(links.eq(0).text()),
      fed: at(col.fed) || null,
      rating: rating(at(col.rating)),
      club: at(col.club) || null,
      points: toNumber(at(col.points)),
      tiebreaks: col.tb.map((rel) => toNumber(at(rel)) ?? 0),
    });
  });
  return rows;
}

/** Column offsets. rank/snr sit at fixed positions; everything else is relative to the name cell. */
interface StandingsColumns {
  rank: number;
  snr: number;
  fed?: number;
  rating?: number;
  club?: number;
  points?: number;
  tb: number[];
}

function findHeader($: cheerio.CheerioAPI): StandingsColumns | null {
  let found: StandingsColumns | null = null;
  $("tr").each((_, tr) => {
    if (found) return;
    const labels = $(tr).children("td,th").toArray().map((c) => $(c).text());
    const fields = labels.map(fieldOf);
    if (!fields.includes("name") || !fields.includes("points")) return;
    const nameAt = fields.indexOf("name");
    const rel = (f: Field) => (fields.indexOf(f) >= 0 ? fields.indexOf(f) - nameAt : undefined);
    found = {
      rank: Math.max(0, fields.indexOf("rank")),
      snr: fields.indexOf("snr") >= 0 ? fields.indexOf("snr") : 1,
      fed: rel("fed"),
      rating: rel("rating"),
      club: rel("club"),
      points: rel("points"),
      tb: fields.flatMap((f, i) => (f === "tb" ? [i - nameAt] : [])),
    };
  });
  return found;
}

export interface StartingRankRow {
  snr: number;
  name: string;
  /** chess-results Ident-Number, when the table has an ID column. */
  identNumber: string | null;
  /** FIDE id from the profile link or FideID column; null when the player has none. */
  fideId: string | null;
  fed: string | null;
  rating: number | null;
  club: string | null;
}

/**
 * The "Starting rank" table on a tournament's main page. Columns are read from the header row, because
 * the layout differs between events: some have an "ID" column (the chess-results Ident-Number) in front
 * of "FideID", others do not. A FIDE id is taken only from its ratings.fide.com profile link, or from
 * a column headed FideID; the Ident-Number is taken only from a column headed ID. Anything else is null.
 */
export function parseStartingRank(html: string): StartingRankRow[] {
  const $ = cheerio.load(html);
  const heading = $("h2").filter((_, h) => clean($(h).text()).toLowerCase() === "starting rank").first();
  const table = heading.length ? heading.nextAll("table").first() : $("table").first();
  const header = table.find("tr").first().children("th,td").toArray().map((c) => clean($(c).text()).toLowerCase());
  const col = (label: string) => header.findIndex((h) => h === label);
  const idCol = col("id");
  const fideCol = col("fideid");
  const ratingCol = header.findIndex((h) => h === "rtgi" || h === "rtg" || h === "rating");
  const clubCol = header.findIndex((h) => h.startsWith("club"));
  const rows: StartingRankRow[] = [];
  table.find("tr").each((_, tr) => {
    const link = $(tr).find('a[href*="snr="]').first();
    if (link.length === 0) return;
    const tds = $(tr).children("td");
    const nameIdx = tds.index(link.closest("td"));
    if (nameIdx < 1) return;
    const text = (i: number) => (i >= 0 && i < tds.length ? clean($(tds[i]).text()) : "");
    const snr = toInt(text(0));
    if (snr === null) return;
    // FIDE id: prefer the profile link; fall back to the FideID column.
    const fideLink = tds.toArray().map((td) => $(td).find('a[href*="ratings.fide.com"]').attr("href") ?? "")
      .map((href) => /profile\/(\d{5,9})/.exec(href)?.[1]).find((x) => x);
    const fideCell = fideCol >= 0 ? text(fideCol) : "";
    const fideId = fideLink ?? (/^\d{5,9}$/.test(fideCell) ? fideCell : null);
    const identCell = idCol >= 0 ? text(idCol) : "";
    // Federation: its own column when the table has one; otherwise the row's class (e.g. "CRng2 IND").
    const fedHeader = col("fed");
    const fedCell = fedHeader >= 0 ? text(fedHeader) : "";
    const fedClass = /\b([A-Z]{3})\b/.exec($(tr).attr("class") ?? "")?.[1] ?? "";
    rows.push({
      snr,
      name: clean(link.text()),
      identNumber: /^\d{1,14}$/.test(identCell) ? identCell : null,
      fideId,
      fed: /^[A-Z]{3}$/.test(fedCell) ? fedCell : fedClass || null,
      rating: rating(text(ratingCol >= 0 ? ratingCol : nameIdx + 3)),
      club: clubCol >= 0 ? text(clubCol) || null : null,
    });
  });
  return rows;
}

export interface CardRound {
  round: number;
  board: number | null;
  opponentSnr: number | null;
  /** "w" or "b" from the colour icon; null if not shown. */
  color: "w" | "b" | null;
  /** Score as printed from this player's side: "1", "½", "0", or "" if not played yet. */
  result: string;
}

export interface PlayerCardFull extends PlayerCard {
  rounds: CardRound[];
}

/**
 * Full player card: identity (Ident-Number, Fide-ID) and the per-round results for this event.
 * "Year of birth" is still not read (see docs/DECISIONS.md, decision 8).
 */
export function parsePlayerCardFull(html: string): PlayerCardFull {
  const $ = cheerio.load(html);
  const identity = parsePlayerCard(html);
  const rounds: CardRound[] = [];
  $("tr").each((_, tr) => {
    const cells = $(tr).children("td");
    if (cells.length < 8) return;
    const round = toInt(clean($(cells[0]).text()));
    const opp = $(tr).find('a[href*="snr="]').first();
    if (round === null || opp.length === 0) return;
    const colorIcon = $(tr).find("div[class*='Farbe']").first().attr("class") ?? "";
    const color: "w" | "b" | null = /FarbewT|Farbew/.test(colorIcon) ? "w" : /FarbesT|Farbes/.test(colorIcon) ? "b" : null;
    const snr = toInt(/snr=(\d+)/.exec(opp.attr("href") ?? "")?.[1]);
    rounds.push({
      round,
      board: toInt(clean($(cells[1]).text())),
      opponentSnr: snr,
      color,
      result: clean($(tr).find("td").last().text()),
    });
  });
  return { ...identity, rounds };
}

export interface PlayerCard {
  /** chess-results' own player number, stable across events. */
  identNumber: string | null;
  /** FIDE id from the card's "Fide-ID" row; null when the card shows none. */
  fideId: string | null;
  /** Year of birth from the card's "Year of birth" row (year only; the card gives no full date). */
  birthYear: number | null;
}

/** Identity from the player card (art=9&snr=N): Ident-Number, Fide-ID and year of birth. */
export function parsePlayerCard(html: string): PlayerCard {
  const $ = cheerio.load(html);
  const value = (label: string): string | null => {
    const row = $("tr").filter((_, tr) => clean($(tr).children("td,th").first().text()).toLowerCase() === label).first();
    const v = clean(row.children("td,th").eq(1).text());
    return v || null;
  };
  const ident = value("ident-number");
  const fide = value("fide-id");
  const year = value("year of birth");
  return {
    identNumber: ident && /^\d{1,14}$/.test(ident) ? ident : null,
    fideId: fide && /^\d{5,9}$/.test(fide) ? fide : null,
    birthYear: year && /^(19|20)\d{2}$/.test(year) ? Number(year) : null,
  };
}
