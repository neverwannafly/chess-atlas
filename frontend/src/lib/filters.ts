import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { EventSummary } from "@/types/event";
import { registrationOpen } from "@/lib/eventFacts";
import { addDays, formatInr, formatMonthShort, todayIST } from "@/lib/format";

/* ───────────────────────── model ─────────────────────────
   Every filter lives in the URL so a view is shareable and Back restores it. The catalogue is small
   (a few hundred events), so the page loads it whole and filters on the client: instant, with true
   faceted counts (each option counted against every *other* active filter). */

export const FORMATS = ["Classical", "Rapid", "Blitz"] as const;
export type Format = (typeof FORMATS)[number];

export const WHEN_PRESETS = [
  { value: "weekend", label: "This weekend" },
  { value: "7d", label: "Next 7 days" },
  { value: "30d", label: "Next 30 days" },
] as const;
export type WhenPreset = (typeof WHEN_PRESETS)[number]["value"];

export const SORTS = [
  { value: "soon", label: "Soonest" },
  { value: "prize", label: "Biggest prize" },
  { value: "fee", label: "Cheapest entry" },
  { value: "name", label: "Name" },
] as const;
export type SortKey = (typeof SORTS)[number]["value"];

/** Slider stops. Prize: minimum prize fund. Fee: maximum cheapest entry fee (0 = free entry). */
export const PRIZE_STOPS = [0, 50_000, 1_00_000, 2_00_000, 3_00_000, 5_00_000, 10_00_000, 20_00_000, 50_00_000];
export const FEE_STOPS = [0, 250, 500, 1000, 1500, 2000, 3000, 5000];

export interface Filters {
  q: string;
  format: Format | null;
  when: WhenPreset | null;
  months: string[]; // YYYY-MM
  from?: string;
  to?: string;
  state: string[];
  city: string[];
  minPrize?: number;
  /** undefined = any fee; 0 = free entry only. */
  maxFee?: number;
  fide: boolean;
  open: boolean;
  past: boolean;
  sort: SortKey;
}

export type Dim = "q" | "format" | "when" | "where" | "prize" | "fee" | "fide" | "open";

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
const int = (v: string | null) => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};
const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseFilters(sp: URLSearchParams): Filters {
  const tc = sp.get("tc");
  const when = sp.get("when");
  const sort = sp.get("sort");
  const minPrize = int(sp.get("prize") ?? sp.get("minPrize"));
  return {
    q: (sp.get("q") ?? "").slice(0, 120),
    format: (FORMATS as readonly string[]).includes(tc ?? "") ? (tc as Format) : null,
    when: WHEN_PRESETS.some((p) => p.value === when) ? (when as WhenPreset) : null,
    months: list(sp.get("months")).filter((m) => /^\d{4}-\d{2}$/.test(m)),
    from: dateOk(sp.get("from")),
    to: dateOk(sp.get("to")),
    state: list(sp.get("state")),
    city: list(sp.get("city")),
    minPrize: minPrize || undefined,
    maxFee: int(sp.get("fee") ?? sp.get("maxFee")),
    fide: sp.get("fide") === "1",
    open: sp.get("open") === "1",
    past: sp.get("past") === "1",
    sort: SORTS.some((s) => s.value === sort) ? (sort as SortKey) : "soon",
  };
}

export function serialize(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.format) p.set("tc", f.format);
  if (f.when) p.set("when", f.when);
  if (f.months.length) p.set("months", f.months.join(","));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.state.length) p.set("state", f.state.join(","));
  if (f.city.length) p.set("city", f.city.join(","));
  if (f.minPrize) p.set("prize", String(f.minPrize));
  if (f.maxFee != null) p.set("fee", String(f.maxFee));
  if (f.fide) p.set("fide", "1");
  if (f.open) p.set("open", "1");
  if (f.past) p.set("past", "1");
  if (f.sort !== "soon") p.set("sort", f.sort);
  return p;
}

