import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CrTournament } from "@/types/chessresults";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/SearchField";
import { ErrorState } from "@/components/States";
import { EmptyNote } from "@/components/Trust";
import { PageHead, SourceNote } from "@/components/cr/common";
import { useCrCount, useCrTournaments, useDebounced, useNow } from "@/hooks/crQueries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { crDateRange, relativeTime, shell } from "@/lib/chessresults";
import { todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const MIN = 60_000;
const EASE = [0.2, 0.8, 0.2, 1] as const;
const COLS = "md:grid md:grid-cols-[112px_minmax(0,1fr)_180px_132px] md:items-center md:gap-x-5 lg:grid-cols-[120px_minmax(0,1fr)_200px_168px_132px]";

/** One segment per round: rounds up to the current one lit, the current one pulsing. */
function RoundBar({ current, of }: { current: number | null; of: number | null }) {
  if (!of || of > 30) return null;
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: of }, (_, i) => {
        const r = i + 1;
        return <span key={r} className={cn("h-1 flex-1 rounded-full", current != null && r < current ? "bg-live" : current === r ? "pulse-dot bg-live/70" : "bg-surface-3")} />;
      })}
    </div>
  );
}

function Progress({ t }: { t: CrTournament }) {
  const cur = t.currentRound ?? null;
  const of = t.rounds;
  return (
    <div className="w-full">
      <p className="flex items-baseline gap-1 font-mono text-ui font-medium tabular-nums text-fg">
        {cur ? <>R{cur}{of ? <span className="text-subtle">/{of}</span> : null}</> : <span className="font-sans text-small text-muted">{of ? `${of} rounds` : "Round not listed"}</span>}
        {cur && of && cur === of && <span className="ml-1 font-sans text-small font-medium text-live">final</span>}
      </p>
      <div className="mt-1.5 max-w-[160px]"><RoundBar current={cur} of={of} /></div>
    </div>
  );
}

