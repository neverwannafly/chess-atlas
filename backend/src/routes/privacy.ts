import { Router, json } from "express";
import { z } from "zod";
import { ApiError, wrap } from "../lib/http.js";
import { createDeletionRequest } from "../db/deletion.js";

// Public side of the privacy workflow. The notice itself is a page in the frontend (/privacy).
// A request is only recorded here; an admin decides it (see routes/admin.ts).

const router = Router();
router.use(json({ limit: "16kb" }));

const body = z
  .object({
    name: z.string().trim().min(2).max(100),
    fideId: z.string().trim().regex(/^\d{5,9}$/, "FIDE id is 5 to 9 digits").optional().or(z.literal("").transform(() => undefined)),
    chessResultsTournamentId: z.string().trim().regex(/^\d{1,12}$/).optional().or(z.literal("").transform(() => undefined)),
    chessResultsStartNo: z.coerce.number().int().min(1).max(5000).optional(),
    contactEmail: z.string().trim().email().max(200),
    note: z.string().trim().max(1000).optional(),
    confirm: z.literal(true, { errorMap: () => ({ message: "Please confirm that you are the player or their guardian" }) }),
  })
  .refine((b) => b.fideId || (b.chessResultsTournamentId && b.chessResultsStartNo), {
    message: "Give your FIDE id, or the chess-results tournament number and start number",
  });

// Simple per-IP limit: 10 requests an hour, so the form cannot be used to flood the table.
const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset <= now) {
    hits.set(ip, { n: 1, reset: now + 3600_000 });
    return false;
  }
  h.n++;
  return h.n > 10;
}

router.post(
  "/privacy/deletion-requests",
  wrap((req, res) => {
    if (limited(req.ip ?? "unknown")) throw new ApiError(429, "RATE_LIMITED", "Too many requests from this address; try again later");
    const b = body.parse(req.body);
    const id = createDeletionRequest(
      {
        name: b.name,
        fideId: b.fideId ?? null,
        chessResultsTournamentId: b.chessResultsTournamentId ?? null,
        chessResultsStartNo: b.chessResultsStartNo ?? null,
        contactEmail: b.contactEmail,
        note: b.note ?? null,
      },
      Date.now(),
    );
    res.status(201).json({
      data: { id, status: "received", message: "Received. We will reply to your email within 30 days." },
    });
  }),
);

export default router;
