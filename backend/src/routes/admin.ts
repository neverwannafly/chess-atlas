import crypto from "node:crypto";
import { Router, json } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiError, wrap } from "../lib/http.js";
import { brochureExtractionSchema } from "../extraction/schema.js";
import { getEventRow, getExtractionQueue, saveExtraction, saveExtractionFailure } from "../db/events.js";
import { runScrape } from "../services/scraper.js";

const router = Router();

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Simple fixed-window in-memory limiter, per IP.
const hits = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.ADMIN_RATE_LIMIT ?? 120);
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip ?? "unknown";
  let h = hits.get(key);
  if (!h || h.reset <= now) {
    h = { n: 0, reset: now + WINDOW_MS };
    hits.set(key, h);
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }
  h.n++;
  if (h.n > MAX_PER_WINDOW) {
    res.set("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
    return next(new ApiError(429, "RATE_LIMITED", "Too many requests"));
  }
  next();
}

function auth(req: Request, _res: Response, next: NextFunction) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next(new ApiError(503, "ADMIN_DISABLED", "Admin API is disabled (ADMIN_TOKEN not set)"));
  const m = /^Bearer (.+)$/i.exec(req.get("authorization") ?? "");
  if (!m || !safeEqual(m[1], token)) return next(new ApiError(401, "UNAUTHORIZED", "Invalid or missing bearer token"));
  next();
}

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(rateLimit, auth, json({ limit: "2mb" }));

router.post(
  "/scrape",
  (_req, res, next) => {
    runScrape().then((r) => res.json({ data: r }), next);
  },
);

const queueQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  force: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

router.get(
  "/extraction-queue",
  wrap((req, res) => {
    const q = queueQuery.parse(req.query);
    res.json({ data: getExtractionQueue(q.limit, q.force) });
  }),
);

const submissionSchema = z.object({
  extraction: brochureExtractionSchema,
  model: z.string().min(1).max(200),
  sourceHash: z.string().min(1).max(200),
});

router.put(
  "/events/:eventCode/extraction",
  wrap((req, res) => {
    if (!getEventRow(req.params.eventCode)) throw new ApiError(404, "NOT_FOUND", "Event not found");
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid extraction payload", parsed.error.issues);
    const detail = saveExtraction(req.params.eventCode, parsed.data.extraction as never, parsed.data.model, parsed.data.sourceHash);
    res.json({ data: detail });
  }),
);

router.post(
  "/events/:eventCode/extraction-failure",
  wrap((req, res) => {
    const body = z.object({ error: z.string().min(1).max(5000) }).safeParse(req.body);
    if (!body.success) throw new ApiError(400, "VALIDATION_ERROR", "Body must be { error: string }", body.error.issues);
    if (!saveExtractionFailure(req.params.eventCode, body.data.error)) throw new ApiError(404, "NOT_FOUND", "Event not found");
    const row = getEventRow(req.params.eventCode)!;
    res.json({ data: { eventCode: row.eventCode, extractionStatus: row.extractionStatus, attempts: row.extractionAttempts } });
  }),
);

export default router;
