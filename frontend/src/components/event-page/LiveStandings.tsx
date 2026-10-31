import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { SourceNote } from "@/components/cr/common";
import { useCrTournament } from "@/hooks/crQueries";
import { formatPoints, playerName } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

const ROWS = 10;

export function LiveStandings({ tournamentId }: { tournamentId: string }) {
  const q = useCrTournament(tournamentId, true);
  const t = q.data;
  const href = `https://chess-results.com/tnr${tournamentId}.aspx?lan=1`;

  if (q.isPending)
    return (
      <div className="space-y-2" role="status" aria-label="Loading standings">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  if (q.isError || !t) return <ErrorState message="Could not load the standings." onRetry={() => q.refetch()} />;

  const rows = t.standings.slice(0, ROWS);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-ui text-fg">Standings from chess-results.com</p>
          <SourceNote refreshedAt={t.refresh?.lastRefreshedAt ?? t.lastRefreshedAt} live={t.status === "ongoing"} failed={!!t.error} href={t.chessResultsUrl || href} />
        </div>
        <div className="flex gap-4 text-ui">
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-border-strong underline-offset-[3px] hover:decoration-fg">Open on chess-results ↗</a>
          <Link to={`/tournaments/${tournamentId}`} className="text-fg underline decoration-border-strong underline-offset-[3px] hover:decoration-fg">Tournament page</Link>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-body text-muted">Standings are not published yet</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-e1">
          <table className="w-full table-fixed border-collapse text-ui">
            <caption className="sr-only">Top {rows.length} standings</caption>
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-left text-label font-medium uppercase tracking-[0.06em] text-subtle">
                <th scope="col" className="w-11 py-2.5 pl-3 pr-2 text-right font-medium">#</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Player</th>
                <th scope="col" className="w-16 px-2 py-2.5 text-right font-medium">Rating</th>
                <th scope="col" className="w-14 py-2.5 pl-2 pr-3 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {rows.map((r) => (
                <tr key={r.snr}>
                  <td className={cn("py-2.5 pl-3 pr-2 text-right font-mono text-[13px] tabular-nums", r.rank && r.rank <= 3 ? "font-semibold text-accent" : "text-muted")}>{r.rank ?? "—"}</td>
                  <td className="px-2 py-2.5"><span className="block truncate font-medium text-fg" title={playerName(r.name)}>{playerName(r.name)}</span></td>
                  <td className="px-2 py-2.5 text-right font-mono text-[13px] tabular-nums">{r.rating ?? <span className="font-sans text-subtle">—</span>}</td>
                  <td className="py-2.5 pl-2 pr-3 text-right font-mono text-[14px] font-semibold tabular-nums">{formatPoints(r.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
