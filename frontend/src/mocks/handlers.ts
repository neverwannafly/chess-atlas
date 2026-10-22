import type { EventDetail, EventSummary, FacetCount, Paginated, Stats } from "@/types/event";
import type { EventQuery, FilterFacets } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { addDays, todayIST } from "@/lib/format";
import { buildFixtures } from "./fixtures";

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
let cache: EventDetail[] | null = null;
const all = () => (cache ??= buildFixtures());

function toSummary(e: EventDetail): EventSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { details, extractedAt, extractionModel, aicfUrl, createdAt, updatedAt, ...s } = e;
  return s;
}
function facet(values: (string | null)[]): FacetCount[] {
  const m = new Map<string, number>();
  for (const v of values) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
const live = () => all().filter((e) => e.status !== "past");

export async function mockEvents(q: EventQuery): Promise<Paginated<EventSummary>> {
  await delay();
  const status = q.status?.length ? (q.status.includes("all") ? ["upcoming", "ongoing", "past"] : q.status) : ["upcoming", "ongoing"];
  const needle = q.q?.trim().toLowerCase();
  let rows = all().filter((e) => {
    if (!status.includes(e.status)) return false;
    if (needle && ![e.name, e.city, e.state, e.venueName].some((x) => x?.toLowerCase().includes(needle))) return false;
    if (q.state?.length && !q.state.includes(e.state ?? "")) return false;
    if (q.city?.length && !q.city.includes(e.city ?? "")) return false;
    if (q.timeControl?.length && !q.timeControl.includes(e.timeControlType ?? "")) return false;
    if (q.from && e.endDate < q.from) return false;
    if (q.to && e.startDate > q.to) return false;
    if (q.minPrize != null && (e.totalPrizeInr ?? -1) < q.minPrize) return false;
    if (q.maxFee != null && (e.entryFeeMinInr == null || e.entryFeeMinInr > q.maxFee)) return false;
    if (q.fideRated != null && e.fideRated !== q.fideRated) return false;
    return true;
  });
  const nn = (v: number | null, d: number) => v ?? d;
  const sorts: Record<string, (a: EventDetail, b: EventDetail) => number> = {
    startDate: (a, b) => a.startDate.localeCompare(b.startDate),
    "-startDate": (a, b) => b.startDate.localeCompare(a.startDate),
    prize: (a, b) => nn(a.totalPrizeInr, 0) - nn(b.totalPrizeInr, 0),
    "-prize": (a, b) => nn(b.totalPrizeInr, -1) - nn(a.totalPrizeInr, -1),
    fee: (a, b) => nn(a.entryFeeMinInr, 1e9) - nn(b.entryFeeMinInr, 1e9),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  rows = rows.sort(sorts[q.sort ?? "startDate"] ?? sorts.startDate);
  const page = q.page ?? 1, pageSize = q.pageSize ?? 24;
  return {
    data: rows.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
    meta: { total: rows.length, page, pageSize, pageCount: Math.max(1, Math.ceil(rows.length / pageSize)) },
  };
}

export async function mockEvent(code: string): Promise<EventDetail> {
  await delay(200);
  const e = all().find((x) => x.eventCode === code);
  if (!e) throw new ApiError(404, "Event not found");
  return e;
}

export async function mockFilters(): Promise<FilterFacets> {
  await delay(100);
  const l = live();
  return {
    states: facet(l.map((e) => e.state)),
    cities: facet(l.map((e) => e.city)),
    timeControls: facet(l.map((e) => e.timeControlType)),
  };
}

export async function mockStats(): Promise<Stats> {
  await delay(100);
  const today = todayIST();
  const l = live();
  const byMonth: Stats["byMonth"] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const month = d.toISOString().slice(0, 7);
    byMonth.push({ month, count: l.filter((e) => e.startDate.startsWith(month)).length });
  }
  return {
    total: all().length,
    upcoming: all().filter((e) => e.status === "upcoming").length,
    ongoing: all().filter((e) => e.status === "ongoing").length,
    startingThisWeek: l.filter((e) => e.startDate >= today && e.startDate <= addDays(today, 7)).length,
    upcomingPrizePoolInr: all().filter((e) => e.status === "upcoming").reduce((s, e) => s + (e.totalPrizeInr ?? 0), 0),
    extracted: all().filter((e) => e.extractionStatus === "done").length,
    byMonth,
    byState: facet(l.map((e) => e.state)),
    byTimeControl: facet(l.map((e) => e.timeControlType)),
  };
}
