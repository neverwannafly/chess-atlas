import { Router } from "express";
import { z } from "zod";
import { ApiError, wrap } from "../lib/http.js";
import { addDays } from "../lib/dates.js";
import { AICF_URL, countEvents, getEventDetail, getFacets, getMeta, getStats, listEvents } from "../db/events.js";
import { buildIcs } from "../lib/ics.js";
import { appVersion } from "../lib/version.js";
import { getInsights } from "../db/insights.js";

const router = Router();

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (v === undefined || v === "") return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr.flatMap((x) => String(x).split(",")).map((s) => s.trim()).filter(Boolean);
  }, z.array(item).max(50));

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const int = (min: number, max = Number.MAX_SAFE_INTEGER) => z.coerce.number().int().min(min).max(max);

const listQuery = z.object({
  q: z.string().max(200).optional(),
  status: csv(z.enum(["upcoming", "ongoing", "past", "all"])).transform((a) => (a.length === 0 ? ["upcoming", "ongoing"] : a.includes("all") ? [] : a)),
  state: csv(z.string().max(100)),
  city: csv(z.string().max(100)),
  timeControl: csv(z.enum(["Classical", "Rapid", "Blitz", "Mixed"])),
  from: date.optional(),
  to: date.optional(),
  minPrize: int(0).optional(),
  maxFee: int(0).optional(),
  fideRated: bool.optional(),
  sort: z.enum(["startDate", "-startDate", "prize", "-prize", "fee", "name"]).default("startDate"),
  page: int(1, 100000).default(1),
  pageSize: int(1, 200).default(24),
});

const PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=300";

router.get(
  "/events",
  wrap((req, res) => {
    const f = listQuery.parse(req.query);
    const { rows, total } = listEvents(f);
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json({ data: rows, meta: { total, page: f.page, pageSize: f.pageSize, pageCount: Math.ceil(total / f.pageSize) } });
  }),
);

const codeParam = z.string().min(1).max(40).regex(/^[\w\-.]+$/);

router.get(
  "/events/:eventCode",
  wrap((req, res) => {
    const code = codeParam.safeParse(req.params.eventCode);
    const ev = code.success ? getEventDetail(code.data) : null;
    if (!ev) throw new ApiError(404, "NOT_FOUND", "Event not found");
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json({ data: ev });
  }),
);

router.get(
  "/events/:eventCode/calendar.ics",
  wrap((req, res) => {
    const code = codeParam.safeParse(req.params.eventCode);
    const ev = code.success ? getEventDetail(code.data) : null;
    if (!ev) throw new ApiError(404, "NOT_FOUND", "Event not found");
    const where = [ev.venueName, ev.city, ev.state].filter(Boolean).join(", ");
    const descParts = [ev.tagline, ev.brochureUrl ? `Brochure: ${ev.brochureUrl}` : null, `Details: ${AICF_URL}`].filter(Boolean) as string[];
    const ics = buildIcs({
      uid: `${ev.eventCode}@chessatlas`,
      summary: ev.name,
      startDate: ev.startDate,
      endDateExclusive: addDays(ev.endDate, 1),
      location: where || undefined,
      description: descParts.join("\n"),
      url: ev.brochureUrl ?? undefined,
      stamp: ev.updatedAt,
    });
    res.set("Cache-Control", "public, max-age=300");
    res.set("Content-Disposition", `attachment; filename="chessatlas-${ev.eventCode}.ics"`);
    res.type("text/calendar; charset=utf-8").send(ics);
  }),
);

router.get(
  "/meta/filters",
  wrap((_req, res) => {
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json({ data: getFacets() });
  }),
);

router.get(
  "/meta/stats",
  wrap((_req, res) => {
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json({ data: getStats() });
  }),
);

router.get(
  "/meta/insights",
  wrap((_req, res) => {
    res.set("Cache-Control", PUBLIC_CACHE);
    res.json({ data: getInsights() });
  }),
);

router.get(
  "/health",
  wrap((_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ data: { status: "ok", events: countEvents(), lastScrapeAt: getMeta("lastScrapeAt"), version: appVersion() } });
  }),
);

export default router;
