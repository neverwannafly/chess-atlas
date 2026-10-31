import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ErrorState } from "@/components/States";
import { Skeleton } from "@/components/ui/skeleton";
import { useHealth, useInsights } from "@/hooks/queries";
import { SourceLine, SOURCES } from "@/components/Trust";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { cn } from "@/lib/utils";
import { EASE, VIZ_VARS } from "@/components/insights/viz";
import { Segmented } from "@/components/insights/primitives";
import { KpiRow, ThisWeek } from "@/components/insights/Headline";
import { SeasonChart } from "@/components/insights/SeasonChart";
import { CalendarHeatmap } from "@/components/insights/CalendarHeatmap";
import { StateMap } from "@/components/insights/StateMap";
import { Formats } from "@/components/insights/Formats";
import { MoneyDistributions, MoneyLeaders } from "@/components/insights/Money";
import { CategoryPrizes, Rhythm } from "@/components/insights/Rhythm";

type Scope = "upcoming" | "all";

function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading insights">
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-44 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

export default function StatsPage() {
  useDocumentMeta("Insights", "The Indian chess tournament calendar in numbers: when and where events happen, formats, prize funds, entry fees and category prizes.");
  const { data, isError, error, refetch } = useInsights();
  const health = useHealth();
  const [scope, setScope] = useState<Scope>("upcoming");
  const reduce = useReducedMotion();
  const s = data?.[scope];

  if (isError) return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;

  return (
    <div className={cn("relative", VIZ_VARS)}>
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70" />
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <header className="pb-8 pt-10 sm:pb-10 sm:pt-16">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="font-mono text-[11px] uppercase tracking-[0.1em] text-subtle"
          >
            Insights{data && <> · updated {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(data.generatedAt))}</>}
          </motion.p>
          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
            className="mt-3 max-w-[18ch] text-[34px] font-semibold leading-[1.08] tracking-h1 sm:text-[48px]"
          >
            The tournament calendar, in numbers
          </motion.h1>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
            className="mt-4 max-w-[58ch] text-body-lg text-muted"
          >
            Every AICF-listed event and what its brochure says: when the season peaks, where play happens, what it costs and what you can win. Select anything to see the tournaments behind it.
          </motion.p>
        </header>

        {!data || !s ? (
          <Loading />
        ) : (
          <div className="space-y-5">
            <ThisWeek data={data} />
            <SeasonChart data={data} />

            <div className="sticky top-[calc(var(--toolbar-h)+8px)] z-30 flex justify-center pt-6 pb-1">
              <div className="glass flex items-center gap-3 rounded-full border border-border py-1 pl-4 pr-1 shadow-e2">
                <span className="hidden text-small text-muted sm:inline">Showing</span>
                <Segmented id="scope" size="sm" label="Which tournaments" value={scope} onChange={setScope}
                  options={[{ value: "upcoming", label: "Upcoming" }, { value: "all", label: "All on record" }]} />
              </div>
            </div>

            <KpiRow scope={s} data={data} scopeKey={scope} />
            <CalendarHeatmap data={data} scope={scope} />
            <StateMap scope={s} scopeKey={scope} />
            <Formats scope={s} scopeKey={scope} />
            <MoneyDistributions scope={s} scopeKey={scope} />
            <MoneyLeaders scope={s} scopeKey={scope} />
            <div className="grid gap-5">
              <Rhythm scope={s} scopeKey={scope} />
              <CategoryPrizes scope={s} scopeKey={scope} />
            </div>
            <SourceLine sources={[SOURCES.aicf]} refreshedAt={health.data ? health.data.lastScrapeAt : undefined} verb="calendar checked" className="justify-center pt-4" />
            <p className="text-center text-label text-subtle">
              Counts cover {data.all.total} AICF events since {data.months[0] ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.months[0].month}-01T00:00:00Z`)) : ""}; money, formats and categories come from {data.all.withDetails} parsed brochures. Confirm details with organisers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
