const TZ = "Asia/Kolkata";

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const parse = (d: string) => new Date(`${d}T00:00:00Z`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(parse(d));

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000);
}

/** "12–15 Nov", "28 Nov – 2 Dec", adds year when it differs from `today`'s year. */
export function formatDateRange(start: string, end: string, withYear = false): string {
  const y = (d: string) => d.slice(0, 4);
  const yr = withYear || y(start) !== y(end) || y(start) !== todayIST().slice(0, 4);
  const tail = yr ? ` ${y(end)}` : "";
  if (start === end) return fmt(start, { day: "numeric", month: "short" }) + tail;
  if (start.slice(0, 7) === end.slice(0, 7))
    return `${parse(start).getUTCDate()}–${fmt(end, { day: "numeric", month: "short" })}${tail}`;
  const sy = y(start) !== y(end) ? ` ${y(start)}` : "";
  return `${fmt(start, { day: "numeric", month: "short" })}${sy} – ${fmt(end, { day: "numeric", month: "short" })}${tail}`;
}
export const formatDate = (d: string) => fmt(d, { day: "numeric", month: "short", year: "numeric" });
export const formatWeekday = (d: string) => fmt(d, { weekday: "long", day: "numeric", month: "long" });
export const formatMonthLabel = (ym: string) => fmt(`${ym}-01`, { month: "long", year: "numeric" });
export const formatMonthShort = (ym: string) => fmt(`${ym}-01`, { month: "short" });

/** Relative description of the event window versus today. */
export function relativeStart(start: string, end: string, today = todayIST()): { label: string; tone: "live" | "soon" | "future" | "past" } {
  if (end < today) return { label: "Ended", tone: "past" };
  if (start <= today) return { label: "Ongoing", tone: "live" };
  const n = daysBetween(today, start);
  if (n === 1) return { label: "Starts tomorrow", tone: "soon" };
  if (n <= 7) return { label: `Starts in ${n} days`, tone: "soon" };
  if (n < 60) return { label: `In ${n} days`, tone: "future" };
  return { label: `In ${Math.round(n / 30)} months`, tone: "future" };
}

/** Days left until registration closes; null when not applicable/past. */
export function deadlineDays(deadline: string | null, today = todayIST()): number | null {
  if (!deadline) return null;
  const n = daysBetween(today, deadline);
  return n >= 0 ? n : null;
}
export function deadlineLabel(n: number): string {
  return n === 0 ? "closes today" : n === 1 ? "closes tomorrow" : `closes in ${n} days`;
}

const full = new Intl.NumberFormat("en-IN");
/** ₹5,50,000 */
export const formatInrFull = (n: number) => `₹${full.format(n)}`;
/** ₹5.5L, ₹1.2Cr, ₹75K, ₹800 */
export function formatInr(n: number | null | undefined): string {
  if (n == null) return "—";
  const trim = (x: number) => String(Math.round(x * 100) / 100);
  if (n >= 1e7) return `₹${trim(n / 1e7)}Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)}L`;
  if (n >= 1e4) return `₹${trim(n / 1e3)}K`;
  return `₹${full.format(n)}`;
}

export function digitsToWhatsApp(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return `91${d}`;
  if (d.length === 12 && d.startsWith("91") && /^[6-9]/.test(d[2])) return d;
  return null;
}
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const pluralize = (n: number, one: string, many = `${one}s`) => `${full.format(n)} ${n === 1 ? one : many}`;

export const location = (e: { city: string | null; state: string | null }) =>
  [e.city, e.state].filter(Boolean).join(", ") || "Location TBA";

export const formatWeekdayShort = (d: string) => fmt(d, { weekday: "short" });
export const formatDayMonth = (d: string) => fmt(d, { day: "numeric", month: "short" });
/** Money for small amounts in full (₹2,000), large ones compact (₹5.5L). */
export const formatMoney = (n: number) => (n >= 1e5 ? formatInr(n) : formatInrFull(n));
/** "₹2,000–3,500" / "₹1L–2.5L" */
export function formatMoneyRange(min: number, max: number): string {
  if (min === max) return formatMoney(min);
  const b = formatMoney(max).replace("₹", "");
  return `${formatMoney(min)}–${b}`;
}
