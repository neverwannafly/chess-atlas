import { useMemo, useState } from "react";
import { ChevronRight, LocateFixed, Search } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { FEE_STOPS, PRIZE_STOPS, WHEN_PRESETS, type Filters } from "@/lib/filters";
import { formatInr, formatMonthShort } from "@/lib/format";
import { distanceKm, placePoint, STATE_POINTS, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { Facets } from "./facets";

type Update = (p: Partial<Filters>) => void;
interface PanelProps { f: Filters; update: Update; facets: Facets }

export function SectionLabel({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h3 className="text-label font-medium uppercase tracking-[0.06em] text-muted">{children}</h3>
      {aside}
    </div>
  );
}

function ResetLink({ onClick, show }: { onClick: () => void; show: boolean }) {
  if (!show) return null;
  return <button type="button" onClick={onClick} className="text-small font-medium text-accent hover:underline">Reset</button>;
}

/* ───────────────────────── When ───────────────────────── */

export function WhenPanel({ f, update, facets, big }: PanelProps & { big?: boolean }) {
  const max = Math.max(1, ...facets.months.map((m) => m.count));
  const custom = !!(f.from || f.to);
  const toggleMonth = (m: string) =>
    update({ when: null, from: undefined, to: undefined, months: f.months.includes(m) ? f.months.filter((x) => x !== m) : [...f.months, m].sort() });
  return (
    <div className="space-y-5">
      <div>
        <SectionLabel aside={<ResetLink show={!!(f.when || f.months.length || custom)} onClick={() => update({ when: null, months: [], from: undefined, to: undefined })} />}>Quick picks</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {WHEN_PRESETS.map((p) => (
            <Chip key={p.value} size={big ? "lg" : "md"} pressed={f.when === p.value} count={facets.presets[p.value]} onClick={() => update({ when: f.when === p.value ? null : p.value, months: [], from: undefined, to: undefined })}>
              {p.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Months</SectionLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {facets.months.map(({ month, count }) => {
            const on = f.months.includes(month);
            return (
              <button
                key={month}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMonth(month)}
                className={cn(
                  "relative flex flex-col items-start overflow-hidden rounded-sm border px-2.5 pb-2 pt-1.5 text-left transition-colors duration-[var(--dur-1)]",
                  big ? "h-[52px]" : "h-12",
                  on ? "border-accent/50 bg-accent-soft" : "border-border hover:border-border-strong hover:bg-surface-2",
                  count === 0 && !on && "opacity-45"
                )}
              >
                <span className="text-ui font-medium text-fg">{formatMonthShort(month)}{month.slice(0, 4) !== facets.months[0].month.slice(0, 4) && <span className="ml-1 text-small text-subtle">’{month.slice(2, 4)}</span>}</span>
                <span className="text-small tabular-nums text-muted">{count}</span>
                <span className="absolute bottom-0 left-0 h-[3px] rounded-r-full bg-accent/60 transition-[width]" style={{ width: `${(count / max) * 100}%` }} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <SectionLabel>Custom range</SectionLabel>
        <div className="flex items-center gap-2">
          <DateInput label="From" value={f.from} onChange={(v) => update({ from: v, when: null, months: [] })} />
          <span className="text-subtle" aria-hidden>→</span>
          <DateInput label="To" value={f.to} min={f.from} onChange={(v) => update({ to: v, when: null, months: [] })} />
        </div>
      </div>
    </div>
  );
}

function DateInput({ label, value, onChange, min }: { label: string; value?: string; onChange: (v?: string) => void; min?: string }) {
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        min={min}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-10 w-full rounded-sm border border-border-strong/80 bg-surface px-2.5 text-ui text-fg outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
      />
    </label>
  );
}

/* ───────────────────────── Where ───────────────────────── */

export function WherePanel({ f, update, facets, big, near, setNear }: PanelProps & { big?: boolean; near: LatLng | null; setNear: (p: LatLng | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string[]>(() => facets.states.filter((s) => s.cities.some((c) => f.city.includes(c.value))).map((s) => s.value));
  const [locating, setLocating] = useState<"idle" | "busy" | "denied">("idle");

  const states = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = facets.states;
    if (needle) list = list.filter((s) => s.value.toLowerCase().includes(needle) || s.cities.some((c) => c.value.toLowerCase().includes(needle)));
    if (near) {
      const d = (s: string) => { const p = STATE_POINTS[s]; return p ? distanceKm(near, p) : 1e9; };
      list = [...list].sort((a, b) => d(a.value) - d(b.value));
    }
    return list;
  }, [facets.states, q, near]);

  const toggle = (k: "state" | "city", v: string) => {
    const cur = f[k];
    update({ [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<Filters>);
  };
  const locate = () => {
    if (near) return setNear(null);
    if (!("geolocation" in navigator)) return setLocating("denied");
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setNear([p.coords.latitude, p.coords.longitude]); setLocating("idle"); },
      () => setLocating("denied"),
      { maximumAge: 600_000, timeout: 10_000 }
    );
  };
  const km = (city: string | null, state: string) => {
    if (!near) return null;
    const p = placePoint(city, state);
    return p ? Math.round(distanceKm(near, p) / 10) * 10 : null;
  };

  return (
    <div>
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Find a state or city</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="State or city"
            className={cn("w-full rounded-sm border border-border-strong/80 bg-surface pl-8 pr-2 text-ui text-fg outline-none placeholder:text-subtle focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]", big ? "h-11" : "h-9")}
          />
        </label>
        <button
          type="button"
          onClick={locate}
          aria-pressed={!!near}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-sm border px-3 text-ui font-medium transition-colors",
            big ? "h-11" : "h-9",
            near ? "border-accent/40 bg-accent-soft text-fg" : "border-border-strong/70 bg-surface text-fg hover:bg-surface-2"
          )}
        >
          <LocateFixed className={cn("h-4 w-4", near ? "text-accent" : "text-muted", locating === "busy" && "animate-spin")} aria-hidden />
          Near me
        </button>
      </div>
      {locating === "denied" && <p className="mt-2 text-small text-muted">Location isn't available. Pick a state instead.</p>}
      {(f.state.length > 0 || f.city.length > 0) && (
        <div className="mt-2 flex justify-end"><ResetLink show onClick={() => update({ state: [], city: [] })} /></div>
      )}
      <ul className={cn("-mx-1 mt-2 overflow-y-auto overscroll-contain pr-1", big ? "max-h-none" : "max-h-[300px]")} aria-label="States">
        {states.map((s) => {
          const expanded = open.includes(s.value) || (!!q.trim() && s.cities.some((c) => c.value.toLowerCase().includes(q.trim().toLowerCase())));
          const sOn = f.state.includes(s.value);
          const d = km(null, s.value);
          return (
            <li key={s.value}>
              <div className={cn("flex items-center rounded-sm", s.count === 0 && !sOn && "opacity-45")}>
                <CheckRow on={sOn} onClick={() => toggle("state", s.value)} big={big}>
                  <span className="truncate">{s.value}</span>
                  {d != null && <span className="text-small text-subtle">{d.toLocaleString("en-IN")} km</span>}
                  <span className="ml-auto text-small tabular-nums text-muted">{s.count}</span>
                </CheckRow>
                {s.cities.length > 0 && (
                  <button
                    type="button"
                    aria-label={`${expanded ? "Hide" : "Show"} cities in ${s.value}`}
                    aria-expanded={expanded}
                    onClick={() => setOpen((o) => (o.includes(s.value) ? o.filter((x) => x !== s.value) : [...o, s.value]))}
                    className={cn("flex shrink-0 items-center justify-center rounded-sm text-subtle hover:bg-surface-2 hover:text-fg", big ? "h-11 w-11" : "h-8 w-8")}
                  >
                    <ChevronRight className={cn("h-4 w-4 transition-transform duration-[var(--dur-2)]", expanded && "rotate-90")} aria-hidden />
                  </button>
                )}
              </div>
              {expanded && (
                <ul className="mb-1 ml-4 border-l border-border pl-2">
                  {s.cities.map((c) => (
                    <li key={c.value}>
                      <CheckRow on={f.city.includes(c.value) || sOn} disabled={sOn} onClick={() => toggle("city", c.value)} big={big}>
                        <span className="truncate">{c.value}</span>
                        <span className="ml-auto text-small tabular-nums text-muted">{c.count}</span>
                      </CheckRow>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
        {!states.length && <li className="px-2 py-6 text-center text-small text-muted">No state or city matches “{q}”.</li>}
      </ul>
    </div>
  );
}

function CheckRow({ on, onClick, children, big, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; big?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-sm px-2 text-left text-ui text-fg transition-colors hover:bg-surface-2 disabled:cursor-default disabled:opacity-60", big ? "h-11" : "h-8")}
    >
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors", on ? "border-accent bg-accent text-accent-fg" : "border-border-strong bg-surface")} aria-hidden>
        {on && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {children}
    </button>
  );
}

/* ───────────────────────── Money ───────────────────────── */

/**
 * A stepped slider with a live histogram above it: bars are the events at each stop, lit when they
 * fall inside the current selection. `dir` says which side of the thumb is kept.
 */
function StopSlider({ label, stops, value, onChange, values, binValues = values, dir, fmt, anyLabel }: {
  label: string;
  stops: number[];
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  values: number[];
  /** Values drawn in the histogram (e.g. without unknowns); defaults to `values`. */
  binValues?: number[];
  dir: "min" | "max";
  fmt: (n: number) => string;
  anyLabel: string;
}) {
  // min: index 0 = any. max: last index = any.
  const n = stops.length;
  const idx = dir === "min" ? (value ? Math.max(0, stops.findIndex((s) => s >= value)) : 0) : value == null ? n : Math.max(0, stops.findIndex((s) => s >= value));
  const top = dir === "min" ? n - 1 : n;
  const bins = useMemo(() => {
    const b = new Array(n).fill(0);
    for (const v of binValues) {
      let i = n - 1;
      while (i > 0 && v < stops[i]) i--;
      b[i]++;
    }
    return b;
  }, [binValues, stops, n]);
  const peak = Math.max(1, ...bins);
  const inSel = (i: number) => (dir === "min" ? i >= idx : idx === n || i <= idx);
  const count = values.filter((v) => (dir === "min" ? idx === 0 || v >= stops[idx] : idx === n || v <= stops[idx])).length;
  const current = dir === "min" ? (idx === 0 ? anyLabel : `${fmt(stops[idx])}+`) : idx === n ? anyLabel : stops[idx] === 0 ? "Free only" : `≤ ${fmt(stops[idx])}`;
  const set = (i: number) => onChange(dir === "min" ? (i === 0 ? undefined : stops[i]) : i === n ? undefined : stops[i]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-ui font-medium text-fg">{label}</span>
        <span className="text-ui tabular-nums"><span className="font-medium text-fg">{current}</span><span className="ml-2 text-small text-muted">{count}</span></span>
      </div>
      <div className="flex h-10 items-end gap-[3px] px-[9px]" aria-hidden>
        {bins.map((b, i) => (
          <span
            key={i}
            className={cn("flex-1 rounded-t-[2px] transition-[background-color,height] duration-300", inSel(i) ? "bg-accent/70" : "bg-surface-3")}
            style={{ height: `${Math.max(b ? 10 : 3, (b / peak) * 100)}%` }}
          />
        ))}
        {dir === "max" && <span className="flex-1" />}
      </div>
      <input
        type="range"
        min={0}
        max={top}
        step={1}
        value={idx}
        onChange={(e) => set(+e.target.value)}
        aria-label={label}
        aria-valuetext={current}
        className="range mt-1 w-full"
        style={{ "--fill": `${(idx / top) * 100}%`, "--dir": dir === "min" ? "right" : "left" } as React.CSSProperties}
        data-dir={dir}
      />
      <div className="mt-1 flex justify-between px-0.5 text-label tabular-nums text-subtle" aria-hidden>
        {dir === "min" ? (
          <><span>Any</span><span>{fmt(stops[Math.floor(n / 2)])}</span><span>{fmt(stops[n - 1])}+</span></>
        ) : (
          <><span>Free</span><span>{fmt(stops[Math.floor(n / 2)])}</span><span>Any</span></>
        )}
      </div>
    </div>
  );
}

export function MoneyPanel({ f, update, facets }: PanelProps) {
  const fees = facets.fees.filter((v): v is number => v != null);
  return (
    <div className="space-y-6">
      <StopSlider label="Minimum prize fund" stops={PRIZE_STOPS} value={f.minPrize} onChange={(v) => update({ minPrize: v })} values={facets.prizes} binValues={facets.prizes.filter((v) => v > 0)} dir="min" fmt={formatInr} anyLabel="Any" />
      <StopSlider label="Maximum entry fee" stops={FEE_STOPS} value={f.maxFee} onChange={(v) => update({ maxFee: v })} values={fees} dir="max" fmt={formatInr} anyLabel="Any" />
      <p className="text-small text-subtle">Entry is the cheapest category listed. Many events waive it for titled players.</p>
    </div>
  );
}
