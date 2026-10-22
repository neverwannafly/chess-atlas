const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function build(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function year(s: string): number {
  const n = parseInt(s, 10);
  return s.length <= 2 ? 2000 + n : n;
}

/** Parse the date formats seen on AICF into YYYY-MM-DD, or null if unparseable. */
export function parseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.replace(/[ ]/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^[-/.\s]+|[-/.\s]+$/g, ""); // stray separators ("-03-10-2026")
  s = s.replace(/^(\d{1,2}[-/.])(0\d)\d([-/.]\d{2,4})$/, "$1$2$3"); // "20-092-2026" typo
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) return build(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/))) return build(year(m[3]), +m[2], +m[1]);
  // 10 Apr 2025, 10th April, 2025, 10-Apr-2025
  if ((m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})\.?,?[\s\-/.]+(\d{4}|\d{2})$/))) {
    const mon = MONTHS[m[2].toLowerCase()];
    return mon ? build(year(m[3]), mon, +m[1]) : null;
  }
  // April 10, 2025
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/))) {
    const mon = MONTHS[m[1].toLowerCase()];
    return mon ? build(+m[3], mon, +m[2]) : null;
  }
  return null;
}

/** Today's date (YYYY-MM-DD) in Asia/Kolkata. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
