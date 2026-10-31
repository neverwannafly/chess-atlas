import { Router } from "express";
import { z } from "zod";
import { ApiError, wrap } from "../lib/http.js";
import { CR_BASE } from "../chessresults/client.js";
import * as store from "../db/chessresults.js";
import { getPlayerDetail, searchPlayers } from "../db/players.js";
import { requestPlayerRefresh } from "../chessresults/lazy.js";
import { settleLiveRefresh, startLiveRefresh } from "../chessresults/live.js";
import { requestFideProfile } from "../fide/profile.js";
import { recordOf } from "../lib/record.js";

const router = Router();

const SOURCE = { name: "chess-results.com", url: CR_BASE };
const CACHE = "public, max-age=60, stale-while-revalidate=300";
const CACHE_LONG = "public, max-age=300, stale-while-revalidate=600";

const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);
const idParam = z.string().regex(/^\d{1,12}$/, "expected a chess-results tournament number");
const fedParam = z.string().regex(/^[A-Za-z]{3}$/).optional();

const listQuery = z.object({
  status: z.enum(["upcoming", "ongoing", "finished"]).optional(),
  fed: fedParam,
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

/** The live link is the chess-results tournament page; it is the source of truth for live boards. */
function present(t: store.TournamentRow) {
  return {
    id: t.id,
    name: t.name,
    federation: t.federationCode,
    location: t.locationRaw,
    startDate: t.startDate,
    endDate: t.endDate,
    timeControl: t.timeControl,
    status: t.status,
    rounds: t.rounds,
    currentRound: t.currentRound,
    chessResultsUrl: `${CR_BASE}tnr${t.id}.aspx?lan=1`,
    liveUrl: t.status === "ongoing" ? `${CR_BASE}tnr${t.id}.aspx?lan=1&art=2&rd=${Math.max(1, t.rounds ?? 1)}` : null,
    lastUpdatedAt: iso(t.sourceUpdatedAtMs),
    lastRefreshedAt: iso(t.lastFetchedAtMs),
    nextRefreshAt: iso(t.nextFetchAtMs),
    discoveredVia: t.discoveredVia,
    error: t.errorCount > 0 ? t.fetchError : null,
  };
}

router.get(
  "/chessresults/tournaments",
  wrap((req, res) => {
    const f = listQuery.parse(req.query);
    const { rows, total } = store.listTournaments({
      status: f.status,
      fed: f.fed,
      q: f.q?.trim() || undefined,
      limit: f.pageSize,
      offset: (f.page - 1) * f.pageSize,
    });
    res.set("Cache-Control", CACHE);
    res.json({
      data: rows.map(present),
      meta: { total, page: f.page, pageSize: f.pageSize, pageCount: Math.ceil(total / f.pageSize), source: SOURCE },
    });
  }),
);

router.get(
  "/chessresults/tournaments/:id",
  async (req, res, next) => {
    try {
      const id = idParam.safeParse(req.params.id);
      const t = id.success ? store.getTournamentRow(id.data) : undefined;
      if (!t) throw new ApiError(404, "NOT_FOUND", "Tournament not mirrored");
      // Ongoing tournaments are refreshed on this request if our copy is 5 minutes old or more.
      const start = startLiveRefresh(t.id);
      const state = await settleLiveRefresh(start);
      const fresh = store.getTournamentRow(t.id) ?? t;
      res.set("Cache-Control", "no-cache");
      res.json({
        data: {
          ...present(fresh),
          standings: store.getStandings(t.id, 500),
          roundList: store.getRounds(t.id),
        },
        meta: { source: SOURCE, refresh: { state, reason: start.reason, lastRefreshedAt: iso(fresh.lastFetchedAtMs) } },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/chessresults/tournaments/:id/rounds/:round",
  wrap((req, res) => {
    const id = idParam.safeParse(req.params.id);
    const round = z.coerce.number().int().min(1).max(200).safeParse(req.params.round);
    if (!id.success || !round.success) throw new ApiError(400, "BAD_REQUEST", "Invalid tournament or round");
    if (!store.getTournamentRow(id.data)) throw new ApiError(404, "NOT_FOUND", "Tournament not mirrored");
    res.set("Cache-Control", CACHE);
    res.json({ data: store.getRoundGames(id.data, round.data), meta: { source: SOURCE, round: round.data } });
  }),
);

router.get(
  "/players",
  wrap((req, res) => {
    const q = z.string().min(2).max(100).safeParse(req.query.q);
    if (!q.success) throw new ApiError(400, "BAD_REQUEST", "Search needs q with at least 2 characters");
    res.set("Cache-Control", CACHE);
    res.json({ data: searchPlayers(q.data, 25), meta: { source: SOURCE } });
  }),
);

router.get(
  "/players/:id",
  wrap((req, res) => {
    const id = z.coerce.number().int().positive().safeParse(req.params.id);
    const detail = id.success ? getPlayerDetail(id.data) : null;
    if (!detail) throw new ApiError(404, "NOT_FOUND", "Player not found");
    // Results are refreshed on request, in the background. This response shows what is stored now.
    const refresh = requestPlayerRefresh(id.data as number);
    const fide = requestFideProfile(id.data as number, (detail as { fideId?: string | null }).fideId ?? null);
    const results = store.playerResults(id.data as number);
    const last = results.reduce((m, r) => Math.max(m, r.fetchedAtMs ?? 0), 0);
    res.set("Cache-Control", "no-cache");
    res.json({
      data: { ...detail, results, record: recordOf(results) },
      // `state` is "queued" when this request started a background refresh. A `state` set by the refresh
      // module itself (e.g. "in_progress") takes precedence.
      meta: { source: SOURCE, refresh: { state: refresh.queued ? "queued" : "idle", ...refresh, lastRefreshedAt: iso(last) } },
    });
  }),
);

router.get(
  "/chessresults/status",
  wrap((_req, res) => {
    const m = store.mirrorStats();
    const cycle = store.lastSyncRun("cycle");
    const archive = store.lastSyncRun("archive");
    res.set("Cache-Control", "no-cache");
    res.json({
      data: {
        tournaments: m.tournaments,
        ongoing: m.ongoing ?? 0,
        upcoming: m.upcoming ?? 0,
        finished: m.finished ?? 0,
        backfilled: m.backfilled ?? 0,
        parked: m.parked ?? 0,
        players: m.players ?? 0,
        lastRefreshedAt: iso(m.lastFetchedAtMs),
        lastCycle: cycle ? { startedAt: iso(cycle.startedAtMs), finishedAt: iso(cycle.finishedAtMs), requests: cycle.requests, errors: cycle.errors, outcome: cycle.outcome } : null,
        lastArchive: archive ? { startedAt: iso(archive.startedAtMs), outcome: archive.outcome, detail: archive.detail } : null,
      },
      meta: { source: SOURCE },
    });
  }),
);

export default router;
