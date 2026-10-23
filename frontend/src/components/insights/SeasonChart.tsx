import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import type { Insights } from "@/types/event";
import { formatInr, formatMonthLabel, formatMonthShort } from "@/lib/format";
import { compact, EASE, FORMATS, formatColor, formatName, niceTicks, useReveal, useTip, useWidth } from "./viz";
import { Card, Segmented, SrTable, Swatch, Tip, TipBody } from "./primitives";

type Metric = "count" | "prize";

/** Column path with only the top corners rounded (data-end), square at the baseline. */
function colPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

const lastDay = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();

export function SeasonChart({ data }: { data: Insights }) {
  const [metric, setMetric] = useState<Metric>("count");
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [revealRef, shown, reduce] = useReveal<HTMLDivElement>(0.3);
  const { tip, show, hide } = useTip();
  const [hover, setHover] = useState<number | null>(null);
  const navigate = useNavigate();

  const months = data.months;
  const thisMonth = data.today.slice(0, 7);
  const narrow = width < 560;
  const H = narrow ? 210 : 260;
  const m = { l: 34, r: 4, t: 26, b: 34 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = H - m.t - m.b;
  const slot = months.length ? iw / months.length : 0;
  const bw = Math.min(24, Math.max(4, slot * 0.62));

  const values = months.map((mo) => (metric === "count" ? mo.total : mo.prizeInr));
  const ticks = niceTicks(Math.max(1, ...values), narrow ? 3 : 4);
  const yMax = ticks[ticks.length - 1] || 1;
  const y = (v: number) => (v / yMax) * ih;
  const peak = values.indexOf(Math.max(...values));
  const curIdx = months.findIndex((mo) => mo.month === thisMonth);
  const todayX = curIdx >= 0 ? m.l + slot * (curIdx + (+data.today.slice(8, 10) - 0.5) / lastDay(thisMonth)) : null;

  const totals = useMemo(() => {
    const t = Object.fromEntries(FORMATS.map((f) => [f, 0])) as Record<string, number>;
    for (const mo of months) for (const f of FORMATS) t[f] += mo.byFormat[f];
    return t;
  }, [months]);

  const linkFor = (ym: string) => {
    return `/?months=${ym}${ym <= thisMonth ? "&past=1" : ""}`;
  };

  return (
    <Card
      id="season"
      eyebrow="The season"
      title="Tournaments by start month"
      note={metric === "count" ? "Every month on record, split by format. Past months are dimmed; select a month to see its tournaments." : "Total advertised prize money by start month. Festival sections sharing one purse count it once."}
      action={
        <Segmented id="season-metric" size="sm" label="Measure" value={metric} onChange={setMetric}
          options={[{ value: "count", label: "Tournaments" }, { value: "prize", label: "Prize money" }]} />
      }
    >
      <div className="mb-4 flex min-h-5 flex-wrap gap-x-4 gap-y-1.5 text-small text-muted">
        {metric === "count" ? (
          FORMATS.filter((f) => totals[f] > 0).map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <Swatch color={formatColor(f)} />
              {formatName(f)} <span className="text-subtle tabular-nums">{totals[f]}</span>
            </span>
          ))
        ) : (
          <span className="inline-flex items-center gap-1.5"><Swatch color="var(--accent)" />Prize money, ₹</span>
        )}
      </div>
      <div ref={revealRef}>
        <div ref={wrapRef} className="relative" style={{ height: H }} onPointerLeave={(e) => { hide(e); setHover(null); }}>
          {width > 0 && (
            <svg width={width} height={H} role="img" aria-label={`Column chart of tournaments by start month, ${months[0]?.month} to ${months[months.length - 1]?.month}`} className="overflow-visible">
              {/* grid + y ticks */}
              {ticks.map((t) => (
                <g key={t} transform={`translate(0 ${m.t + ih - y(t)})`}>
                  <line x1={m.l} x2={width - m.r} stroke={t === 0 ? "var(--border-strong)" : "var(--border)"} strokeWidth={1} shapeRendering="crispEdges" />
                  <text x={m.l - 8} dy="0.32em" textAnchor="end" className="fill-subtle text-[11px] tabular-nums">
                    {metric === "prize" ? (t === 0 ? "0" : `₹${compact(t)}`) : t}
                  </text>
                </g>
              ))}

              {/* today marker */}
              {todayX != null && (
                <g>
                  <line x1={todayX} x2={todayX} y1={m.t - 14} y2={m.t + ih} stroke="var(--fg-subtle)" strokeWidth={1} shapeRendering="crispEdges" />
                  <text x={todayX + 4} y={m.t - 8} className="fill-muted font-mono text-[10px] uppercase tracking-[0.06em]">Today</text>
                </g>
              )}

              {/* columns */}
              {months.map((mo, i) => {
                const cx = m.l + slot * i + slot / 2;
                const x0 = cx - bw / 2;
                const segs = metric === "count"
                  ? FORMATS.map((f) => ({ f, v: mo.byFormat[f], color: formatColor(f) }))
                  : FORMATS.map((f, k) => ({ f, v: k === 0 ? mo.prizeInr : 0, color: "var(--accent)" }));
                const topIdx = segs.reduce((a, s, k) => (s.v > 0 ? k : a), -1);
                let acc = 0;
                const past = mo.month < thisMonth;
                const dim = hover != null ? hover !== i : past;
                return (
                  <motion.g
                    key={mo.month}
                    initial={reduce ? false : { scaleY: 0, opacity: 0 }}
                    animate={shown ? { scaleY: 1, opacity: dim ? (hover != null ? 0.35 : 0.5) : 1 } : undefined}
                    transition={{
                      scaleY: { duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.035 },
                      opacity: { duration: hover != null ? 0.15 : 0.5, delay: hover != null || !shown ? 0 : 0.1 + i * 0.035 },
                    }}
                    style={{ originY: 1 }}
                  >
                    {segs.map((s, k) => {
                      const h = y(s.v);
                      const gap = k > 0 && acc > 0 && h > 0 ? 2 : 0;
                      const top = m.t + ih - acc - h;
                      acc += h;
                      const hh = Math.max(0, h - gap);
                      return (
                        <motion.path
                          key={k}
                          initial={false}
                          animate={{ d: colPath(x0, top, bw, hh, k === topIdx ? 4 : 0) }}
                          transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
                          style={{ fill: s.color, transition: "fill 300ms var(--motion-out)" }}
                        />
                      );
                    })}
                  </motion.g>
                );
              })}

              {/* peak label */}
              {peak >= 0 && values[peak] > 0 && (
                <motion.text
                  key={`${metric}-${peak}`}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={shown ? { opacity: 1, y: 0 } : undefined}
                  transition={{ delay: reduce ? 0 : 0.9, duration: 0.4 }}
                  x={m.l + slot * peak + slot / 2}
                  y={m.t + ih - y(values[peak]) - 7}
                  textAnchor="middle"
                  className="fill-fg text-[11px] font-semibold tabular-nums"
                >
                  {metric === "count" ? values[peak] : formatInr(values[peak])}
                </motion.text>
              )}

              {/* x labels */}
              {months.map((mo, i) => {
                const cx = m.l + slot * i + slot / 2;
                const jan = mo.month.endsWith("-01");
                const showLabel = !narrow || i % 2 === 0;
                return (
                  <g key={mo.month}>
                    {showLabel && (
                      <text x={cx} y={H - m.b + 16} textAnchor="middle" className={`text-[11px] ${mo.month === thisMonth ? "fill-fg font-medium" : "fill-subtle"}`}>
                        {narrow ? formatMonthShort(mo.month).slice(0, 3) : formatMonthShort(mo.month)}
                      </text>
                    )}
                    {(i === 0 || jan) && (
                      <text x={cx} y={H - m.b + 30} textAnchor="middle" className="fill-subtle font-mono text-[10px]">{mo.month.slice(0, 4)}</text>
                    )}
                  </g>
                );
              })}

              {/* hit areas */}
              {months.map((mo, i) => (
                <rect
                  key={mo.month}
                  x={m.l + slot * i}
                  y={m.t - 10}
                  width={slot}
                  height={ih + 10 + m.b}
                  fill="transparent"
                  className="cursor-pointer outline-none"
                  tabIndex={0}
                  role="link"
                  aria-label={`${formatMonthLabel(mo.month)}: ${mo.total} tournaments, ${formatInr(mo.prizeInr)} prize money`}
                  onClick={() => navigate(linkFor(mo.month))}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(linkFor(mo.month)); }}
                  onFocus={() => { setHover(i); show({}, { x: m.l + slot * i + slot / 2, y: m.t + ih / 2, content: tipFor(mo, metric) }); }}
                  onBlur={() => { setHover(null); hide(); }}
                  onPointerMove={(e) => {
                    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                    const cx = m.l + slot * i + slot / 2;
                    const toLeft = cx > width / 2;
                    setHover(i);
                    show(e, { x: cx + (toLeft ? -1 : 1) * Math.max(bw / 2, 6), side: toLeft ? "left" : "right", y: Math.min(Math.max(e.clientY - r.top, 50), H - 60), content: tipFor(mo, metric) });
                  }}
                />
              ))}
            </svg>
          )}
          <Tip tip={tip} width={width} />
        </div>
      </div>
      <SrTable
        caption="Tournaments by start month"
        head={["Month", "Tournaments", ...FORMATS.map(formatName), "Prize money"]}
        rows={months.map((mo) => [formatMonthLabel(mo.month), mo.total, ...FORMATS.map((f) => mo.byFormat[f]), formatInr(mo.prizeInr)])}
      />
    </Card>
  );
}

function tipFor(mo: Insights["months"][number], metric: Metric) {
  return (
    <TipBody
      title={formatMonthLabel(mo.month)}
      rows={
        metric === "count"
          ? [
              { key: "tournaments", value: mo.total },
              ...FORMATS.filter((f) => mo.byFormat[f] > 0).reverse().map((f) => ({ key: formatName(f), value: mo.byFormat[f], color: formatColor(f) })),
            ]
          : [{ key: "prize money", value: formatInr(mo.prizeInr), color: "var(--accent)" }, { key: "tournaments", value: mo.total }]
      }
      foot="Select to see these tournaments"
    />
  );
}
