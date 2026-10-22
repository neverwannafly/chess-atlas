import { runScrape } from "../services/scraper.js";

runScrape()
  .then((r) => {
    console.log(`Scraped ${r.scraped}, inserted ${r.inserted}, updated ${r.updated}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Scrape failed:", err);
    process.exit(1);
  });
