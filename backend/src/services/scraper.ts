import * as cheerio from "cheerio";
import type { ScrapedEvent } from "../types/event.js";

const AICF_EVENTS_URL = "https://aicf.in/all-events/";

export async function scrapeEvents(): Promise<ScrapedEvent[]> {
  console.log("Fetching events from AICF...");
  
  const response = await fetch(AICF_EVENTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch AICF page: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const events: ScrapedEvent[] = [];
  const seenCodes = new Set<string>();

  $("table.has-fixed-layout tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 5) return;

    const name = $(cells[0]).text().trim();
    const eventCode = $(cells[1]).text().trim();
    const startDate = $(cells[2]).text().trim();
    const endDate = $(cells[3]).text().trim();
    const place = $(cells[4]).text().trim();
    const brochureLink = $(cells[5]).find("a").attr("href") || null;

    if (!eventCode || seenCodes.has(eventCode)) return;
    if (!isValidDate(startDate) || !isValidDate(endDate)) return;

    seenCodes.add(eventCode);

    events.push({
      eventCode,
      name: cleanName(name),
      startDate,
      endDate,
      place,
      brochureUrl: brochureLink,
    });
  });

  console.log(`Scraped ${events.length} unique events`);
  return events;
}

function isValidDate(dateStr: string): boolean {
  return /^\d{2}-\d{2}-\d{4}$/.test(dateStr);
}

function cleanName(name: string): string {
  return name
    .replace(/\*\*/g, "")
    .replace(/<sup>.*?<\/sup>/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
