import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { EventQuery } from "@/lib/api";
import { addDays, formatInr, todayIST } from "@/lib/format";

export type ViewMode = "cards" | "list" | "calendar";
export const STATUSES = ["upcoming", "ongoing", "past"] as const;
export const DEFAULT_STATUS = ["upcoming", "ongoing"];
export const TIME_CONTROLS = ["Classical", "Rapid", "Blitz", "Mixed"];
export const SORTS = [
  { value: "startDate", label: "Soonest first" },
  { value: "-startDate", label: "Latest first" },
  { value: "-prize", label: "Biggest prize" },
  { value: "fee", label: "Lowest fee" },
  { value: "name", label: "Name A–Z" },
];
export const PRIZE_STEPS = [0, 50000, 100000, 500000, 1000000, 2500000];
export const FEE_STEPS = [0, 500, 1000, 2000, 5000];

export interface Filters {
  q: string;
  status: string[]; // [] means default
  state: string[];
  city: string[];
  timeControl: string[];
  from?: string;
  to?: string;
  minPrize?: number;
  maxFee?: number;
  fide: boolean;
  sort: string;
  view: ViewMode;
  month?: string; // YYYY-MM, calendar view
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const num = (v: string | null) => {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseFilters(sp: URLSearchParams): Filters {
  const view = sp.get("view");
  const month = sp.get("month");
  return {
    q: sp.get("q") ?? "",
    status: list(sp.get("status")).filter((s) => (STATUSES as readonly string[]).includes(s)),
    state: list(sp.get("state")),
    city: list(sp.get("city")),
    timeControl: list(sp.get("tc")).filter((t) => TIME_CONTROLS.includes(t)),
    from: dateOk(sp.get("from")),
    to: dateOk(sp.get("to")),
    minPrize: num(sp.get("minPrize")),
    maxFee: num(sp.get("maxFee")),
    fide: sp.get("fide") === "1",
    sort: SORTS.some((s) => s.value === sp.get("sort")) ? sp.get("sort")! : "startDate",
    view: view === "list" || view === "calendar" ? view : "cards",
    month: month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
  };
}

export function serialize(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status.length) p.set("status", f.status.join(","));
  if (f.state.length) p.set("state", f.state.join(","));
  if (f.city.length) p.set("city", f.city.join(","));
  if (f.timeControl.length) p.set("tc", f.timeControl.join(","));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.minPrize) p.set("minPrize", String(f.minPrize));
  if (f.maxFee) p.set("maxFee", String(f.maxFee));
  if (f.fide) p.set("fide", "1");
  if (f.sort !== "startDate") p.set("sort", f.sort);
  if (f.view !== "cards") p.set("view", f.view);
  if (f.month) p.set("month", f.month);
  return p;
}

export function toQuery(f: Filters, extra: Partial<EventQuery> = {}): EventQuery {
  const status = f.status.length ? f.status : DEFAULT_STATUS;
  return {
    q: f.q,
    status,
    state: f.state,
    city: f.city,
    timeControl: f.timeControl,
    from: f.from,
    to: f.to,
    minPrize: f.minPrize,
    maxFee: f.maxFee,
    fideRated: f.fide ? true : undefined,
    sort: f.sort,
    ...extra,
  };
}

export function useFilters() {
  const [sp, setSp] = useSearchParams();
  const spKey = sp.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filters = useMemo(() => parseFilters(sp), [spKey]);
  const update = useCallback(
    (patch: Partial<Filters>, opts?: { push?: boolean }) =>
      setSp((cur) => serialize({ ...parseFilters(cur), ...patch }), { replace: !opts?.push }),
    [setSp]
  );
  const clear = useCallback(
    () => setSp((cur) => serialize({ ...parseFilters(new URLSearchParams()), view: parseFilters(cur).view, sort: parseFilters(cur).sort }), { replace: true }),
    [setSp]
  );
  return { filters, update, clear };
}

// ---- date presets ----
export type Preset = "weekend" | "30days" | "custom";
export function weekendRange(today = todayIST()): [string, string] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 Sun
  if (dow === 0) return [today, today];
  if (dow === 6) return [today, addDays(today, 1)];
  const sat = addDays(today, 6 - dow);
  return [sat, addDays(sat, 1)];
}
export function presetRange(p: Exclude<Preset, "custom">): [string, string] {
  const today = todayIST();
  return p === "weekend" ? weekendRange(today) : [today, addDays(today, 30)];
}
export function activePreset(f: Filters): Preset | null {
  if (!f.from && !f.to) return null;
  for (const p of ["weekend", "30days"] as const) {
    const [a, b] = presetRange(p);
    if (f.from === a && f.to === b) return p;
  }
  return "custom";
}

export function hasActiveFilters(f: Filters) {
  return !!(f.q || f.status.length || f.state.length || f.city.length || f.timeControl.length || f.from || f.to || f.minPrize || f.maxFee || f.fide);
}

export const prizeLabel = (n: number) => `${formatInr(n)}+ prize`;
export const feeLabel = (n: number) => `Fee up to ${formatInr(n)}`;
