import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { FideRatingPoint, RatingList } from "@/types/chessresults";
import { Tip, TipBody, SrTable } from "@/components/insights/primitives";
import { EASE, useReveal, useTip, useWidth, VIZ_VARS } from "@/components/insights/viz";
import { cn } from "@/lib/utils";

// Reuses the validated format hues from Insights: standard = classical blue, rapid = teal, blitz = orange.
const LISTS: { key: RatingList; label: string; color: string }[] = [
  { key: "standard", label: "Standard", color: "var(--viz-classical)" },
  { key: "rapid", label: "Rapid", color: "var(--viz-rapid)" },
  { key: "blitz", label: "Blitz", color: "var(--viz-blitz)" },
];

const monthIndex = (p: string) => +p.slice(0, 4) * 12 + (+p.slice(5, 7) - 1);
const monthLabel = (p: string, withYear = true) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "short", ...(withYear ? { year: "numeric" } : {}) }).format(new Date(`${p}-01T00:00:00Z`));

function yTicks(lo: number, hi: number): number[] {
  const span = Math.max(50, hi - lo);
  const step = [25, 50, 100, 200, 250, 500].find((s) => span / s <= 5) ?? 500;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step / 2; v += step) out.push(v);
  return out;
}

export function RatingChart({ points }: { points: FideRatingPoint[] }) {
  const present = LISTS.filter((l) => points.some((p) => p.list === l.key));
  const [hidden, setHidden] = useState<Set<RatingList>>(() => new Set());
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [revealRef, shown, reduce] = useReveal<SVGSVGElement>(0.2);
  const { tip, show, hide } = useTip();
  const [hoverM, setHoverM] = useState<number | null>(null);

  const series = useMemo(
    () => present.map((l) => ({ ...l, pts: points.filter((p) => p.list === l.key).sort((a, b) => a.period.localeCompare(b.period)) })),
    [points, present],
  );
  const visible = series.filter((s) => !hidden.has(s.key));
  const all = visible.flatMap((s) => s.pts);
  const months = series.flatMap((s) => s.pts.map((p) => monthIndex(p.period)));
  const m0 = Math.min(...months), m1 = Math.max(...months);
  const lo = all.length ? Math.min(...all.map((p) => p.rating)) : 1000;
  const hi = all.length ? Math.max(...all.map((p) => p.rating)) : 2000;
  const ticks = yTicks(lo - 20, hi + 20);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];

  const H = 260;
  const narrow = width < 520;
  const m = { t: 16, r: narrow ? 12 : 72, b: 28, l: 44 };
  const iw = Math.max(1, width - m.l - m.r), ih = H - m.t - m.b;
  const x = (mi: number) => m.l + (m1 === m0 ? iw / 2 : ((mi - m0) / (m1 - m0)) * iw);
  const y = (r: number) => m.t + ih - ((r - y0) / (y1 - y0 || 1)) * ih;

  // ~5 x labels on January or evenly spaced months
  const span = m1 - m0;
  const every = span <= 6 ? 1 : span <= 14 ? 3 : span <= 30 ? 6 : 12;
  const xTicks: number[] = [];
  for (let mi = m0; mi <= m1; mi++) if ((mi % 12) % every === 0) xTicks.push(mi);
  const periodOf = (mi: number) => `${Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, "0")}`;

  const toggle = (k: RatingList) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(k)) n.delete(k);
      else if (present.length - n.size > 1) n.add(k);
      return n;
    });

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const mi = Math.round(m0 + (m1 === m0 ? 0 : (px / rect.width) * (m1 - m0)));
    const rows = visible
      .map((s) => {
        // latest published value at or before the hovered month
        const p = [...s.pts].reverse().find((q) => monthIndex(q.period) <= mi);
        return p ? { key: s.label, value: p.rating, color: s.color, exact: monthIndex(p.period) === mi } : null;
      })
      .filter(Boolean) as { key: string; value: number; color: string; exact: boolean }[];
    if (!rows.length) return hide();
    setHoverM(mi);
    show(e, {
      x: x(mi),
      y: m.t + ih / 2,
      content: <TipBody title={monthLabel(periodOf(mi))} rows={rows.map((r) => ({ key: r.key + (r.exact ? "" : " (carried)"), value: r.value, color: r.color }))} />,
    });
  };

  const last = (s: (typeof series)[number]) => s.pts[s.pts.length - 1];

  return (
    <div className={VIZ_VARS}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Rating lists">
        {series.map((s) => {
          const on = !hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-ui font-medium transition-colors",
                on ? "border-border-strong bg-surface text-fg shadow-e1" : "border-border bg-transparent text-subtle",
              )}
            >
              <span aria-hidden className="h-[2px] w-3.5 rounded-full" style={{ background: on ? s.color : "var(--border-strong)" }} />
              {s.label}
              <span className="font-mono text-small text-muted">{last(s).rating}</span>
            </button>
          );
        })}
      </div>
      <div ref={wrapRef} className="relative">
        {width > 0 && (
          <svg ref={revealRef} width={width} height={H} role="img" aria-label="FIDE rating over time" className="block overflow-visible">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--fg-subtle)] font-mono text-[11px]">{t}</text>
              </g>
            ))}
            {xTicks.map((mi) => (
              <text key={mi} x={x(mi)} y={H - 8} textAnchor="middle" className="fill-[var(--fg-subtle)] text-[11px]">
                {mi % 12 === 0 ? String(Math.floor(mi / 12)) : monthLabel(periodOf(mi), false)}
              </text>
            ))}
            {hoverM != null && tip && (
              <line x1={x(hoverM)} x2={x(hoverM)} y1={m.t} y2={m.t + ih} stroke="var(--fg-subtle)" strokeWidth={1} shapeRendering="crispEdges" />
            )}
            {visible.map((s) => {
              const d = s.pts.map((p, i) => `${i ? "L" : "M"}${x(monthIndex(p.period)).toFixed(1)},${y(p.rating).toFixed(1)}`).join("");
              const lp = last(s);
              const hov = hoverM != null && tip ? [...s.pts].reverse().find((q) => monthIndex(q.period) <= hoverM) : null;
              return (
                <g key={s.key}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: shown ? 1 : 0 }}
                    transition={{ duration: 0.9, ease: EASE }}
                  />
                  {s.pts.length === 1 && <circle cx={x(monthIndex(lp.period))} cy={y(lp.rating)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
                  {hov && <circle cx={x(monthIndex(hov.period))} cy={y(hov.rating)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />}
                  {!narrow && (
                    <text x={x(monthIndex(lp.period)) + 8} y={y(lp.rating)} dy="0.32em" className="fill-[var(--fg-muted)] text-[11px] font-medium">
                      {s.label} <tspan className="fill-[var(--fg)] font-mono">{lp.rating}</tspan>
                    </text>
                  )}
                </g>
              );
            })}
            <rect
              x={m.l}
              y={m.t}
              width={iw}
              height={ih}
              fill="transparent"
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={(e) => { hide(e); setHoverM(null); }}
              style={{ touchAction: "pan-y" }}
            />
          </svg>
        )}
        <Tip tip={tip} width={width} />
      </div>
      <SrTable
        caption="FIDE ratings by month"
        head={["Month", ...series.map((s) => s.label)]}
        rows={[...new Set(series.flatMap((s) => s.pts.map((p) => p.period)))].sort().map((p) => [
          monthLabel(p),
          ...series.map((s) => s.pts.find((q) => q.period === p)?.rating ?? "—"),
        ])}
      />
    </div>
  );
}