function LiveRow({ t, now }: { t: CrTournament; now: number }) {
  const refreshed = relativeTime(t.lastRefreshedAt, now);
  const dates = crDateRange(t.startDate, t.endDate);
  return (
    <article className={cn("group relative flex flex-col gap-2.5 py-4 transition-colors duration-[var(--dur-1)] md:rounded-sm md:px-3 md:hover:bg-surface-2/70", COLS)}>
      <Progress t={t} />
      <div className="min-w-0">
        <h2 className="line-clamp-2 text-[15px] font-medium leading-snug tracking-h3 text-fg md:truncate">
          <Link
            to={`/tournaments/${t.id}`}
            className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-sm after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent"
          >
            {t.name}
          </Link>
        </h2>
        <p className="mt-0.5 truncate text-small text-muted">
          {t.location ?? "Location not listed"}
          {dates && <><span className="px-1.5 text-subtle" aria-hidden>·</span>{dates}</>}
        </p>
        {t.timeControl && <p className="mt-0.5 truncate font-mono text-[12px] text-muted md:hidden">{t.timeControl}</p>}
      </div>
      <p className="hidden truncate font-mono text-[12.5px] text-muted md:block" title={t.timeControl ?? undefined}>{t.timeControl ?? <span className="font-sans text-subtle">—</span>}</p>
      <p className="hidden whitespace-nowrap text-small text-subtle lg:block">
        {t.error ? <span className="text-warn">Refresh failed</span> : refreshed ? <>Refreshed {refreshed}</> : "Not refreshed yet"}
      </p>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <span className="text-small text-subtle lg:hidden">{t.error ? <span className="text-warn">Refresh failed</span> : refreshed ? `Refreshed ${refreshed}` : "Not refreshed yet"}</span>
        {t.liveUrl ? (
          <Button asChild size="sm" variant="secondary" className="relative z-20 h-9 md:h-8">
            <a href={t.liveUrl} target="_blank" rel="noopener noreferrer">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden />Live boards<ArrowUpRight aria-hidden />
              <span className="sr-only">for {t.name} on chess-results.com (opens in a new tab)</span>
            </a>
          </Button>
        ) : (
          <a href={t.chessResultsUrl} target="_blank" rel="noopener noreferrer" className="relative z-20 inline-flex h-9 items-center gap-1 text-small text-muted underline decoration-border-strong underline-offset-[3px] hover:text-fg">
            chess-results<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </article>
  );
}

function Figures({ rows, total, today }: { rows: CrTournament[]; total: number; today: string }) {
  const finalRound = rows.filter((t) => t.currentRound && t.rounds && t.currentRound === t.rounds).length;
  const endingToday = rows.filter((t) => t.endDate === today).length;
  const items: [string, number | string, string?][] = [
    ["In play", total],
    ["In the final round", finalRound, rows.length < total ? `of the first ${rows.length}` : undefined],
    ["Ending today", endingToday, rows.length < total ? `of the first ${rows.length}` : undefined],
  ];
  return (
    <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
      {items.map(([k, v, hint]) => (
        <div key={k} className="bg-surface px-3 py-3 sm:px-5 sm:py-4">
          <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{k}</dt>
          <dd className="mt-1.5 font-mono text-[22px] font-medium leading-none tabular-nums text-fg sm:text-stat">{v}</dd>
          {hint && <dd className="mt-1 hidden text-small text-subtle sm:block">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function SkeletonRows() {
  return (
    <div role="status" aria-label="Loading live tournaments" className="divide-y divide-border/70">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:gap-5" style={{ opacity: 1 - i * 0.12 }}>
          <div className="w-28 space-y-1.5"><div className="skeleton h-4 w-12 rounded-sm" /><div className="skeleton h-1 w-24 rounded-sm" /></div>
          <div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3 rounded-sm" /><div className="skeleton h-3 w-1/3 rounded-sm" /></div>
        </div>
      ))}
    </div>
  );
}

export default function LivePage() {
  useDocumentMeta("Live now", "Indian chess tournaments in play right now, mirrored from chess-results.com, with direct links to live boards.");
  const reduce = !!useReducedMotion();
  const now = useNow();
  const today = todayIST();
  const [params, setParams] = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [text, setText] = useState(urlQ);
  const q = useDebounced(text.trim(), 250);
  useEffect(() => {
    if (q === urlQ) return;
    setParams((p) => { const n = new URLSearchParams(p); if (q) n.set("q", q); else n.delete("q"); return n; }, { replace: true });
  }, [q, urlQ, setParams]);

  const list = useCrTournaments({ status: "ongoing", fed: "IND", q: urlQ || undefined }, MIN);
  const allCount = useCrCount("ongoing", "").data;
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  const total = list.data?.pages[0]?.meta.total ?? 0;
  const latest = rows.map((t) => t.lastRefreshedAt).filter(Boolean).sort().at(-1) ?? null;
  const n = allCount ?? (urlQ ? undefined : total);

  return (
    <div className={shell}>
      <PageHead
        eyebrow={<><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden />Live now</>}
        title={n ? `${n} ${n === 1 ? "tournament" : "tournaments"} in play` : "Tournaments in play"}
        aside={<Link to="/tournaments?status=upcoming" className="inline-flex h-9 items-center gap-1.5 text-ui font-medium text-muted hover:text-fg">Starting next<ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      >
        Indian events with rounds being played. We follow rounds and standings here; live boards and pairings open on chess-results.com.
      </PageHead>

      {!list.isPending && !list.isError && rows.length > 0 && !urlQ && <Figures rows={rows} total={total} today={today} />}

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SourceNote refreshedAt={list.isPending ? undefined : latest} live />
        <SearchField id="live-search" value={text} onChange={setText} className="w-full md:w-[320px]" placeholder="Search live events by name or city" label="Search live tournaments" shortcut={false} />
      </div>

      <div className="mt-4 border-t border-border">
        {list.isPending ? (
          <SkeletonRows />
        ) : list.isError ? (
          <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyNote
            className="mt-8"
            piece="wK"
            title={urlQ ? `No live event matches “${urlQ}”` : "No Indian tournaments are in play right now"}
            action={<Button asChild variant="secondary"><Link to="/tournaments?status=upcoming">See what starts next<ArrowRight aria-hidden /></Link></Button>}
          >
            {urlQ ? "Try another name or city." : "This page checks the mirror every minute."}
          </EmptyNote>
        ) : (
          <>
            <div className={cn("hidden h-10 items-center border-b border-border px-3 text-label font-medium uppercase tracking-[0.06em] text-subtle", COLS)} aria-hidden>
              <span>Round</span><span>Tournament</span><span>Time control</span><span className="max-lg:hidden">Freshness</span><span className="text-right">Boards</span>
            </div>
            <ul className={cn("divide-y divide-border/70 transition-opacity", list.isPlaceholderData && "opacity-60")}>
              <AnimatePresence initial={false} mode="popLayout">
                {rows.map((t, i) => (
                  <motion.li
                    key={t.id}
                    layout={reduce ? false : "position"}
                    initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.35, ease: EASE, delay: reduce ? 0 : (i % 10) * 0.025 }}
                  >
                    <LiveRow t={t} now={now} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
            <div className="flex justify-center border-t border-border py-6">
              {list.hasNextPage ? (
                <Button variant="secondary" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                  {list.isFetchingNextPage ? "Loading…" : `Show more (${total - rows.length} left)`}
                </Button>
              ) : (
                <p className="text-small text-subtle">{total} live {total === 1 ? "tournament" : "tournaments"}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
