import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { eventPath } from "@/lib/eventFacts";
import { ArrowUpRight } from "lucide-react";
import type { Insights, InsightsScope } from "@/types/event";
import { addDays, formatDateRange, formatDayMonth, formatInr, formatWeekdayShort, pluralize } from "@/lib/format";
import { EASE, formatColor, formatName, place, seq, useReveal, useWidth } from "./viz";
import { Ticker } from "./primitives";

const inr = (n: number) => formatInr(Math.round(n));
const int = (n: number) => Math.round(n).toLocaleString("en-IN");

function Sparkline({ values, animKey }: { values: number[]; animKey: string }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [rref, shown, reduce] = useReveal<HTMLDivElement>(0.5);
  const h = 56;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => [i * step, 4 + (h - 8) * (1 - v / max)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = pts.length ? `${line} L${w},${h} L0,${h} Z` : "";
  const last = pts[pts.length - 1];
  return (
    <div ref={rref}>
      <div ref={ref} className="h-14 w-full" aria-hidden>
        {w > 0 && pts.length > 1 && (
          <svg width={w} height={h} className="overflow-visible">
            <motion.path key={`a${animKey}`} d={area} fill="var(--accent)" initial={reduce ? false : { opacity: 0 }} animate={shown ? { opacity: 0.1 } : undefined} transition={{ duration: 0.8, delay: reduce ? 0 : 0.7 }} />
            <motion.path
              key={`l${animKey}`}
              d={line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={shown ? { pathLength: 1 } : undefined}
              transition={{ duration: 1.4, ease: EASE, delay: reduce ? 0 : 0.2 }}
            />
            {last && (
              <motion.circle key={`c${animKey}`} cx={last[0]} cy={last[1]} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2}
                initial={reduce ? false : { scale: 0 }} animate={shown ? { scale: 1 } : undefined} transition={{ delay: reduce ? 0 : 1.5, type: "spring", stiffness: 400, damping: 20 }} />
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

export function KpiRow({ scope, data, scopeKey }: { scope: InsightsScope; data: Insights; scopeKey: "upcoming" | "all" }) {
  const thisMonth = data.today.slice(0, 7);
  const months = data.months.filter((m) => scopeKey === "all" || m.month >= thisMonth);
  const tiles = [
    { label: "Prize money on offer", value: scope.prizePoolInr, fmt: inr, sub: `across ${scope.prizeKnown} tournaments that state a purse` },
    { label: "Median prize fund", value: scope.medianPrizeInr ?? 0, fmt: inr, sub: "half are bigger, half smaller" },
    { label: "Typical entry fee", value: scope.medianEntryFeeInr ?? 0, fmt: inr, sub: "median adult entry" },
    { label: "States and UTs", value: scope.states, fmt: int, sub: `${scope.cities} cities` },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-e1 lg:grid-cols-6">
      <div className="col-span-2 flex flex-col justify-between gap-4 bg-surface p-5 sm:p-6">
        <div>
          <dt className="text-small text-muted">{scopeKey === "upcoming" ? "Tournaments ahead" : "Tournaments on record"}</dt>
          <dd className="mt-2 text-[56px] font-semibold leading-none tracking-display [font-variant-numeric:proportional-nums]">
            <Ticker value={scope.total} format={int} />
          </dd>
          <p className="mt-2 text-small text-subtle">{scopeKey === "upcoming" ? "not yet finished" : `since ${formatMonth(data.months[0]?.month)}`}, by start month</p>
        </div>
        <Sparkline values={months.map((m) => m.total)} animKey={scopeKey} />
      </div>
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col bg-surface p-5 sm:p-6">
          <dt className="text-small text-muted">{t.label}</dt>
          <dd className="mt-auto pt-6 text-stat font-semibold tracking-h1 [font-variant-numeric:proportional-nums] sm:text-[32px]">
            <Ticker value={t.value} format={t.fmt} />
          </dd>
          <p className="mt-2 text-label text-subtle">{t.sub}</p>
        </div>
      ))}
    </dl>
  );
}

const formatMonth = (ym?: string) => (ym ? new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${ym}-01T00:00:00Z`)) : "");

export function ThisWeek({ data }: { data: Insights }) {
  const w = data.thisWeek;
  const [ref, shown, reduce] = useReveal<HTMLDivElement>(0.2);
  const stats = [
    { v: w.starting, l: "starting this week", to: "/?when=7d" },
    { v: w.ongoing, l: "in play today", to: `/?from=${w.from}&to=${w.from}` },
    { v: w.closingSoon, l: "registrations closing", to: "/?open=1&when=7d" },
  ];
  return (
    <section aria-labelledby="this-week" className="overflow-hidden rounded-lg border border-border bg-surface shadow-e1">
      <div ref={ref} className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-subtle">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            This week · {formatDayMonth(w.from)} – {formatDayMonth(w.to)}
          </p>
          <h2 id="this-week" className="sr-only">This week</h2>
          <ul className="mt-5 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <li key={s.l}>
                <Link to={s.to} className="group block rounded-sm">
                  <span className="block text-[32px] font-semibold leading-none tracking-h1 [font-variant-numeric:proportional-nums]"><Ticker value={s.v} format={int} /></span>
                  <span className="mt-2 block text-small text-muted group-hover:text-fg">{s.l}</span>
                </Link>
              </li>
            ))}
          </ul>
          <WeekStrip data={data} shown={shown} reduce={reduce} />
          {w.biggest && (
            <Link to={eventPath(w.biggest)} className="group mt-6 block rounded-md border border-border bg-surface-2 p-4 transition-colors hover:border-border-strong">
              <span className="flex items-center justify-between gap-3 text-label text-muted">
                Biggest purse this week
                <ArrowUpRight className="h-4 w-4 text-subtle transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
              </span>
              <span className="mt-1.5 block text-h2 font-semibold tracking-h2 text-accent">{formatInr(w.biggest.totalPrizeInr)}</span>
              <span className="mt-1 line-clamp-1 block text-small">{w.biggest.name}</span>
              <span className="block text-label text-subtle">{formatDateRange(w.biggest.startDate, w.biggest.endDate)} · {place(w.biggest)}</span>
            </Link>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-subtle">Up next</p>
          <ol className="mt-3">
            {w.next.map((e, i) => (
              <motion.li
                key={e.eventCode}
                initial={reduce ? false : { opacity: 0, x: 12 }}
                animate={shown ? { opacity: 1, x: 0 } : undefined}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.07 }}
              >
                <Link to={eventPath(e)} className="group -mx-2 grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-surface-2">
                  <span className="text-center leading-none">
                    <span className="block text-[20px] font-semibold tabular-nums">{+e.startDate.slice(8, 10)}</span>
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.06em] text-subtle">{formatWeekdayShort(e.startDate)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-ui font-medium">{e.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-label text-muted">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: formatColor(e.timeControlType) }} />
                      <span className="truncate">{formatName(e.timeControlType ?? "Unknown")} · {place(e)}</span>
                    </span>
                  </span>
                  <span className="text-right text-small font-medium tabular-nums">{e.totalPrizeInr ? formatInr(e.totalPrizeInr) : <span className="text-subtle">—</span>}</span>
                </Link>
              </motion.li>
            ))}
          </ol>
          {w.starting > w.next.length && (
            <Link to="/?when=7d" className="mt-2 inline-flex h-9 items-center gap-1 text-small font-medium text-accent hover:underline">
              All {pluralize(w.starting, "tournament")} this week <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Seven columns, today first: how many tournaments are in play each day. */
function WeekStrip({ data, shown, reduce }: { data: Insights; shown: boolean; reduce: boolean }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.today, i));
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const vals = days.map((d) => byDate.get(d)?.inPlay ?? 0);
  const max = Math.max(1, ...vals);
  return (
    <div className="mt-6" role="img" aria-label={`Tournaments in play over the next 7 days: ${vals.join(", ")}`}>
      <div className="flex h-16 items-end gap-1.5">
        {days.map((d, i) => (
          <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[11px] font-medium tabular-nums text-muted">{vals[i] || ""}</span>
            <motion.span
              className="block w-full origin-bottom rounded-t-[4px]"
              style={{ height: `${Math.max(4, (vals[i] / max) * 40)}px`, background: vals[i] ? (i === 0 ? "var(--accent)" : seq(0.35 + 0.5 * (vals[i] / max))) : "var(--border)" }}
              initial={reduce ? false : { scaleY: 0 }}
              animate={shown ? { scaleY: 1 } : undefined}
              transition={{ duration: 0.7, ease: EASE, delay: reduce ? 0 : 0.2 + i * 0.05 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-border pt-1.5">
        {days.map((d, i) => (
          <span key={d} className={`flex-1 text-center text-[10px] uppercase tracking-[0.06em] ${i === 0 ? "font-medium text-fg" : "text-subtle"}`}>
            {i === 0 ? "Today" : formatWeekdayShort(d)}
          </span>
        ))}
      </div>
    </div>
  );
}
