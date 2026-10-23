import type { EventSummary } from "@/types/event";
import { registrationOpen } from "@/lib/eventFacts";
import { FORMATS, matches, presetRange, upcomingMonths, WHEN_PRESETS, type Ctx, type Dim, type Filters } from "@/lib/filters";

export interface Facets {
  total: number;
  format: Record<string, number>;
  presets: Record<string, number>;
  months: { month: string; count: number }[];
  states: { value: string; count: number; cities: { value: string; count: number }[] }[];
  prizes: number[]; // prize values of events passing every filter but prize (0 = unknown)
  fees: (number | null)[];
  fide: number;
  open: number;
}

const overlaps = (e: EventSummary, a: string, b: string) => e.startDate <= b && e.endDate >= a;
const monthEnd = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).toISOString().slice(0, 10);

/** Faceted counts: each option is counted against every other active filter, never its own dimension. */
export function computeFacets(all: EventSummary[], f: Filters, ctx: Ctx): Facets {
  const pass = (dim: Dim) => all.filter((e) => matches(e, f, ctx, dim));

  const byFormat = pass("format");
  const format: Record<string, number> = { all: byFormat.length };
  for (const t of FORMATS) format[t] = byFormat.filter((e) => e.timeControlType === t).length;

  const byWhen = pass("when");
  const presets: Record<string, number> = {};
  for (const p of WHEN_PRESETS) {
    const [a, b] = presetRange(p.value, ctx.today);
    presets[p.value] = byWhen.filter((e) => overlaps(e, a, b)).length;
  }
  const months = upcomingMonths(9, ctx.today).map((m) => ({ month: m, count: byWhen.filter((e) => overlaps(e, `${m}-01`, monthEnd(m))).length }));

  const byWhere = pass("where");
  const st = new Map<string, { count: number; cities: Map<string, number> }>();
  for (const e of byWhere) {
    if (!e.state) continue;
    let s = st.get(e.state);
    if (!s) st.set(e.state, (s = { count: 0, cities: new Map() }));
    s.count++;
    if (e.city) s.cities.set(e.city, (s.cities.get(e.city) ?? 0) + 1);
  }
  // keep selected-but-now-empty places visible so they can be unticked
  for (const s of f.state) if (!st.has(s)) st.set(s, { count: 0, cities: new Map() });
  const states = [...st.entries()]
    .map(([value, s]) => ({ value, count: s.count, cities: [...s.cities.entries()].map(([v, c]) => ({ value: v, count: c })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return {
    total: all.filter((e) => matches(e, f, ctx)).length,
    format,
    presets,
    months,
    states,
    prizes: pass("prize").map((e) => e.totalPrizeInr ?? 0),
    fees: pass("fee").map((e) => e.entryFeeMinInr),
    fide: pass("fide").filter((e) => e.fideRated === true).length,
    open: pass("open").filter((e) => registrationOpen(e, ctx.today)).length,
  };
}
