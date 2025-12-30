import express from "express";
import cors from "cors";
import cron from "node-cron";
import eventsRouter from "./routes/events.js";
import { runPipeline } from "./services/pipeline.js";

import dotenv from "dotenv";
dotenv.config();


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/events", eventsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Schedule pipeline to run every 6 hours
cron.schedule("0 */6 * * *", async () => {
  console.log("\n⏰ Running scheduled pipeline...\n");
  try {
    await runPipeline({ scrape: true, parsePdfs: true });
  } catch (error) {
    console.error("Scheduled pipeline failed:", error);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Chess Atlas API running on http://localhost:${PORT}`);
});
