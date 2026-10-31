import crypto from "node:crypto";
import { Router, json } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ApiError, wrap } from "../lib/http.js";
import { importPlayers } from "../db/playerImport.js";

// Player import (admin). POST /api/admin/players/import with { "players": [...] }, at most 500 players per
// request (see docs/PLAYER_IMPORT.md). Same bearer token as the other admin routes.

const router = Router();

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function auth(req: Request, _res: Response, next: NextFunction) {
  const token = process.env.ADMIN_TOKEN || process.env.CHESSATLAS_ADMIN_TOKEN;
  if (!token) return next(new ApiError(503, "ADMIN_DISABLED", "Admin API is disabled (ADMIN_TOKEN not set)"));
  const m = /^Bearer (.+)$/i.exec(req.get("authorization") ?? "");
  if (!m || !safeEqual(m[1], token)) return next(new ApiError(401, "UNAUTHORIZED", "Invalid or missing bearer token"));
  next();
}

const ratingSchema = z.object({
  list: z.enum(["standard", "rapid", "blitz"]),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  rating: z.number().int().min(0).max(4000).nullable(),
  games: z.number().int().min(0).nullable().optional(),
});

const playerSchema = z.object({
  fideId: z.string().regex(/^\d{5,9}$/, "FIDE id is 5 to 9 digits"),
  name: z.string().trim().min(1).max(120),
  federationCode: z.string().regex(/^[A-Z]{3}$/).optional(),
  title: z.string().max(4).nullable().optional(),
  sex: z.enum(["M", "F"]).nullable().optional(),
  birthYear: z.number().int().min(1900).max(2030).nullable().optional(),
  identNumber: z.string().regex(/^\d{1,14}$/).nullable().optional(),
  ratings: z.array(ratingSchema).max(1000).optional(),
});

router.post(
  "/players/import",
  auth,
  json({ limit: "2mb" }),
  wrap((req, res) => {
    const body = z.object({ players: z.array(playerSchema).min(1).max(500) }).parse(req.body);
    res.json({ data: importPlayers(body.players, Date.now()) });
  }),
);

export default router;
