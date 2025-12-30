import { runPipeline } from "../services/pipeline.js";

function parseArgs() {
  const args = process.argv.slice(2);

  const options = {
    scrapeOnly: args.includes("--scrape-only"),
    parseOnly: args.includes("--parse-only"),
    limit: undefined as number | undefined,
    concurrency: 5,
  };

  const limitIdx = args.findIndex((a) => a === "--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    options.limit = parseInt(args[limitIdx + 1], 10);
  }

  const concurrencyIdx = args.findIndex((a) => a === "--concurrency");
  if (concurrencyIdx !== -1 && args[concurrencyIdx + 1]) {
    options.concurrency = parseInt(args[concurrencyIdx + 1], 10);
  }

  return options;
}

async function main() {
  const args = parseArgs();

  console.log("🏁 Chess Atlas Pipeline\n");
  console.log("Options:");
  console.log(`  Scrape: ${!args.parseOnly}`);
  console.log(`  Parse PDFs: ${!args.scrapeOnly}`);
  console.log(`  Concurrency: ${args.concurrency}`);
  if (args.limit) console.log(`  Limit: ${args.limit}`);
  console.log("");

  const result = await runPipeline({
    scrape: !args.parseOnly,
    parsePdfs: !args.scrapeOnly,
    limit: args.limit,
    concurrency: args.concurrency,
  });

  console.log("\n🎉 Pipeline complete!");
  console.log(`  Events scraped: ${result.scraped}`);
  console.log(`  New events: ${result.newEvents}`);
  console.log(`  PDFs parsed: ${result.pdfsParsed}`);
  console.log(`  PDFs failed: ${result.pdfsFailed}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
