import { scrapeEvents } from "./scraper.js";
import { parsePdfWithLLM } from "./pdfParser.js";
import { upsertEvent, updateEventWithPdfData } from "../db/database.js";

export interface PipelineOptions {
  scrape?: boolean;
  parsePdfs?: boolean;
  limit?: number;
  concurrency?: number;
}

export interface PipelineResult {
  scraped: number;
  newEvents: number;
  pdfsParsed: number;
  pdfsFailed: number;
}

interface EventToParse {
  eventCode: string;
  name: string;
  brochureUrl: string;
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => processor(item, i + batchIndex))
    );
    results.push(...batchResults);
  }

  return results;
}

export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const { scrape = true, parsePdfs = true, limit, concurrency = 5 } = options;

  const result: PipelineResult = {
    scraped: 0,
    newEvents: 0,
    pdfsParsed: 0,
    pdfsFailed: 0,
  };

  const eventsToParse: EventToParse[] = [];

  if (scrape) {
    console.log("📡 Scraping AICF events...\n");
    const events = await scrapeEvents();
    result.scraped = events.length;

    for (const event of events) {
      const { isNew, needsPdfParse } = upsertEvent(event);

      if (isNew) {
        result.newEvents++;
      }

      if (needsPdfParse && event.brochureUrl) {
        eventsToParse.push({
          eventCode: event.eventCode,
          name: event.name,
          brochureUrl: event.brochureUrl,
        });
      }
    }

    console.log(`✅ Scraped ${result.scraped} events (${result.newEvents} new)`);
    console.log(`📄 ${eventsToParse.length} events need PDF parsing\n`);
  }

  if (parsePdfs && eventsToParse.length > 0) {
    const toParse = limit ? eventsToParse.slice(0, limit) : eventsToParse;

    console.log(`🔍 Parsing ${toParse.length} PDFs (concurrency: ${concurrency})...\n`);

    await processInBatches(toParse, concurrency, async (event, index) => {
      const prefix = `[${index + 1}/${toParse.length}]`;

      try {
        const pdfData = await parsePdfWithLLM(event.brochureUrl);

        if (pdfData) {
          updateEventWithPdfData(event.eventCode, pdfData);
          result.pdfsParsed++;
          console.log(`${prefix} ✓ ${event.name.slice(0, 50)}...`);
        } else {
          result.pdfsFailed++;
          console.log(`${prefix} ✗ ${event.name.slice(0, 50)}... (failed)`);
        }
      } catch (err) {
        result.pdfsFailed++;
        console.log(`${prefix} ✗ ${event.name.slice(0, 50)}... (error)`);
      }
    });

    console.log(`\n✅ Parsed ${result.pdfsParsed} PDFs (${result.pdfsFailed} failed)`);
  }

  return result;
}
