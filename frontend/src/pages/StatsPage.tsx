import { Link } from "react-router-dom";
import { ErrorState } from "@/components/States";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/queries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatInr, formatInrFull, formatMonthLabel, formatMonthShort, pluralize } from "@/lib/format";
import type { FacetCount } from "@/types/event";

function Panel({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-5 shadow-e1 sm:p-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[15px] font-semibold tracking-h3">{title}</h2>
        {note && <span className="text-small text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** Ranked horizontal bars; each row links to the listing with that filter applied. */
function Bars({ data, to, label }: { data: FacetCount[]; to: (v: string) => string; label: (d: FacetCount) => string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-0.5">
      {data.map((d, i) => (
        <li key={d.value}>
          <Link
            to={to(d.value)}
            aria-label={label(d)}
            className="group grid min-h-9 grid-cols-[8.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-sm px-2 text-ui transition-colors hover:bg-surface-2 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem]"
          >
            <span className="truncate">{d.value}</span>
            <span className="relative h-2" aria-hidden>
              <span
                className={`absolute inset-y-0 left-0 rounded-r-[4px] transition-colors group-hover:bg-accent ${i === 0 ? "bg-accent" : "bg-border-strong"}`}
                style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }}
              />
            </span>
            <span className="text-right font-medium">{d.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Months({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((m) => m.count));
  const peak = data.reduce((a, m) => (m.count > a.count ? m : a), data[0]);
  return (
    <ol className="grid h-56 grid-cols-12 items-end gap-1.5 border-b border-border sm:gap-3">
      {data.map((m) => (
        <li key={m.month} className="group relative flex h-full min-w-0 flex-col items-center justify-end">
          <Link
            to={`/?from=${m.month}-01&to=${m.month}-${new Date(Date.UTC(+m.month.slice(0, 4), +m.month.slice(5, 7), 0)).getUTCDate()}`}
            aria-label={`${formatMonthLabel(m.month)}: ${pluralize(m.count, "tournament")}`}
            className="flex h-full w-full flex-col items-center justify-end gap-1.5 rounded-t-sm pb-px hover:bg-surface-2"
          >
            <span className="text-label font-medium text-muted group-hover:text-fg">{m.count || ""}</span>
            <span
              className={`w-full max-w-10 rounded-t-[4px] transition-colors group-hover:bg-accent ${m === peak ? "bg-accent" : "bg-border-strong"}`}
              style={{ height: `${(m.count / max) * 82}%`, minHeight: m.count ? 4 : 1 }}
            />
          </Link>
          <span className="absolute -bottom-6 text-label text-muted">{formatMonthShort(m.month)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function StatsPage() {
  useDocumentMeta("Insights", "Where and when Indian chess tournaments happen: events by month, state and time control.");
  const { data: s, isError, error, refetch } = useStats();
  if (isError) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;

  const tiles = s
    ? [
        { v: String(s.upcoming), l: "upcoming" },
        { v: String(s.ongoing), l: "being played now" },
        ...(s.upcomingPrizePoolInr > 0 ? [{ v: formatInr(s.upcomingPrizePoolInr), l: "in prize funds ahead", t: formatInrFull(s.upcomingPrizePoolInr) }] : []),
        { v: `${Math.round((s.extracted / Math.max(1, s.total)) * 100)}%`, l: `of ${s.total} with brochure details` },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
      <header className="pb-8 pt-10 sm:pt-14">
        <h1 className="text-[30px] font-semibold tracking-h1 sm:text-h1">Insights</h1>
        <p className="mt-3 max-w-[56ch] text-body-lg text-muted">When and where the Indian tournament calendar fills up, counted over upcoming and ongoing events. Select any bar to see those tournaments.</p>
      </header>
      {!s ? (
        <Skeleton className="h-72 w-full rounded-lg" />
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.l} className="bg-surface p-5">
                <dd className="text-stat font-medium tracking-h1" title={t.t}>{t.v}</dd>
                <dt className="mt-2 text-small text-muted">{t.l}</dt>
              </div>
            ))}
          </dl>
          <Panel id="by-month" title="Tournaments by start month" note="next 12 months">
            <div className="pb-6"><Months data={s.byMonth} /></div>
          </Panel>
          <div className="grid gap-5 md:grid-cols-2">
            <Panel id="by-state" title="By state" note={`top ${Math.min(12, s.byState.length)} of ${s.byState.length}`}>
              <Bars data={s.byState.slice(0, 12)} to={(v) => `/?state=${encodeURIComponent(v)}`} label={(d) => `${d.value}: ${pluralize(d.count, "tournament")}`} />
            </Panel>
            <Panel id="by-tc" title="By time control">
              <Bars data={s.byTimeControl} to={(v) => `/?tc=${encodeURIComponent(v)}`} label={(d) => `${d.value}: ${pluralize(d.count, "tournament")}`} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
