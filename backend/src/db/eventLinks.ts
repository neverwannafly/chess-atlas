import db from "./database.js";
import { addDays, todayIST } from "../lib/dates.js";
import { MATCH_THRESHOLD, nameScore } from "../lib/eventMatch.js";

// Links AICF events to their chess-results tournament, so an event page can show live standings.
// Automatic links need the same start date and a name match (see lib/eventMatch.ts). A manual link is
// written by hand and is never replaced by the automatic matcher.

export function matchEventsToTournaments(nowMs: number): { auto: number; kept: number } {
  const today = todayIST(new Date(nowMs));
  const events = db.prepare("SELECT eventCode, name, startDate FROM events WHERE endDate >= ?")
    .all(addDays(today, -30)) as { eventCode: string; name: string; startDate: string }[];
  const tournaments = db.prepare("SELECT id, name, startDate FROM tournaments WHERE startDate IS NOT NULL AND startDate >= ?")
    .all(addDays(today, -60)) as { id: string; name: string; startDate: string }[];
  const byDate = new Map<string, typeof tournaments>();
  for (const t of tournaments) byDate.set(t.startDate, [...(byDate.get(t.startDate) ?? []), t]);

  const upsert = db.prepare(
    `INSERT INTO event_chess_results (eventCode, tournamentId, method, score, matchedAtMs) VALUES (?, ?, 'auto', ?, ?)
     ON CONFLICT(eventCode) DO UPDATE SET tournamentId = excluded.tournamentId, score = excluded.score, matchedAtMs = excluded.matchedAtMs
     WHERE event_chess_results.method = 'auto'`,
  );
  const drop = db.prepare("DELETE FROM event_chess_results WHERE eventCode = ? AND method = 'auto'");
  let auto = 0;
  let kept = 0;
  db.transaction(() => {
    for (const e of events) {
      const manual = db.prepare("SELECT 1 FROM event_chess_results WHERE eventCode = ? AND method = 'manual'").get(e.eventCode);
      if (manual) { kept++; continue; }
      const scored = (byDate.get(e.startDate) ?? [])
        .map((t) => ({ id: t.id, score: nameScore(e.name, t.name) }))
        .filter((x) => x.score >= MATCH_THRESHOLD)
        .sort((a, b) => b.score - a.score);
      // Two equally good candidates are ambiguous: leave the event unlinked rather than guess.
      if (scored.length === 0 || (scored.length > 1 && scored[0].score === scored[1].score)) { drop.run(e.eventCode); continue; }
      upsert.run(e.eventCode, scored[0].id, scored[0].score, nowMs);
      auto++;
    }
  })();
  return { auto, kept };
}

/** The linked tournament for an event, if any. */
export function linkedTournament(eventCode: string): { tournamentId: string; method: string } | null {
  return (db.prepare("SELECT tournamentId, method FROM event_chess_results WHERE eventCode = ?").get(eventCode) as
    | { tournamentId: string; method: string }
    | undefined) ?? null;
}
