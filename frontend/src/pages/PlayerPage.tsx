import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw, X } from "lucide-react";
import type { FideRatingPoint, PlayerDetail, PlayerResult, RatingList } from "@/types/chessresults";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { ExternalLink, StatusPill, TitleBadge } from "@/components/cr/common";
import { EmptyNote, SourceLine, SOURCES } from "@/components/Trust";
import { RatingChart } from "@/components/cr/RatingChart";
import NotFoundPage from "@/pages/NotFoundPage";
import { useNow, usePlayer } from "@/hooks/crQueries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError } from "@/lib/api";
import { absoluteTime, crDateRange, fideProfileUrl, formatPoints, playerName, relativeTime, shell } from "@/lib/chessresults";
import {
  groupEvents, headToHead, isForfeit, lastRefreshed, opponents, resultLabel, type EventRecord, type OpponentSummary, type RoundLine,
} from "@/lib/playerRecord";
import { cn } from "@/lib/utils";

const LIST_LABEL: Record<RatingList, string> = { standard: "Standard", rapid: "Rapid", blitz: "Blitz" };
const EVENTS_STEP = 8;
const OPPONENTS_STEP = 12;
const linkCls = "hover:underline hover:decoration-border-strong hover:underline-offset-4";
const headCls = "border-b border-border bg-surface-2/60 text-left text-label font-medium uppercase tracking-[0.06em] text-subtle";

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

function RecordCard({ r }: { r: NonNullable<PlayerDetail["record"]> }) {
  if (r.games <= 0) return <EmptyNote>No rated games on record yet</EmptyNote>;
  const pts = Number.isInteger(r.points) ? String(r.points) : r.points.toFixed(1);
  const items = [
    { k: "Games", v: String(r.games) }, { k: "Wins", v: String(r.wins) }, { k: "Draws", v: String(r.draws) },
    { k: "Losses", v: String(r.losses) }, { k: "Points", v: pts },
  ];
  const seg = (n: number) => ({ width: `${(n / r.games) * 100}%` });
  return (
    <section aria-label="Record" className="rounded-md border border-border bg-surface p-4 shadow-e1 sm:p-5">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5">
        {items.map((i) => (
          <div key={i.k}>
            <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{i.k}</dt>
            <dd className="mt-1 font-mono text-[20px] font-medium leading-none tabular-nums">{i.v}</dd>
          </div>
        ))}
      </dl>
      <div
        role="img"
        aria-label={`${r.wins} wins, ${r.draws} draws, ${r.losses} losses`}
        className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-muted/40"
      >
        <span className="bg-accent" style={seg(r.wins)} />
        <span className="bg-surface-2" style={seg(r.draws)} />
        <span className="bg-muted" style={seg(r.losses)} />
      </div>
    </section>
  );
}

// ───────────────────────────── small parts ─────────────────────────────

function ColourMark({ c }: { c: "w" | "b" | null }) {
  if (!c) return <span className="text-subtle" aria-label="Colour not shown">–</span>;
  const label = c === "w" ? "White" : "Black";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("inline-block h-3 w-3 rounded-[2px] border border-border-strong align-middle", c === "w" ? "bg-[var(--board-light)]" : "bg-[var(--board-dark)]")}
    />
  );
}

function ResultCell({ r }: { r: RoundLine }) {
  if (r.score === null && !r.result) return <span className="text-subtle" title="Not played yet">—<span className="sr-only">not played yet</span></span>;
  const tone = r.score === 1 ? "text-fg" : r.score === 0.5 ? "text-muted" : "text-subtle";
  return <span className={cn("font-semibold", tone)} title={isForfeit(r.result) ? "Forfeit" : undefined}>{resultLabel(r.result)}</span>;
}

function Opponent({ r }: { r: PlayerResult }) {
  const name = r.opponentName ? playerName(r.opponentName) : r.opponentSnr == null ? "Bye" : "Unknown player";
  return r.opponentPlayerId != null ? (
    <Link to={`/players/${r.opponentPlayerId}`} className={cn("truncate font-medium text-fg", linkCls)}>{name}</Link>
  ) : (
    <span className={cn("truncate", r.opponentName ? "font-medium text-muted" : "text-subtle")}>{name}</span>
  );
}

const fedOf = (f: string | null | undefined) => (f && f !== "UNK" ? f : null);

// ───────────────────────────── results ─────────────────────────────

