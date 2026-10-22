import * as cheerio from "cheerio";
import type { ScrapedEvent } from "../types/event.js";
import { addDays, parseDate } from "../lib/dates.js";
import { upsertScrapedEvent, setMeta, getMeta } from "../db/events.js";

export const AICF_EVENTS_URL = "https://aicf.in/all-events/";
const MAX_EVENT_DAYS = 60;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ChessAtlasBot/1.0";

export async function fetchHtml(url = AICF_EVENTS_URL, attempts = 4, timeoutMs = 30_000): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-IN,en;q=0.9" },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.length < 500) throw new Error("response suspiciously short");
      return html;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = 1000 * 2 ** i;
        console.warn(`[scraper] fetch failed (${(err as Error).message}); retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error(`Failed to fetch ${url}: ${(lastErr as Error)?.message ?? lastErr}`);
}

type Col = "name" | "code" | "start" | "end" | "place" | "brochure";

function headerCol(text: string): Col | null {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (/code|\bid\b/.test(t)) return "code";
  if (/start|from|begin/.test(t)) return "start";
  if (/\bend\b|\bto\b|finish/.test(t)) return "end";
  if (/place|venue|location|city/.test(t)) return "place";
  if (/brochure|prospectus|pdf|download|circular/.test(t)) return "brochure";
  if (/name|tournament|event|title/.test(t)) return "name";
  return null;
}

export function cleanName(name: string): string {
  return name
    .replace(/[ ​]/g, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

export function absoluteUrl(href: string | undefined | null, base = AICF_EVENTS_URL): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith("#") || /^(javascript|mailto|tel):/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null; // e.g. href="http://Visakhapatnam"
    return u.href;
  } catch {
    return null;
  }
}

export interface ParseReport {
  events: ScrapedEvent[];
  rows: number;
  rejected: { reason: string; row: string }[];
}

export function parseEventsHtml(html: string): ParseReport {
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const rejected: ParseReport["rejected"] = [];
  const seen = new Set<string>();
  let rows = 0;

  $("table").each((_, table) => {
    let map: Partial<Record<Col, number>> | null = null;
    $(table)
      .find("tr")
      .each((_, tr) => {
        const cells = $(tr).children("th,td").toArray();
        if (!cells.length) return;
        const headerish = $(tr).children("th").length > 0 || !map;
        if (headerish) {
          const m: Partial<Record<Col, number>> = {};
          cells.forEach((c, i) => {
            const col = headerCol($(c).text());
            if (col && m[col] === undefined) m[col] = i;
          });
          if (m.code !== undefined && m.start !== undefined && m.end !== undefined) {
            map = m;
            return;
          }
          if ($(tr).children("th").length) return;
        }
        if (!map) return;
        rows++;
        const get = (c: Col) => (map![c] === undefined ? undefined : cells[map![c]!]);
        const text = (c: Col) => {
          const el = get(c);
          return el ? $(el).text().replace(/[ ​]/g, " ").replace(/\s+/g, " ").trim() : "";
        };

        const rawCode = text("code");
        // "499113/499114" style cells: each row claims the first code not yet used.
        const codeParts = rawCode.split(/\s*[\/,&]\s*/).filter(Boolean);
        const eventCode = codeParts.find((c) => !seen.has(c)) ?? codeParts[0] ?? "";
        const label = `${eventCode} ${text("name")}`.trim().slice(0, 80);
        if (!eventCode) return void rejected.push({ reason: "no event code", row: label });
        if (seen.has(eventCode)) return void rejected.push({ reason: "duplicate code", row: label });
        const startDate = parseDate(text("start"));
        const endDate = parseDate(text("end"));
        if (!startDate || !endDate) return void rejected.push({ reason: "bad date", row: label });
        if (endDate < startDate) return void rejected.push({ reason: "endDate < startDate", row: label });
        if (endDate > addDays(startDate, MAX_EVENT_DAYS)) return void rejected.push({ reason: `longer than ${MAX_EVENT_DAYS} days`, row: label });
        const name = cleanName(text("name"));
        if (!name) return void rejected.push({ reason: "no name", row: label });

        let place = "";
        const placeEl = get("place");
        if (placeEl) {
          const clone = $(placeEl).clone();
          clone.find("br").replaceWith(", ");
          place = clone.text().replace(/[ ​]/g, " ").replace(/\s+/g, " ").replace(/(\s*,\s*)+/g, ", ").replace(/^,\s*|,\s*$/g, "").trim();
        }

        let brochureUrl: string | null = null;
        const bEl = get("brochure");
        if (bEl) {
          for (const a of $(bEl).find("a[href]").toArray()) {
            brochureUrl = absoluteUrl($(a).attr("href"));
            if (brochureUrl) break;
          }
        }

        seen.add(eventCode);
        events.push({ eventCode, name, startDate, endDate, place, brochureUrl });
      });
  });

  return { events, rows, rejected };
}

export async function scrapeEvents(): Promise<ScrapedEvent[]> {
  console.log("[scraper] fetching AICF events...");
  const html = await fetchHtml();
  const report = parseEventsHtml(html);
  for (const r of report.rejected) console.warn(`[scraper] rejected (${r.reason}): ${r.row}`);
  console.log(`[scraper] parsed ${report.events.length} events from ${report.rows} rows (${report.rejected.length} rejected)`);
  if (report.events.length === 0) throw new Error("No events parsed; AICF page structure may have changed");
  return report.events;
}

let running: Promise<ScrapeResult> | null = null;
export interface ScrapeResult {
  scraped: number;
  inserted: number;
  updated: number;
}

/** Scrape and upsert. Concurrent callers share one run. */
export function runScrape(): Promise<ScrapeResult> {
  if (running) return running;
  running = (async () => {
    const events = await scrapeEvents();
    let inserted = 0;
    let updated = 0;
    for (const e of events) {
      const r = upsertScrapedEvent(e);
      if (r.isNew) inserted++;
      else if (r.changed) updated++;
    }
    setMeta("lastScrapeAt", new Date().toISOString());
    console.log(`[scraper] done: ${events.length} scraped, ${inserted} new, ${updated} updated`);
    return { scraped: events.length, inserted, updated };
  })().finally(() => {
    running = null;
  });
  return running;
}

export function lastScrapeAt(): string | null {
  return getMeta("lastScrapeAt");
}
