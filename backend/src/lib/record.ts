// Win / draw / loss totals from a player's stored results. A result is from the player's side:
// "1" or "+" a win, "½" a draw, "0" or "-" a loss. Anything else (unplayed, bye, pending) is not counted.

export interface RecordTotals {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  /** Score as points (win 1, draw 0.5). */
  points: number;
}

export function recordOf(results: { result: string | null }[]): RecordTotals {
  const t: RecordTotals = { games: 0, wins: 0, draws: 0, losses: 0, points: 0 };
  for (const r of results) {
    const v = (r.result ?? "").trim();
    if (v === "1" || v === "+") { t.wins++; t.points += 1; }
    else if (v === "½" || v === "1/2" || v === "0.5") { t.draws++; t.points += 0.5; }
    else if (v === "0" || v === "-") { t.losses++; }
    else continue;
    t.games++;
  }
  return t;
}
