import "dotenv/config";
import cron from "node-cron";
import fs from "node:fs";
import path from "node:path";
import db from "../db/database.js";
import { lastSyncRun } from "../db/chessresults.js";
import { getMeta, setMeta } from "../db/events.js";
import { downloadList, ingestMonthlyList } from "../fide/ingest.js";
import { runCycle } from "./cycle.js";

// Standalone worker: `npm run chessresults`. Runs in its own process next to the API, sharing the
// SQLite file (WAL mode).
//  - every 30 minutes: refresh listings and whatever is due (ongoing 30 min, upcoming daily, finished once)
//  - daily at 05:00 and on boot: if this month's official FIDE rating list is not ingested yet, ingest it

const STALE_MS = 30 * 60_000;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve("data");
const FIDE_PERIOD_KEY = "fide.ingestedPeriod";

const go = (why: string) =>
  runCycle()
    .then((s) => console.log(`[chessresults] ${why}:`, JSON.stringify(s)))
    .catch((err) => console.error(`[chessresults] ${why} cycle crashed:`, (err as Error).message));

async function ingestFideIfNeeded(why: string): Promise<void> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  if (getMeta(FIDE_PERIOD_KEY) === period) return;
  const dir = path.join(DATA_DIR, "fide");
  fs.mkdirSync(dir, { recursive: true });
  try {
    const zipPath = await downloadList("combined", dir);
    const stats = await ingestMonthlyList({ period, db, zipPath });
    setMeta(FIDE_PERIOD_KEY, period);
    fs.rmSync(zipPath, { force: true }); // free ~51 MB on the volume
    console.log(`[fide] ${why}: ingested ${period}`, JSON.stringify(stats));
  } catch (err) {
    console.error(`[fide] ${why} ingest failed:`, (err as Error).message);
  }
}

cron.schedule("*/30 * * * *", () => void go("scheduled"));
cron.schedule("0 5 * * *", () => void ingestFideIfNeeded("daily"));

const last = lastSyncRun("cycle");
if (!last || Date.now() - last.finishedAtMs > STALE_MS) void go("boot");
void ingestFideIfNeeded("boot");

console.log("[chessresults] worker started; cycles every 30 minutes, FIDE list checked daily");

function shutdown() {
  db.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
