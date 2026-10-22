import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public issues?: unknown) {
    super(message);
  }
}

export const wrap =
  (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  (req, res, next) => {
    try {
      fn(req, res);
    } catch (e) {
      next(e);
    }
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, ...(err.issues ? { issues: err.issues } : {}) } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", issues: err.issues } });
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === "entity.parse.failed") return res.status(400).json({ error: { code: "BAD_JSON", message: "Malformed JSON body" } });
  if (e?.type === "entity.too.large") return res.status(413).json({ error: { code: "TOO_LARGE", message: "Request body too large" } });
  console.error("[error]", err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
