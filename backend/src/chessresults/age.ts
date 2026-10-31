// Age categories from a birth year. Convention: age is the tournament year minus the birth year, and a
// category "Un" admits players under n on 1 January of that year. This is the usual scheme for youth
// events; confirm it against the AICF rules before relying on it (see docs/DECISIONS.md).

export const AGE_CATEGORIES = [8, 10, 12, 14, 16, 18] as const;

/** The youngest category that still admits the player, e.g. born 2014 in 2026 (age 12) -> "U14". */
export function ageCategory(birthYear: number | null | undefined, year: number): string | null {
  if (!birthYear) return null;
  const age = year - birthYear;
  if (age < 0) return null;
  const cat = AGE_CATEGORIES.find((n) => age < n);
  return cat ? `U${cat}` : "Open";
}
