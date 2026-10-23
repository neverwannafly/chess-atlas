import type { EventSummary } from "@/types/event";
import { addDays, formatMonthLabel, todayIST } from "@/lib/format";

export interface TimeGroup {
  key: string;
  title: string;
  /** Short qualifier shown after the title, e.g. the date span of "This week". */
  hint?: string;
  live?: boolean;
  items: EventSummary[];
}

const fmtShort = (d: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const monthName = (ym: string) => new Intl.DateTimeFormat("en-IN", { month: "long", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`));

/**
 * Almanac buckets: Happening now · This week · Next week · Later in {Month} · then one per month.
 * Weeks run Monday to Sunday. Finished events (when shown) close the list, most recent first.
 */
export function groupByTime(events: EventSummary[], today = todayIST()): TimeGroup[] {
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Mon
  const weekEnd = addDays(today, 6 - dow);
  const nextStart = addDays(weekEnd, 1);
  const nextEnd = addDays(weekEnd, 7);
  const thisMonth = today.slice(0, 7);
  const thisYear = today.slice(0, 4);
  const groups = new Map<string, TimeGroup>();
  const add = (key: string, make: () => Omit<TimeGroup, "items">, e: EventSummary) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { ...make(), items: [] }));
    g.items.push(e);
  };
  for (const e of events) {
    if (e.endDate < today) add("past", () => ({ key: "past", title: "Finished" }), e);
    else if (e.startDate <= today) add("now", () => ({ key: "now", title: "Happening now", live: true }), e);
    else if (e.startDate <= weekEnd) add("week", () => ({ key: "week", title: "This week", hint: `until ${fmtShort(weekEnd)}` }), e);
    else if (e.startDate <= nextEnd) add("next", () => ({ key: "next", title: "Next week", hint: `${fmtShort(nextStart)} – ${fmtShort(nextEnd)}` }), e);
    else {
      const ym = e.startDate.slice(0, 7);
      if (ym === thisMonth) add("later", () => ({ key: "later", title: `Later in ${monthName(ym)}` }), e);
      else add(ym, () => ({ key: ym, title: ym.slice(0, 4) === thisYear ? monthName(ym) : formatMonthLabel(ym) }), e);
    }
  }
  return [...groups.values()];
}