export const EMPTY: Filters = parseFilters(new URLSearchParams());

export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const key = sp.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => parseFilters(sp), [key]);
  // Read the live URL rather than the last rendered params, so two quick updates never overwrite each other.
  const live = () => parseFilters(new URLSearchParams(window.location.search));
  const update = useCallback(
    (patch: Partial<Filters>) => setSp(serialize({ ...live(), ...patch }), { replace: true, preventScrollReset: true }),
    [setSp]
  );
  const clear = useCallback(
    () => { const cur = live(); setSp(serialize({ ...EMPTY, sort: cur.sort, past: cur.past }), { replace: true, preventScrollReset: true }); },
    [setSp]
  );
  return { filters, update, clear };
}

/* ───────────────────────── dates ───────────────────────── */

export function weekendRange(today = todayIST()): [string, string] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun … 6 Sat
  if (dow === 0) return [today, today];
  if (dow === 6) return [today, addDays(today, 1)];
  const sat = addDays(today, 6 - dow);
  return [sat, addDays(sat, 1)];
}

export function presetRange(p: WhenPreset, today = todayIST()): [string, string] {
  if (p === "weekend") return weekendRange(today);
  return [today, addDays(today, p === "7d" ? 6 : 29)];
}

const monthEnd = (ym: string) => {
  const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0));
  return d.toISOString().slice(0, 10);
};
const overlaps = (e: EventSummary, from: string, to: string) => e.startDate <= to && e.endDate >= from;

