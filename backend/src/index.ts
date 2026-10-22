import "dotenv/config";
import cron from "node-cron";
import { createApp } from "./app.js";
import db from "./db/database.js";
import { getMeta } from "./db/events.js";
import { runScrape } from "./services/scraper.js";

const PORT = Number(process.env.PORT) || 8080;
const SIX_HOURS = 6 * 3600_000;

const app = createApp();
const server = app.listen(PORT, () => console.log(`Chess Atlas listening on http://localhost:${PORT}`));

const scrape = (why: string) =>
  runScrape().catch((err) => console.error(`[cron] ${why} scrape failed:`, (err as Error).message));

cron.schedule("0 */6 * * *", () => void scrape("scheduled"));

const last = getMeta("lastScrapeAt");
if (!last || Date.now() - new Date(last).getTime() > SIX_HOURS) void scrape("boot");

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
