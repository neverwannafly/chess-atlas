import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, Clock, MapPin } from "lucide-react";
import type { CrTournament } from "@/types/chessresults";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { PageHead, SourceNote } from "@/components/cr/common";
import { useCrTournament, useLiveTournaments, useNow } from "@/hooks/crQueries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { crDateRange, relativeTime, roundProgress, shell } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** One segment per round: played rounds solid, the round in play half-lit, the rest quiet. */
function RoundBar({ current, of, partial }: { current: number | null; of: number | null; partial: boolean }) {
  if (!of) return null;
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: of }, (_, i) => {
        const r = i + 1;
        const done = current != null && (r < current || (r === current && !partial));
        const now = current != null && r === current && partial;
        return <span key={r} className={cn("h-1.5 flex-1 rounded-full", done ? "bg-accent" : now ? "pulse-dot bg-accent/60" : "bg-surface-3")} />;
      })}
    </div>
  );
}

function LiveCard({ t, i }: { t: CrTournament; i: number }) {
  const reduce = useReducedMotion();
  const now = useNow();
  // The list payload has no current round; the detail's per-round progress supplies it.
  const { data: d } = useCrTournament(t.id, true);
  const p = d ? roundProgress(d.roundList, t.rounds) : { current: null, of: t.rounds };
  const cur = d?.roundList.find((r) => r.round === p.current);
  const partial = !!cur && cur.played < cur.games;
  const refreshed = relativeTime(d?.lastRefreshedAt ?? t.lastRefreshedAt, now);
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : i * 0.05 }}
      className="flex min-w-0 flex-col rounded-lg border border-border bg-surface p-5 shadow-e1 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3 text-small">
        <span className="inline-flex items-center gap-2 font-medium text-accent">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="pulse-ring absolute inset-0 rounded-full bg-accent/50" />
            <span className="relative h-2 w-2 rounded-full bg-accent" />
          </span>
          {p.current && p.of ? <span className="tabular-nums">Round {p.current} of {p.of}</span> : p.of ? `${p.of} rounds` : "In progress"}
        </span>
        {cur && <span className="tabular-nums text-muted">{partial ? `${cur.played}/${cur.games} games done` : "Round complete"}</span>}
      </div>
      <div className="mt-3"><RoundBar current={p.current} of={p.of} partial={partial} /></div>

      <h2 className="mt-5 text-h3 font-semibold leading-snug tracking-h3 text-fg">
        <Link to={`/tournaments/${t.id}`} className="rounded-sm hover:underline hover:decoration-border-strong hover:underline-offset-4">{t.name}</Link>
      </h2>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-small text-muted">
        <div className="flex min-w-0 items-center gap-1.5">
          <dt className="sr-only">Where</dt>
          <MapPin className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
          <dd className="truncate">{t.location ?? "Location not listed"}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Time control</dt>
          <Clock className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden />
          <dd className="font-mono text-[12.5px]">{t.timeControl ?? "—"}</dd>
        </div>
        {crDateRange(t.startDate, t.endDate) && (
          <div><dt className="sr-only">Dates</dt><dd>{crDateRange(t.startDate, t.endDate)}</dd></div>
        )}
      </dl>

      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-2">
          {t.liveUrl && (
            <Button asChild size="lg" className="max-sm:w-full">
              <a href={t.liveUrl} target="_blank" rel="noopener noreferrer">
                Open live on chess-results<ArrowUpRight aria-hidden /><span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
          )}
          <Button asChild size="lg" variant="secondary" className="max-sm:w-full">
            <Link to={`/tournaments/${t.id}`}>Tournament page<ArrowRight aria-hidden /></Link>
          </Button>
        </div>
        <p className="mt-4 text-small text-subtle">
          {refreshed ? `Refreshed ${refreshed}` : "Not refreshed yet"}
          {t.error && <span className="text-warn"> · last refresh failed</span>}
        </p>
      </div>
    </motion.li>
  );
}

function Empty() {
  return (
    <div className="mt-10 flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
      <img src="/pieces/cburnett/wK.svg" alt="" className="h-14 w-14 opacity-80" />
      <h2 className="mt-5 text-h3 font-semibold tracking-h3">No Indian tournaments are in play right now</h2>
      <p className="mt-1.5 max-w-sm text-body text-muted">This page checks chess-results.com every minute. Meanwhile, see what starts next.</p>
      <Button asChild className="mt-6" variant="secondary"><Link to="/tournaments?status=upcoming">See upcoming tournaments<ArrowRight aria-hidden /></Link></Button>
    </div>
  );
}

export default function LivePage() {
  useDocumentMeta("Live now", "Indian chess tournaments in play right now, mirrored from chess-results.com, with direct links to live boards.");
  const { data, isPending, isError, error, refetch } = useLiveTournaments();
  const rows = data?.data ?? [];
  const latest = rows.map((t) => t.lastRefreshedAt).filter(Boolean).sort().at(-1) ?? null;

  return (
    <div className={shell}>
      <PageHead
        eyebrow={<><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />Live now</>}
        title={isPending ? "Tournaments in play" : rows.length ? `${rows.length} ${rows.length === 1 ? "tournament" : "tournaments"} in play` : "Tournaments in play"}
        aside={<Link to="/tournaments?status=upcoming" className="inline-flex h-9 items-center gap-1.5 text-ui font-medium text-muted hover:text-fg">Upcoming<ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      >
        Rated events across India with rounds being played today. Live boards and pairings open on chess-results.com.
      </PageHead>
      <SourceNote refreshedAt={latest} live className="mt-4" />

      {isPending ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2" role="status" aria-label="Loading live tournaments">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[260px] rounded-lg" />)}
        </ul>
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <Empty />
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((t, i) => <LiveCard key={t.id} t={t} i={i} />)}
        </ul>
      )}
    </div>
  );
}
