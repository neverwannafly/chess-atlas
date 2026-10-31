import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { FideRatingPoint, PlayerDetail, RatingList } from "@/types/chessresults";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { ExternalLink, SourceNote, StatusPill, TitleBadge } from "@/components/cr/common";
import { RatingChart } from "@/components/cr/RatingChart";
import NotFoundPage from "@/pages/NotFoundPage";
import { usePlayer } from "@/hooks/crQueries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError } from "@/lib/api";
import { crDateRange, fideProfileUrl, formatPoints, playerName, relativeTime, shell } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

const LIST_LABEL: Record<RatingList, string> = { standard: "Standard", rapid: "Rapid", blitz: "Blitz" };

function monthLabel(p: string) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", month: "short", year: "numeric" }).format(new Date(`${p}-01T00:00:00Z`));
}

/** Latest rating per list with the change over the last 12 published months. */
function RatingTiles({ points }: { points: FideRatingPoint[] }) {
  const lists = (["standard", "rapid", "blitz"] as RatingList[]).map((l) => {
    const pts = points.filter((p) => p.list === l).sort((a, b) => a.period.localeCompare(b.period));
    if (!pts.length) return { l, latest: null, delta: null };
    const latest = pts[pts.length - 1];
    const [y, m] = latest.period.split("-").map(Number);
    const yearAgo = `${y - 1}-${String(m).padStart(2, "0")}`;
    const base = [...pts].reverse().find((p) => p.period <= yearAgo) ?? (pts.length > 1 ? pts[0] : null);
    return { l, latest, delta: base ? latest.rating - base.rating : null, since: base?.period };
  });
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
      {lists.map(({ l, latest, delta, since }) => (
        <div key={l} className="bg-surface px-3 py-3.5 sm:px-4">
          <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{LIST_LABEL[l]}</dt>
          <dd className="mt-1.5">
            <span className={cn("block font-mono text-[22px] font-medium leading-none tabular-nums sm:text-stat", !latest && "text-subtle")}>{latest?.rating ?? "—"}</span>
            {latest && (
              <span className="mt-1.5 block truncate text-small text-muted" title={since ? `Change since ${monthLabel(since)}` : undefined}>
                {delta != null && delta !== 0 && <span className="font-mono tabular-nums text-fg">{delta > 0 ? "+" : "−"}{Math.abs(delta)} </span>}
                {delta === 0 && <span className="text-fg">±0 </span>}
                <span className="max-sm:hidden">{monthLabel(latest.period)}</span>
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function History({ p }: { p: PlayerDetail }) {
  if (!p.tournaments.length) return <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-body text-muted">No mirrored tournaments for this player yet.</p>;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface shadow-e1">
      <table className="w-full border-collapse text-ui">
        <caption className="sr-only">Tournament history</caption>
        <thead>
          <tr className="border-b border-border bg-surface-2/60 text-left text-label font-medium uppercase tracking-[0.06em] text-subtle">
            <th scope="col" className="py-2.5 pl-4 pr-2 font-medium">Tournament</th>
            <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Rating</th>
            <th scope="col" className="px-2 py-2.5 text-right font-medium">Rank</th>
            <th scope="col" className="py-2.5 pl-2 pr-4 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {p.tournaments.map((t) => (
            <tr key={t.tournamentId} className="transition-colors hover:bg-surface-2/60">
              <td className="max-w-0 py-3 pl-4 pr-2">
                <Link to={`/tournaments/${t.tournamentId}`} className="block truncate font-medium text-fg hover:underline hover:decoration-border-strong hover:underline-offset-4">{t.tournament}</Link>
                <span className="mt-0.5 flex items-center gap-2 text-small text-muted">
                  {t.status !== "finished" && <StatusPill status={t.status} className="h-5 px-1.5 text-[12px]" />}
                  <span className="truncate">{crDateRange(t.startDate, t.endDate) ?? "Dates not listed"}</span>
                  <span className="truncate sm:hidden">{t.rating ? `· ${t.rating}` : ""}</span>
                </span>
              </td>
              <td className="hidden px-2 py-3 text-right font-mono text-[13px] tabular-nums text-muted sm:table-cell">{t.rating ?? "—"}</td>
              <td className="px-2 py-3 text-right font-mono text-[13px] tabular-nums">{t.rank ?? <span className="text-subtle">—</span>}</td>
              <td className="py-3 pl-2 pr-4 text-right font-mono text-[14px] font-semibold tabular-nums">{formatPoints(t.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlayerPage() {
  const { id = "" } = useParams();
  const { data: p, isPending, isError, error, refetch } = usePlayer(id);
  useDocumentMeta(p ? playerName(p.name) : undefined, p ? `${playerName(p.name)}: FIDE ratings and tournament history.` : undefined);

  if (isPending)
    return (
      <div className={cn(shell, "space-y-4 pt-10")} role="status" aria-label="Loading player">
        <Skeleton className="h-10 w-1/2" /><Skeleton className="h-5 w-1/3" /><Skeleton className="mt-6 h-64 w-full rounded-md" />
      </div>
    );
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="player" />;
    return <div className={shell}><ErrorState message={(error as Error).message} onRetry={() => refetch()} /></div>;
  }

  const name = playerName(p.name);
  const fideRel = relativeTime(p.fideFetchedAtMs);
  return (
    <div className={shell}>
      <header className="pt-5 sm:pt-6">
        <nav aria-label="Breadcrumb" className="text-small text-muted">
          <Link
            to="/players"
            onClick={(ev) => { if (window.history.state?.idx > 0) { ev.preventDefault(); window.history.back(); } }}
            className="-mx-1 inline-flex h-8 items-center gap-1.5 rounded-sm px-1 hover:text-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Players
          </Link>
        </nav>
        <div className="mt-5 flex items-start gap-4">
          <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border bg-[var(--board-light)] sm:flex" aria-hidden>
            <img src={p.sex === "F" ? "/pieces/cburnett/wQ.svg" : "/pieces/cburnett/wK.svg"} alt="" className="h-12 w-12" />
          </div>
          <div className="min-w-0">
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[28px] font-semibold leading-[1.12] tracking-h1 sm:text-[36px]">
              {p.title && <span className="text-accent">{p.title}</span>}
              <span>{name}</span>
            </h1>
            <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-ui text-muted">
              <div className="flex gap-1.5"><dt>Federation</dt><dd className="font-medium text-fg">{p.fed}</dd></div>
              {p.title && <div className="flex items-center gap-1.5"><dt className="sr-only">Title</dt><dd><TitleBadge title={p.title} /></dd></div>}
              <div className="flex gap-1.5">
                <dt>FIDE ID</dt>
                <dd className="font-mono text-[13px] text-fg">{p.fideId ? <ExternalLink href={fideProfileUrl(p.fideId)}>{p.fideId}</ExternalLink> : <span className="font-sans text-subtle">none on record</span>}</dd>
              </div>
              {p.inactive && <div><dd className="text-warn">Inactive on FIDE list</dd></div>}
            </dl>
          </div>
        </div>
      </header>

      <section aria-labelledby="ratings" className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="ratings" className="text-h2 font-semibold tracking-h2">FIDE rating</h2>
          {p.fideId && <p className="text-small text-muted">Source: <ExternalLink href={fideProfileUrl(p.fideId)}>ratings.fide.com</ExternalLink>{fideRel && <> · fetched {fideRel}</>}</p>}
        </div>
        {p.fideRatings.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-body text-muted">No FIDE rating on record.</p>
        ) : (
          <div className="space-y-6">
            <RatingTiles points={p.fideRatings} />
            <div className="rounded-md border border-border bg-surface p-4 shadow-e1 sm:p-5">
              <RatingChart points={p.fideRatings} />
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="history" className="mt-12">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="history" className="text-h2 font-semibold tracking-h2">Tournament history</h2>
          <p className="text-small text-muted">{p.tournaments.length} {p.tournaments.length === 1 ? "event" : "events"}</p>
        </div>
        <History p={p} />
        <SourceNote refreshedAt={undefined} className="mt-4">
          {fideRel && <><span className="text-subtle" aria-hidden>·</span><span>FIDE ratings fetched {fideRel}</span></>}
        </SourceNote>
      </section>
    </div>
  );
}