function RoundsTable({ e }: { e: EventRecord }) {
  return (
    <table className="w-full table-fixed border-collapse text-ui">
      <caption className="sr-only">Rounds played in {e.tournament}</caption>
      <thead>
        <tr className={headCls}>
          <th scope="col" className="w-11 py-2 pl-4 pr-1 font-medium sm:w-14 sm:pl-5">Rd</th>
          <th scope="col" className="hidden w-12 px-1 py-2 font-medium sm:table-cell">Bd</th>
          <th scope="col" className="w-7 px-1 py-2 font-medium"><span className="sr-only">Colour</span></th>
          <th scope="col" className="px-1 py-2 font-medium">Opponent</th>
          <th scope="col" className="hidden w-[72px] px-1 py-2 text-right font-medium sm:table-cell">Rating</th>
          <th scope="col" className="hidden w-16 py-2 pl-4 pr-1 font-medium md:table-cell">Fed</th>
          <th scope="col" className="w-12 px-1 py-2 text-right font-medium">Res</th>
          <th scope="col" className="w-14 py-2 pl-1 pr-4 text-right font-medium sm:w-16 sm:pr-5" title="Points after this round">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/70">
        {e.rounds.map((r) => (
          <tr key={r.round} className="transition-colors hover:bg-surface-2/60">
            <td className="py-2.5 pl-4 pr-1 font-mono text-[13px] tabular-nums text-muted sm:pl-5">{r.round}</td>
            <td className="hidden px-1 py-2.5 font-mono text-[13px] tabular-nums text-subtle sm:table-cell">{r.board ?? "—"}</td>
            <td className="px-1 py-2.5"><ColourMark c={r.color} /></td>
            <td className="px-1 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <Opponent r={r} />
                {r.opponentTitle && <span className="max-sm:hidden"><TitleBadge title={r.opponentTitle} /></span>}
              </span>
              <span className="block truncate font-mono text-[12px] tabular-nums text-muted sm:hidden">
                {[r.opponentTitle, r.opponentRating ?? (r.opponentName ? "unrated" : null), fedOf(r.opponentFed)].filter(Boolean).join(" · ")}
              </span>
            </td>
            <td className="hidden px-1 py-2.5 text-right font-mono text-[13px] tabular-nums sm:table-cell">{r.opponentRating ?? <span className="font-sans text-subtle">—</span>}</td>
            <td className="hidden py-2.5 pl-4 pr-1 text-small text-muted md:table-cell">{fedOf(r.opponentFed) ?? "—"}</td>
            <td className="px-1 py-2.5 text-right font-mono text-[14px] tabular-nums"><ResultCell r={r} /></td>
            <td className="py-2.5 pl-1 pr-4 text-right font-mono text-[13px] tabular-nums text-muted sm:pr-5">{r.running === null ? "" : formatPoints(r.running)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventCard({ e }: { e: EventRecord }) {
  const dates = crDateRange(e.startDate, e.endDate);
  // Points as published in the standings; otherwise the sum of the stored rounds.
  const pts = e.points ?? (e.played ? e.scored : null);
  return (
    <article className="overflow-hidden rounded-md border border-border bg-surface shadow-e1" aria-label={e.tournament}>
      <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-h3 font-semibold tracking-h3">
            <Link to={`/tournaments/${e.tournamentId}`} className={cn("text-fg", linkCls)}>{e.tournament}</Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted">
            {e.status !== "finished" && <StatusPill status={e.status} className="h-5 px-1.5 text-[12px]" />}
            <span>{dates ?? "Dates not listed"}</span>
            {e.snr != null && <><span className="text-subtle" aria-hidden>·</span><span>Start no. <span className="font-mono tabular-nums text-fg">{e.snr}</span></span></>}
            <span className="text-subtle" aria-hidden>·</span>
            <span>Rating <span className="font-mono tabular-nums text-fg">{e.rating ?? "unrated"}</span></span>
          </p>
        </div>
        <dl className="flex shrink-0 gap-4 text-right sm:gap-6">
          <div>
            <dt className="text-label font-medium uppercase tracking-[0.08em] text-subtle">Rank</dt>
            <dd className={cn("mt-1 font-mono text-[17px] font-medium tabular-nums", e.rank && e.rank <= 3 ? "text-accent" : "text-fg")}>{e.rank ?? <span className="text-subtle">—</span>}</dd>
          </div>
          <div>
            <dt className="text-label font-medium uppercase tracking-[0.08em] text-subtle">Pts</dt>
            <dd className="mt-1 font-mono text-[17px] font-semibold tabular-nums" title={e.points == null && pts != null ? "Sum of the rounds below" : undefined}>
              {formatPoints(pts)}
              {e.played > 0 && <span className="font-normal text-subtle">/{e.played}</span>}
            </dd>
          </div>
        </dl>
      </header>
      {e.rounds.length ? (
        <div className="border-t border-border"><RoundsTable e={e} /></div>
      ) : (
        <p className="border-t border-border px-4 py-3 text-small text-muted sm:px-5">
          {e.status === "upcoming" ? "Not started yet." : "Round-by-round results for this event are not stored yet."}
        </p>
      )}
    </article>
  );
}

function RefreshLine({ p, polling }: { p: PlayerDetail; polling: boolean }) {
  const now = useNow();
  const last = p.refresh?.lastRefreshedAt ?? lastRefreshed(p.results ?? []);
  const rel = relativeTime(last, now);
  const iso = last ? new Date(last).toISOString() : undefined;
  const resting = p.refresh?.reason === "resting after rate limit";
  return (
    <div aria-live="polite">
      <SourceLine sources={[SOURCES.chessResults]}>
        <span className="text-subtle" aria-hidden>·</span>
        <span>
          Results are refreshed when you open this page; {rel ? <>last refreshed <time dateTime={iso} title={iso ? `${absoluteTime(iso)} IST` : undefined}>{rel}</time></> : "not refreshed yet"}
        </span>
        {polling && (
          <span className="inline-flex items-center gap-1 text-subtle"><RefreshCw className="h-3 w-3" aria-hidden />checking for new results</span>
        )}
        {resting && (
          <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="h-3 w-3" aria-hidden />refresh paused for a while; chess-results asked us to slow down</span>
        )}
      </SourceLine>
    </div>
  );
}

function Results({ events, p, polling }: { events: EventRecord[]; p: PlayerDetail; polling: boolean }) {
  const [limit, setLimit] = useState(EVENTS_STEP);
  const games = events.reduce((n, e) => n + e.played, 0);
  return (
    <section aria-labelledby="results" className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="results" className="text-h2 font-semibold tracking-h2">Results</h2>
        <p className="text-small text-muted">{events.length} {events.length === 1 ? "event" : "events"} · {games} {games === 1 ? "game" : "games"}</p>
      </div>
      <RefreshLine p={p} polling={polling} />
      <div className="mt-4 space-y-4">
        {events.length === 0 ? (
          <EmptyNote>No mirrored tournaments for this player yet.</EmptyNote>
        ) : (
          events.slice(0, limit).map((e) => <EventCard key={e.tournamentId} e={e} />)
        )}
      </div>
      {events.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" className="max-sm:w-full" onClick={() => setLimit(events.length)}>Show all {events.length} events</Button>
        </div>
      )}
    </section>
  );
}

// ───────────────────────────── opponents ─────────────────────────────

function Opponents({ list, selfId }: { list: OpponentSummary[]; selfId: number }) {
  const [limit, setLimit] = useState(OPPONENTS_STEP);
  return (
    <section aria-labelledby="opponents" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="opponents" className="text-h2 font-semibold tracking-h2">Opponents</h2>
        <p className="text-small text-muted">{list.length}</p>
      </div>
      {list.length === 0 ? (
        <EmptyNote>Opponents appear once round results are stored.</EmptyNote>
      ) : (
        <>
          <ol className="divide-y divide-border/70 overflow-hidden rounded-md border border-border bg-surface shadow-e1">
            {list.slice(0, limit).map((o) => (
              <li key={o.playerId} className="flex min-h-[52px] items-center justify-between gap-3 py-1.5 pl-4 pr-2">
                <div className="min-w-0">
                  <Link to={`/players/${o.playerId}`} className={cn("block truncate text-ui font-medium text-fg", linkCls)}>
                    {o.title && <span className="mr-1.5 text-accent">{o.title}</span>}{playerName(o.name)}
                  </Link>
                  <span className="block truncate text-small text-muted">
                    {o.games} {o.games === 1 ? "game" : "games"} · <span className="font-mono tabular-nums">+{o.wins} ={o.draws} −{o.losses}</span>
                  </span>
                </div>
                <Link
                  to={`/players/${selfId}?vs=${o.playerId}`}
                  className="flex min-h-11 shrink-0 flex-col items-end justify-center rounded-sm px-2 text-right transition-colors hover:bg-surface-2"
                  aria-label={`Head to head with ${playerName(o.name)}: score ${formatPoints(o.score)} of ${o.games}`}
                >
                  <span className="font-mono text-[14px] font-semibold tabular-nums text-fg">{formatPoints(o.score)}<span className="font-normal text-subtle">/{o.games}</span></span>
                  <span className="text-[12px] text-muted">Head to head</span>
                </Link>
              </li>
            ))}
          </ol>
          {list.length > limit && (
            <div className="mt-3 flex justify-center">
              <Button variant="ghost" className="max-sm:w-full" onClick={() => setLimit(list.length)}>Show all {list.length} opponents</Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ───────────────────────────── head to head ─────────────────────────────

function HeadToHead({ p, vsId, results }: { p: PlayerDetail; vsId: number; results: PlayerResult[] }) {
  const games = useMemo(() => headToHead(results, vsId), [results, vsId]);
  const scored = games.filter((g) => g.score !== null);
  const score = scored.reduce((s, g) => s + (g.score ?? 0), 0);
  const wins = scored.filter((g) => g.score === 1).length;
  const draws = scored.filter((g) => g.score === 0.5).length;
  const self = playerName(p.name);
  const other = games[0]?.opponentName ? playerName(games[0].opponentName) : "this player";
  return (
    <section aria-labelledby="h2h" className="mt-10 overflow-hidden rounded-md border border-border bg-surface shadow-e1">
      <header className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-label font-medium uppercase tracking-[0.08em] text-muted">Head to head</p>
          <h2 id="h2h" className="mt-1 text-h3 font-semibold tracking-h3">
            {self} <span className="font-normal text-muted">vs</span>{" "}
            <Link to={`/players/${vsId}?vs=${p.id}`} className={cn("text-fg", linkCls)}>{other}</Link>
          </h2>
          {scored.length > 0 && (
            <p className="mt-1 text-small text-muted">
              {scored.length} {scored.length === 1 ? "game" : "games"} · score <span className="font-mono tabular-nums text-fg">{formatPoints(score)}–{formatPoints(scored.length - score)}</span>
              {" "}· <span className="font-mono tabular-nums">+{wins} ={draws} −{scored.length - wins - draws}</span>
            </p>
          )}
        </div>
        <Link to={`/players/${p.id}`} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-sm px-2 text-small text-muted transition-colors hover:bg-surface-2 hover:text-fg">
          <X className="h-3.5 w-3.5" aria-hidden />Close
        </Link>
      </header>
      {games.length === 0 ? (
        <p className="border-t border-border px-4 py-4 text-small text-muted sm:px-5">No games between these players in the results we hold.</p>
      ) : (
        <table className="w-full table-fixed border-collapse border-t border-border text-ui">
          <caption className="sr-only">Games between {self} and {other}</caption>
          <thead>
            <tr className={headCls}>
              <th scope="col" className="py-2 pl-4 pr-1 font-medium sm:pl-5">Event</th>
              <th scope="col" className="w-12 px-1 py-2 font-medium">Rd</th>
              <th scope="col" className="w-8 px-1 py-2 font-medium"><span className="sr-only">Colour of {self}</span></th>
              <th scope="col" className="w-14 py-2 pl-1 pr-4 text-right font-medium sm:pr-5">Res</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {games.map((g) => (
              <tr key={`${g.tournamentId}-${g.round}`} className="transition-colors hover:bg-surface-2/60">
                <td className="py-2.5 pl-4 pr-1 sm:pl-5">
                  <Link to={`/tournaments/${g.tournamentId}`} className={cn("block truncate font-medium text-fg", linkCls)}>{g.tournament}</Link>
                  <span className="block truncate text-small text-muted">{crDateRange(g.startDate, g.endDate) ?? "Dates not listed"}</span>
                </td>
                <td className="px-1 py-2.5 font-mono text-[13px] tabular-nums text-muted">{g.round}</td>
                <td className="px-1 py-2.5"><ColourMark c={g.color} /></td>
                <td className="py-2.5 pl-1 pr-4 text-right font-mono text-[14px] tabular-nums sm:pr-5"><ResultCell r={g} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="border-t border-border px-4 py-2.5 text-small text-subtle sm:px-5">Results from {self}'s side, from the events we mirror.</p>
    </section>
  );
}

// ───────────────────────────── page ─────────────────────────────

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 max-w-full gap-1.5">
      <dt className="shrink-0">{k}</dt>
      <dd className="min-w-0 truncate font-medium text-fg">{children}</dd>
    </div>
  );
}

export default function PlayerPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const { data: p, isPending, isError, error, refetch, isFetching } = usePlayer(id);
  useDocumentMeta(p ? playerName(p.name) : undefined, p ? `${playerName(p.name)}: results round by round, opponents and FIDE ratings.` : undefined);

  const results = useMemo(() => p?.results ?? [], [p?.results]);
  const events = useMemo(() => (p ? groupEvents(p.tournaments, results) : []), [p, results]);
  const opps = useMemo(() => opponents(results), [results]);
  const vsRaw = params.get("vs");
  const vsId = vsRaw && /^\d{1,12}$/.test(vsRaw) ? Number(vsRaw) : null;

  if (isPending)
    return (
      <div className={cn(shell, "space-y-4 pt-10")} role="status" aria-label="Loading player">
        <Skeleton className="h-10 w-1/2" /><Skeleton className="h-5 w-1/3" /><Skeleton className="mt-6 h-64 w-full rounded-md" />
      </div>
    );
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="player" />;
    return <div className={shell}><ErrorState title="Couldn't load this player" message={(error as Error).message} onRetry={() => refetch()} /></div>;
  }

  const name = playerName(p.name);
  const latestList = p.fideRatings.map((r) => r.period).sort().at(-1) ?? null;
  const st = p.refresh?.state;
  const polling = isFetching || st === "queued" || st === "in_progress";
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
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-title font-semibold tracking-h1 sm:text-[36px] sm:leading-[1.12]">
              {p.title && <span className="text-accent">{p.title}</span>}
              <span>{name}</span>
            </h1>
            <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-ui text-muted">
              <Fact k="Federation">{p.fed}</Fact>
              {p.title && <div className="flex items-center gap-1.5"><dt className="sr-only">Title</dt><dd><TitleBadge title={p.title} /></dd></div>}
              {p.club && <Fact k="Club"><span title={p.club}>{p.club}</span></Fact>}
              {p.ageCategory && <Fact k="Age category">{p.ageCategory}</Fact>}
              <div className="flex gap-1.5">
                <dt>FIDE ID</dt>
                <dd className="font-mono text-[13px] text-fg">{p.fideId ? <ExternalLink href={fideProfileUrl(p.fideId)}>{p.fideId}</ExternalLink> : <span className="font-sans text-subtle">none on record</span>}</dd>
              </div>
              {p.identNumber && (
                <div className="flex gap-1.5" title="chess-results Ident-Number, verified from the player card">
                  <dt>Ident-Number</dt>
                  <dd className="font-mono text-[13px] text-fg">{p.identNumber}</dd>
                </div>
              )}
              {p.inactive ? <div><dd className="text-warn">Inactive on FIDE list</dd></div> : null}
            </dl>
          </div>
        </div>
      </header>

      {p.record && <div className="mt-5"><RecordCard r={p.record} /></div>}

      {vsId != null && vsId !== p.id && <HeadToHead p={p} vsId={vsId} results={results} />}

      <div className="mt-10 grid gap-12 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
        <Results events={events} p={p} polling={polling} />
        <Opponents list={opps} selfId={p.id} />
      </div>

      <section aria-labelledby="ratings" className="mt-12 lg:mt-14">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="ratings" className="text-h2 font-semibold tracking-h2">FIDE rating</h2>
        </div>
        {p.fideRatings.length === 0 ? (
          <EmptyNote>{p.fideId ? "No rating for this player on the FIDE lists we hold." : "No FIDE rating on record. Ratings appear only for players with a verified FIDE id."}</EmptyNote>
        ) : (
          <div className="space-y-6">
            <RatingTiles points={p.fideRatings} />
            <div className="rounded-md border border-border bg-surface p-4 shadow-e1 sm:p-5">
              <RatingChart points={p.fideRatings} />
            </div>
          </div>
        )}
        <SourceLine sources={[SOURCES.fide]} refreshedAt={p.fideFetchedAtMs ?? undefined} verb="fetched" className="mt-4">
          {latestList && <><span className="text-subtle" aria-hidden>·</span><span>latest list {monthLabel(latestList)}</span></>}
        </SourceLine>
      </section>
    </div>
  );
}