/** The next `n` calendar months starting with today's. */
export function upcomingMonths(n = 9, today = todayIST()): string[] {
  const out: string[] = [];
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

/* ───────────────────────── matching ───────────────────────── */

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const haystacks = new WeakMap<EventSummary, string>();
function hay(e: EventSummary) {
  let h = haystacks.get(e);
  if (h == null) {
    h = norm([e.name, e.city, e.state, e.venueName, e.tagline, e.eventCode].filter(Boolean).join(" "));
    haystacks.set(e, h);
  }
  return h;
}

export interface Ctx {
  today: string;
}

/** Does `e` pass every active filter except `skip`? */
export function matches(e: EventSummary, f: Filters, ctx: Ctx, skip?: Dim): boolean {
  if (!f.past && e.endDate < ctx.today) return false;
  if (skip !== "q" && f.q.trim()) {
    const h = hay(e);
    for (const t of norm(f.q).split(/\s+/)) if (t && !h.includes(t)) return false;
  }
  if (skip !== "format" && f.format && e.timeControlType !== f.format) return false;
  if (skip !== "when") {
    if (f.when) {
      const [a, b] = presetRange(f.when, ctx.today);
      if (!overlaps(e, a, b)) return false;
    }
    if (f.months.length && !f.months.some((m) => overlaps(e, `${m}-01`, monthEnd(m)))) return false;
    if ((f.from || f.to) && !overlaps(e, f.from ?? "0000-01-01", f.to ?? "9999-12-31")) return false;
  }
  if (skip !== "where" && (f.state.length || f.city.length)) {
    const inState = !!e.state && f.state.includes(e.state);
    const inCity = !!e.city && f.city.includes(e.city);
    if (!inState && !inCity) return false;
  }
  if (skip !== "prize" && f.minPrize && !((e.totalPrizeInr ?? 0) >= f.minPrize)) return false;
  if (skip !== "fee" && f.maxFee != null && !(e.entryFeeMinInr != null && e.entryFeeMinInr <= f.maxFee)) return false;
  if (skip !== "fide" && f.fide && e.fideRated !== true) return false;
  if (skip !== "open" && f.open && !registrationOpen(e, ctx.today)) return false;
  return true;
}

export function applyFilters(events: EventSummary[], f: Filters, ctx: Ctx, skip?: Dim) {
  return events.filter((e) => matches(e, f, ctx, skip));
}

/** Count events (passing every filter but `dim`) per key. */
export function facet(events: EventSummary[], f: Filters, ctx: Ctx, dim: Dim, keys: (e: EventSummary) => (string | null | undefined)[]) {
  const m = new Map<string, number>();
  for (const e of events) {
    if (!matches(e, f, ctx, dim)) continue;
    for (const k of keys(e)) if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/* ───────────────────────── sorting ───────────────────────── */

const byStart = (a: EventSummary, b: EventSummary) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name);

export function sortEvents(events: EventSummary[], sort: SortKey, today: string): EventSummary[] {
  const out = [...events];
  const past = (e: EventSummary) => e.endDate < today;
  switch (sort) {
    case "prize":
      return out.sort((a, b) => (b.totalPrizeInr ?? -1) - (a.totalPrizeInr ?? -1) || byStart(a, b));
    case "fee":
      return out.sort((a, b) => (a.entryFeeMinInr ?? Infinity) - (b.entryFeeMinInr ?? Infinity) || byStart(a, b));
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    default:
      // upcoming soonest first; finished ones after, most recent first
      return out.sort((a, b) => Number(past(a)) - Number(past(b)) || (past(a) ? -byStart(a, b) : byStart(a, b)));
  }
}

/* ───────────────────────── labels ───────────────────────── */

export const prizeLabel = (n: number) => `${formatInr(n)}+ prize`;
export const feeLabel = (n: number) => (n === 0 ? "Free entry" : `Entry ≤ ${formatInr(n)}`);

export function whenLabel(f: Filters): string | null {
  if (f.when) return WHEN_PRESETS.find((p) => p.value === f.when)!.label;
  if (f.months.length) return f.months.length <= 2 ? f.months.map(formatMonthShort).join(", ") : `${f.months.length} months`;
  if (f.from || f.to) {
    const d = (s?: string) => (s ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${s}T00:00:00Z`)) : "…");
    return `${d(f.from)} – ${d(f.to)}`;
  }
  return null;
}

export function whereLabel(f: Filters): string | null {
  const all = [...f.city, ...f.state];
  if (!all.length) return null;
  return all.length === 1 ? all[0] : `${all[0]} +${all.length - 1}`;
}

export function moneyLabel(f: Filters): string | null {
  const parts = [f.minPrize ? prizeLabel(f.minPrize) : null, f.maxFee != null ? feeLabel(f.maxFee) : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export interface ActiveChip {
  key: string;
  label: string;
  patch: Partial<Filters>;
  dim: Dim;
}

/** Active filters as removable chips, in display order. */
export function activeChips(f: Filters): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (f.q) out.push({ key: "q", label: `“${f.q}”`, patch: { q: "" }, dim: "q" });
  if (f.format) out.push({ key: "format", label: f.format, patch: { format: null }, dim: "format" });
  const w = whenLabel(f);
  if (w) out.push({ key: "when", label: w, patch: { when: null, months: [], from: undefined, to: undefined }, dim: "when" });
  for (const s of f.state) out.push({ key: `s:${s}`, label: s, patch: { state: f.state.filter((x) => x !== s) }, dim: "where" });
  for (const c of f.city) out.push({ key: `c:${c}`, label: c, patch: { city: f.city.filter((x) => x !== c) }, dim: "where" });
  if (f.minPrize) out.push({ key: "prize", label: prizeLabel(f.minPrize), patch: { minPrize: undefined }, dim: "prize" });
  if (f.maxFee != null) out.push({ key: "fee", label: feeLabel(f.maxFee), patch: { maxFee: undefined }, dim: "fee" });
  if (f.fide) out.push({ key: "fide", label: "FIDE rated", patch: { fide: false }, dim: "fide" });
  if (f.open) out.push({ key: "open", label: "Registration open", patch: { open: false }, dim: "open" });
  return out;
}

export const activeCount = (f: Filters) => activeChips(f).filter((c) => c.key !== "q").length;
export const hasActiveFilters = (f: Filters) => activeChips(f).length > 0;
