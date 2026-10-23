import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import type { InsightsScope } from "@/types/event";
import { formatInr, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EASE, seq, useReveal, useTip, useWidth } from "./viz";
import { Card, Segmented, SrTable, Tip, TipBody } from "./primitives";

/** Tile-grid map of India: one square per state/UT at its approximate position (col, row). */
const TILES: { abbr: string; name: string; c: number; r: number }[] = [
  { abbr: "JK", name: "Jammu and Kashmir", c: 1, r: 0 },
  { abbr: "LA", name: "Ladakh", c: 2, r: 0 },
  { abbr: "CH", name: "Chandigarh", c: 0, r: 1 },
  { abbr: "PB", name: "Punjab", c: 1, r: 1 },
  { abbr: "HP", name: "Himachal Pradesh", c: 2, r: 1 },
  { abbr: "UK", name: "Uttarakhand", c: 3, r: 1 },
  { abbr: "RJ", name: "Rajasthan", c: 0, r: 2 },
  { abbr: "HR", name: "Haryana", c: 1, r: 2 },
  { abbr: "DL", name: "Delhi", c: 2, r: 2 },
  { abbr: "UP", name: "Uttar Pradesh", c: 3, r: 2 },
  { abbr: "BR", name: "Bihar", c: 4, r: 2 },
  { abbr: "SK", name: "Sikkim", c: 5, r: 2 },
  { abbr: "AS", name: "Assam", c: 6, r: 2 },
  { abbr: "AR", name: "Arunachal Pradesh", c: 7, r: 2 },
  { abbr: "GJ", name: "Gujarat", c: 0, r: 3 },
  { abbr: "MP", name: "Madhya Pradesh", c: 1, r: 3 },
  { abbr: "CG", name: "Chhattisgarh", c: 2, r: 3 },
  { abbr: "JH", name: "Jharkhand", c: 3, r: 3 },
  { abbr: "WB", name: "West Bengal", c: 4, r: 3 },
  { abbr: "ML", name: "Meghalaya", c: 6, r: 3 },
  { abbr: "NL", name: "Nagaland", c: 7, r: 3 },
  { abbr: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", c: 0, r: 4 },
  { abbr: "MH", name: "Maharashtra", c: 1, r: 4 },
  { abbr: "TG", name: "Telangana", c: 2, r: 4 },
  { abbr: "OD", name: "Odisha", c: 3, r: 4 },
  { abbr: "TR", name: "Tripura", c: 5, r: 4 },
  { abbr: "MZ", name: "Mizoram", c: 6, r: 4 },
  { abbr: "MN", name: "Manipur", c: 7, r: 4 },
  { abbr: "GA", name: "Goa", c: 0, r: 5 },
  { abbr: "KA", name: "Karnataka", c: 1, r: 5 },
  { abbr: "AP", name: "Andhra Pradesh", c: 2, r: 5 },
  { abbr: "LD", name: "Lakshadweep", c: 0, r: 6 },
  { abbr: "KL", name: "Kerala", c: 1, r: 6 },
  { abbr: "TN", name: "Tamil Nadu", c: 2, r: 6 },
  { abbr: "PY", name: "Puducherry", c: 3, r: 6 },
  { abbr: "AN", name: "Andaman and Nicobar Islands", c: 5, r: 6 },
];
const COLS = 8;
const ROWS = 7;

type Metric = "count" | "prize";

export function StateMap({ scope, scopeKey }: { scope: InsightsScope; scopeKey: string }) {
  const [metric, setMetric] = useState<Metric>("count");
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [revealRef, shown, reduce] = useReveal<HTMLDivElement>(0.25);
  const { tip, show, hide } = useTip();
  const [hover, setHover] = useState<string | null>(null);
  const navigate = useNavigate();

  const byName = new Map(scope.byState.map((s) => [s.state, s]));
  const val = (s?: { count: number; prizeInr: number }) => (s ? (metric === "count" ? s.count : s.prizeInr) : 0);
  const max = Math.max(1, ...scope.byState.map((s) => val(s)));
  // sqrt scale: Tamil Nadu dwarfs everything else, so a linear ramp would leave most states pale.
  const t = (v: number) => (v > 0 ? 0.08 + 0.92 * Math.sqrt(v / max) : 0);

  const ranked = [...scope.byState].sort((a, b) => val(b) - val(a) || a.state.localeCompare(b.state)).slice(0, 8);
  const rankMax = Math.max(1, ...ranked.map((s) => val(s)));
  const gap = 4;
  const tile = width ? Math.min(52, (width - gap * (COLS - 1)) / COLS) : 0;
  const fmtVal = (v: number) => (metric === "count" ? String(v) : formatInr(v));

  return (
    <Card
      id="map"
      eyebrow="Where"
      title="Tournaments across India"
      note={`${pluralize(scope.byState.length, "state")} and UTs, ${pluralize(scope.cities, "city", "cities")}. Each tile is a state at its rough place on the map; select one to browse it.`}
      action={
        <Segmented id="map-metric" size="sm" label="Measure" value={metric} onChange={setMetric}
          options={[{ value: "count", label: "Tournaments" }, { value: "prize", label: "Prize money" }]} />
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-10">
        <div ref={revealRef} className="min-w-0">
          <div ref={wrapRef} className="relative w-full" style={{ height: tile ? tile * ROWS + gap * (ROWS - 1) : 300 }} onPointerLeave={(e) => { hide(e); setHover(null); }}>
            {tile > 0 && TILES.map((tl) => {
              const s = byName.get(tl.name);
              const v = val(s);
              const tv = t(v);
              const strong = tv > 0.55;
              const x = tl.c * (tile + gap);
              const y = tl.r * (tile + gap);
              const dim = hover != null && hover !== tl.abbr;
              const open = (e: { pointerType?: string }) => show(e, {
                x: x + tile / 2 + (x + tile / 2 > width / 2 ? -tile / 2 : tile / 2),
                y: y + tile / 2,
                content: (
                  <TipBody
                    title={tl.name}
                    rows={s ? [
                      { key: s.count === 1 ? "tournament" : "tournaments", value: s.count },
                      { key: "prize money", value: s.prizeInr ? formatInr(s.prizeInr) : "—" },
                    ] : [{ key: "", value: "No tournaments" }]}
                    foot={s ? "Select to browse" : undefined}
                  />
                ),
              });
              return (
                <motion.button
                  key={tl.abbr}
                  type="button"
                  disabled={!s}
                  aria-label={`${tl.name}: ${s ? `${pluralize(s.count, "tournament")}, ${formatInr(s.prizeInr)}` : "no tournaments"}`}
                  onClick={() => navigate(`/?state=${encodeURIComponent(tl.name)}`)}
                  onPointerEnter={(e) => { setHover(tl.abbr); open(e); }}
                  onFocus={() => { setHover(tl.abbr); open({}); }}
                  onBlur={() => { setHover(null); hide(); }}
                  initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                  animate={shown ? { opacity: dim ? 0.55 : 1, scale: hover === tl.abbr ? 1.08 : 1 } : undefined}
                  transition={{
                    opacity: { duration: hover != null ? 0.15 : 0.5, delay: hover != null || reduce ? 0 : (tl.c + tl.r) * 0.045 },
                    scale: hover != null ? { type: "spring", stiffness: 500, damping: 30 } : { duration: 0.6, ease: EASE, delay: reduce ? 0 : (tl.c + tl.r) * 0.045 },
                  }}
                  className={cn(
                    "absolute flex flex-col items-center justify-center rounded-[6px] outline-offset-2 disabled:cursor-default",
                    hover === tl.abbr && "z-10 shadow-e2",
                  )}
                  style={{
                    left: x, top: y, width: tile, height: tile,
                    background: s ? seq(tv) : "transparent",
                    border: s ? "none" : "1px solid var(--border)",
                    transition: "background-color 400ms var(--motion-out)",
                  }}
                >
                  <span className={cn("text-[11px] font-semibold leading-none tracking-[0.02em]", s ? (strong ? "text-accent-fg" : "text-fg") : "text-subtle")}>{tl.abbr}</span>
                  {s && tile >= 40 && (
                    <span className={cn("mt-1 text-[10px] leading-none tabular-nums", strong ? "text-accent-fg/80" : "text-muted")}>
                      {metric === "count" ? v : v ? formatInr(v).replace("₹", "") : "–"}
                    </span>
                  )}
                </motion.button>
              );
            })}
            <Tip tip={tip} width={width} />
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="mb-3 text-small font-medium text-muted">{metric === "count" ? "Most tournaments" : "Most prize money"}</h3>
          <ol className="space-y-0.5">
            {ranked.map((s, i) => (
              <li key={s.state}>
                <Link
                  to={`/?state=${encodeURIComponent(s.state)}`}
                  className="group grid min-h-10 grid-cols-[1rem_6.75rem_minmax(0,1fr)_3.5rem] sm:grid-cols-[1.25rem_minmax(0,9rem)_minmax(0,1fr)_3.75rem] items-center gap-3 rounded-sm px-2 text-ui transition-colors hover:bg-surface-2"
                  onPointerEnter={() => setHover(TILES.find((tl) => tl.name === s.state)?.abbr ?? null)}
                  onPointerLeave={() => setHover(null)}
                >
                  <span className="text-label text-subtle tabular-nums">{i + 1}</span>
                  <span className="truncate">{s.state}</span>
                  <span className="relative h-2 rounded-full bg-surface-2" aria-hidden>
                    <motion.span
                      key={`${scopeKey}-${metric}`}
                      className="absolute inset-y-0 left-0 rounded-full bg-accent"
                      initial={reduce ? false : { width: 0 }}
                      animate={shown ? { width: `${Math.max(3, (val(s) / rankMax) * 100)}%` } : undefined}
                      transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.2 + i * 0.05 }}
                      style={{ opacity: i === 0 ? 1 : 0.55 }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums">{fmtVal(val(s))}</span>
                </Link>
              </li>
            ))}
          </ol>
          {scope.topCities.length > 0 && (
            <>
              <h3 className="mb-3 mt-7 text-small font-medium text-muted">Busiest cities</h3>
              <ul className="flex flex-wrap gap-2">
                {scope.topCities.map((c) => (
                  <li key={`${c.city}-${c.state}`}>
                    <Link
                      to={`/?city=${encodeURIComponent(c.city)}`}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-small transition-colors hover:border-border-strong hover:bg-surface-2"
                    >
                      {c.city}
                      <span className="text-subtle tabular-nums">{c.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <SrTable caption="Tournaments by state" head={["State", "Tournaments", "Prize money"]} rows={scope.byState.map((s) => [s.state, s.count, formatInr(s.prizeInr)])} />
    </Card>
  );
}
