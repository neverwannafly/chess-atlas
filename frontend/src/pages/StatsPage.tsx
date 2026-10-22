import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { CountUp } from "@/components/CountUp";
import { ErrorState } from "@/components/States";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/queries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatInr, formatInrFull, formatMonthShort } from "@/lib/format";
import type { FacetCount } from "@/types/event";

const EASE = [0.16, 1, 0.3, 1] as const;

function Bars({ title, data, to }: { title: string; data: FacetCount[]; to: (v: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby={title} className="rounded-lg border-2 border-ink/20 bg-surface p-5">
      <h2 id={title} className="mb-4 font-display text-2xl font-extrabold">{title}</h2>
      <ul className="space-y-1">
        {data.map((d, i) => (
          <li key={d.value}>
            <Link to={to(d.value)} className="grid min-h-10 grid-cols-[7.5rem_1fr_2rem] items-center gap-3 rounded text-[15px] hover:bg-sunk sm:grid-cols-[9rem_1fr_2rem]">
              <span className="truncate font-medium">{d.value}</span>
              <span className="h-4 bg-sunk" aria-hidden>
                <motion.span
                  className="block h-full origin-left bg-accent"
                  style={{ width: `${(d.count / max) * 100}%` }}
                  initial={reduce ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                  transition={{ duration: 0.8, delay: i * 0.05, ease: EASE }}
                />
              </span>
              <span className="text-right font-bold">{d.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StatsPage() {
  useDocumentMeta("Insights", "Where and when Indian chess tournaments happen: events by month, state and time control.");
  const { data: s, isError, error, refetch } = useStats();
  const reduce = useReducedMotion();
  if (isError) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;
  const max = Math.max(1, ...(s?.byMonth.map((m) => m.count) ?? [1]));
  const tiles: { v: number; l: string; fmt?: (n: number) => string; t?: string }[] = s
    ? [
        { v: s.upcoming, l: "upcoming" },
        { v: s.ongoing, l: "ongoing now" },
        ...(s.upcomingPrizePoolInr > 0 ? [{ v: s.upcomingPrizePoolInr, l: "prize pool ahead", fmt: (n: number) => formatInr(Math.round(n)), t: formatInrFull(s.upcomingPrizePoolInr) }] : []),
        { v: s.extracted, l: `of ${s.total} have parsed details` },
      ]
    : [];
  return (
    <>
      <div className="on-hall border-b-4 border-gold bg-hall text-hall-ink">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-14">
          <h1 className="display-xl text-6xl sm:text-8xl">Insights</h1>
          <p className="mt-4 max-w-xl text-lg text-hall-muted">Where and when the Indian tournament calendar fills up, from upcoming and ongoing events.</p>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4">
        {!s ? (
          <Skeleton className="mt-8 h-72 w-full" />
        ) : (
          <div className="space-y-6">
            <dl className="relative -mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiles.map((t, i) => (
                <div key={t.l} className={`rounded-lg border-2 border-ink/20 p-4 shadow-[0_4px_0_var(--line)] ${i % 2 ? "sq-light" : "bg-surface"}`}>
                  <dd className="font-display text-5xl font-extrabold leading-none" title={t.t}><CountUp value={t.v} format={t.fmt} /></dd>
                  <dt className="mt-1.5 text-[14px] opacity-80">{t.l}</dt>
                </div>
              ))}
            </dl>
            <section aria-labelledby="by-month" className="rounded-lg border-2 border-ink/20 bg-surface p-5">
              <h2 id="by-month" className="mb-4 font-display text-2xl font-extrabold">Events by month</h2>
              <ol className="flex h-52 items-end gap-1.5 sm:gap-3">
                {s.byMonth.map((m, i) => (
                  <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`${m.month}: ${m.count} events`}>
                    <span className="text-xs font-bold">{m.count}</span>
                    <motion.span
                      className="w-full origin-bottom rounded-t-sm bg-accent"
                      style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 4 : 1 }}
                      initial={reduce ? false : { scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                      transition={{ duration: 0.7, delay: i * 0.04, ease: EASE }}
                    />
                    <span className="text-[12px] text-muted">{formatMonthShort(m.month)}</span>
                  </li>
                ))}
              </ol>
            </section>
            <div className="grid gap-6 md:grid-cols-2">
              <Bars title="By state" data={s.byState.slice(0, 12)} to={(v) => `/?state=${encodeURIComponent(v)}`} />
              <Bars title="By time control" data={s.byTimeControl} to={(v) => `/?tc=${encodeURIComponent(v)}`} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
