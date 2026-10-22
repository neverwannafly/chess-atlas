import { Link } from "react-router-dom";
import { ErrorState } from "@/components/States";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/queries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatInr, formatInrFull, formatMonthShort } from "@/lib/format";
import type { FacetCount } from "@/types/event";

function Bars({ title, data, to }: { title: string; data: FacetCount[]; to: (v: string) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <section aria-labelledby={title} className="rounded-xl border border-line bg-surface p-5">
      <h2 id={title} className="mb-4 text-xl font-semibold">{title}</h2>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.value}>
            <Link to={to(d.value)} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 rounded text-sm hover:bg-sunk sm:grid-cols-[9rem_1fr_2rem]">
              <span className="truncate">{d.value}</span>
              <span className="h-3 rounded-sm bg-sunk" aria-hidden><span className="block h-full rounded-sm bg-accent" style={{ width: `${(d.count / max) * 100}%` }} /></span>
              <span className="text-right font-semibold">{d.count}</span>
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
  if (isError) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;
  const max = Math.max(1, ...(s?.byMonth.map((m) => m.count) ?? [1]));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-4xl font-semibold sm:text-5xl">Insights</h1>
      <p className="mt-2 max-w-xl text-muted">The shape of the Indian tournament calendar, from upcoming and ongoing events.</p>
      {!s ? (
        <Skeleton className="mt-8 h-72 w-full" />
      ) : (
        <div className="mt-8 space-y-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              [String(s.upcoming), "upcoming"], [String(s.ongoing), "ongoing now"],
              [formatInr(s.upcomingPrizePoolInr || null), "prize pool ahead", s.upcomingPrizePoolInr ? formatInrFull(s.upcomingPrizePoolInr) : undefined],
              [`${s.extracted}/${s.total}`, "with parsed details"],
            ].map(([v, l, t]) => (
              <div key={l} className="rounded-xl border border-line bg-surface p-4">
                <dd className="font-display text-3xl font-semibold" title={t}>{v}</dd>
                <dt className="text-[13px] text-muted">{l}</dt>
              </div>
            ))}
          </dl>
          <section aria-labelledby="by-month" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="by-month" className="mb-4 text-xl font-semibold">Events by month</h2>
            <ol className="flex h-48 items-end gap-1.5 sm:gap-3">
              {s.byMonth.map((m) => (
                <li key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" aria-label={`${m.month}: ${m.count} events`}>
                  <span className="text-xs font-semibold">{m.count}</span>
                  <span className="w-full rounded-t bg-accent" style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 4 : 1 }} />
                  <span className="text-[11px] text-muted">{formatMonthShort(m.month)}</span>
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
  );
}
