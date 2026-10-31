// Matches AICF events to chess-results tournaments. A match needs the same start date and at least half
// of the significant name words in common (Jaccard >= 0.5). Manual links always win.

const STOP = new Set([
  "fide", "rated", "rating", "chess", "tournament", "open", "international", "championship", "the", "of",
  "and", "a", "an", "in", "for", "series", "event", "2025", "2026",
]);

export function nameTokens(name: string): Set<string> {
  const ascii = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return new Set(ascii.split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)));
}

/** Jaccard similarity of the name tokens, 0..1. */
export function nameScore(a: string, b: string): number {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

export const MATCH_THRESHOLD = 0.5;
