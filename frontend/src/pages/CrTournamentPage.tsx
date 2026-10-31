import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowUpRight } from "lucide-react";
import type { CrGame, CrStanding, CrTournamentDetail } from "@/types/chessresults";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { EmptyNote } from "@/components/Trust";
import { ExternalLink, SourceNote, StatusPill } from "@/components/cr/common";
import NotFoundPage from "@/pages/NotFoundPage";
import { useCrRound, useCrTournament, useListedRounds, useNow } from "@/hooks/crQueries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError } from "@/lib/api";
import { absoluteTime, crDateRange, formatPoints, formatTiebreak, playerName, relativeTime, roundProgress, shell } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const STANDINGS_STEP = 50;

function SectionTitle({ id, title, meta }: { id: string; title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-h2 font-semibold tracking-h2">{title}</h2>
      {meta && <div className="text-small text-muted">{meta}</div>}
    </div>
  );
}

// ───────────────────────────── header ─────────────────────────────

/** Phone order for the facts strip: place first and full width, then dates, rounds, time control, players. */
const MOBILE_ORDER = ["max-sm:order-1", "max-sm:order-first max-sm:col-span-2", "max-sm:order-3", "max-sm:order-2", "max-sm:order-4"];

function Header({ t }: { t: CrTournamentDetail }) {
  const reduce = useReducedMotion();
  const now = useNow();
  const listed = useListedRounds(t.id);
  const rp = roundProgress(t.roundList, listed ?? (t.status === "finished" && t.roundList.length ? t.roundList.length : null));
  // The detail payload carries the scheduled count and the highest paired round when known; prefer them.
  const p = { current: t.currentRound ?? rp.current, of: t.rounds ?? rp.of };
  const dates = crDateRange(t.startDate, t.endDate);
  const fade = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: EASE, delay: 0.05 * i } });
  const updated = relativeTime(t.lastUpdatedAt, now);
  const next = t.status !== "finished" ? relativeTime(t.nextRefreshAt, now) : null;
  const facts: [string, React.ReactNode, boolean?][] = [
    ["Dates", dates ?? <span className="text-subtle">Not listed</span>],
    ["Where", t.location ?? <span className="text-subtle">Not listed</span>],
    ["Time control", t.timeControl ?? <span className="text-subtle">—</span>, true],
    [t.status === "ongoing" ? "Round" : "Rounds", p.of ? (t.status === "ongoing" && p.current ? `${p.current} of ${p.of}` : p.of) : t.status === "ongoing" && p.current ? `${p.current}` : <span className="text-subtle">—</span>],
    ["Players", t.standings.length || <span className="text-subtle">—</span>],
  ];
  return (
    <header className="pt-5 sm:pt-6">
      <nav aria-label="Breadcrumb" className="text-small text-muted">
        <Link
          to="/tournaments"
          onClick={(ev) => { if (window.history.state?.idx > 0) { ev.preventDefault(); window.history.back(); } }}
          className="-mx-1 inline-flex h-8 items-center gap-1.5 rounded-sm px-1 hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />Tournaments
        </Link>
      </nav>
      <motion.div {...fade(0)} className="mt-5 flex flex-wrap items-center gap-2">
        <StatusPill status={t.status} />
        <span className="text-small text-subtle">Federation {t.federation}</span>
      </motion.div>
      <h1 className="mt-3 max-w-[30ch] text-title font-semibold tracking-h1 sm:text-[36px] sm:leading-[1.12]">{t.name}</h1>
      <motion.dl {...fade(1)} className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-[1.1fr_1.6fr_1.3fr_0.8fr_0.8fr]">
        {facts.map(([k, v, mono], i) => (
          <div key={k} className={cn("min-w-0 bg-surface px-4 py-3", MOBILE_ORDER[i])}>
            <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{k}</dt>
            <dd className={cn("mt-1 text-ui text-fg sm:truncate", mono && "font-mono text-[13px]", k === "Round" && "text-live")} title={typeof v === "string" ? v : undefined}>{v}</dd>
          </div>
        ))}
      </motion.dl>
      <motion.div {...fade(2)} className="mt-5 flex flex-wrap gap-2">
        {t.liveUrl && (
          <Button asChild size="lg" className="max-sm:w-full">
            <a href={t.liveUrl} target="_blank" rel="noopener noreferrer">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent-fg" aria-hidden />Live boards on chess-results<ArrowUpRight aria-hidden /><span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        )}
        <Button asChild size="lg" variant="secondary" className="max-sm:w-full">
          <a href={t.chessResultsUrl} target="_blank" rel="noopener noreferrer">
            Official page on chess-results<ArrowUpRight aria-hidden /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
      </motion.div>
      <div className="mt-5 space-y-1 border-t border-border pt-4">
        <SourceNote refreshedAt={t.lastRefreshedAt} live={t.status === "ongoing"} failed={!!t.error} href={t.chessResultsUrl}>
          {next && <span className="text-subtle">· next refresh {next}</span>}
        </SourceNote>
        {updated && <p className="text-small text-subtle" title={absoluteTime(t.lastUpdatedAt!)}>Organiser last changed the page on chess-results {updated}.</p>}
        {t.error && (
          <p className="flex items-center gap-1.5 text-small text-warn"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />Figures may be behind. Check the official page.</p>
        )}
      </div>
    </header>
  );
}

// ───────────────────────────── standings ─────────────────────────────

function Standings({ rows }: { rows: CrStanding[] }) {
  const [limit, setLimit] = useState(STANDINGS_STEP);
  const tbCount = Math.max(0, ...rows.map((r) => r.tiebreaks.length));
  const hasTb = rows.some((r) => r.tiebreaks.some((v) => v != null));
  const started = rows.some((r) => r.points != null);
  const shown = rows.slice(0, limit);
  const leader = started ? rows.find((r) => r.rank === 1) : null;

  if (!rows.length)
    return <EmptyNote title="No players listed yet">The starting list appears here once the organiser publishes it on chess-results.</EmptyNote>;

  return (
    <>
      {leader && (
        <div className="mb-4 flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3 shadow-e1">
          <img src="/pieces/cburnett/wK.svg" alt="" className="h-8 w-8 shrink-0" />
          <p className="min-w-0 text-ui">
            <span className="text-muted">Leading: </span>
            {leader.playerId != null ? (
              <Link to={`/players/${leader.playerId}`} className="font-medium text-fg hover:underline hover:underline-offset-4">{playerName(leader.name)}</Link>
            ) : (
              <span className="font-medium text-fg">{playerName(leader.name)}</span>
            )}
            <span className="ml-2 font-mono text-muted">{formatPoints(leader.points)} pts</span>
          </p>
        </div>
      )}
      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-e1">
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 border-collapse text-ui">
            <caption className="sr-only">{started ? "Standings" : "Starting list"}</caption>
            <thead>
              <tr className="border-b border-border bg-surface-2/60 text-left text-label font-medium uppercase tracking-[0.06em] text-subtle">
                <th scope="col" className="w-12 py-2.5 pl-4 pr-2 text-right font-medium">{started ? "#" : "No."}</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Player</th>
                <th scope="col" className="hidden px-2 py-2.5 font-medium sm:table-cell">Fed</th>
                <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Rating</th>
                {started && <th scope="col" className="px-2 py-2.5 text-right font-medium">Pts</th>}
                {hasTb && Array.from({ length: tbCount }, (_, i) => (
                  <th key={i} scope="col" className="hidden px-2 py-2.5 text-right font-medium md:table-cell" title={`Tiebreak ${i + 1} (as defined by the organiser on chess-results)`}>TB{i + 1}</th>
                ))}
                <th scope="col" className="w-2 p-0" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {shown.map((r) => (
                <tr key={r.snr} className="transition-colors hover:bg-surface-2/60">
                  <td className={cn("py-2.5 pl-4 pr-2 text-right font-mono text-[13px] tabular-nums", r.rank && r.rank <= 3 ? "font-semibold text-accent" : "text-muted")}>{started ? r.rank ?? "—" : r.snr}</td>
                  <td className="max-w-0 px-2 py-2.5">
                    {r.playerId != null ? (
                      <Link to={`/players/${r.playerId}`} className="block truncate font-medium text-fg hover:underline hover:decoration-border-strong hover:underline-offset-4">{playerName(r.name)}</Link>
                    ) : (
                      <span className="block truncate font-medium text-muted">{playerName(r.name)}</span>
                    )}
                    <span className="block truncate text-small text-muted sm:hidden">{[r.rating ?? "Unrated", r.fed].join(" · ")}</span>
                    {r.club && <span className="hidden truncate text-small text-subtle sm:block">{r.club}</span>}
                  </td>
                  <td className="hidden px-2 py-2.5 text-small text-muted sm:table-cell">{r.fed}</td>
                  <td className="hidden px-2 py-2.5 text-right font-mono text-[13px] tabular-nums sm:table-cell">{r.rating ?? <span className="font-sans text-subtle">—</span>}</td>
                  {started && <td className="px-2 py-2.5 text-right font-mono text-[14px] font-semibold tabular-nums text-fg">{formatPoints(r.points)}</td>}
                  {hasTb && Array.from({ length: tbCount }, (_, i) => (
                    <td key={i} className="hidden px-2 py-2.5 text-right font-mono text-[13px] tabular-nums text-muted md:table-cell">{formatTiebreak(r.tiebreaks[i])}</td>
                  ))}
                  <td className="w-2 p-0" aria-hidden />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > limit && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setLimit((l) => l + 200)}>Show all {rows.length} players</Button>
        </div>
      )}
    </>
  );
}

// ───────────────────────────── rounds ─────────────────────────────

const RESULT_TONE: Record<string, string> = { "1-0": "text-fg", "0-1": "text-fg", "½-½": "text-muted" };

function Side({ name, rating, snr, playerId, toId, align }: { name: string | null; rating: number | null; snr: number | null; playerId?: number | null; toId: (snr: number | null) => number | undefined; align: "left" | "right" }) {
  // The round payload carries the player id; older payloads fall back to the standings' start numbers.
  const id = playerId !== undefined ? playerId ?? undefined : toId(snr);
  const label = name ? playerName(name) : "Bye";
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      {id ? (
        <Link to={`/players/${id}`} className="block truncate font-medium text-fg hover:underline hover:decoration-border-strong hover:underline-offset-4">{label}</Link>
      ) : (
        <span className={cn("block truncate", name ? "font-medium text-fg" : "text-subtle")}>{label}</span>
      )}
      <span className="block font-mono text-[12px] tabular-nums text-muted">{rating ?? (name ? "unrated" : "")}</span>
    </div>
  );
}

function GameRow({ g, toId }: { g: CrGame; toId: (snr: number | null) => number | undefined }) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)_56px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:grid-cols-[36px_minmax(0,1fr)_72px_minmax(0,1fr)] sm:gap-3 sm:px-4">
      <span className="font-mono text-[12px] tabular-nums text-subtle">{g.board}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-border-strong bg-[var(--board-light)]" aria-label="White" />
        <Side name={g.whiteName} rating={g.whiteRating} snr={g.whiteSnr} playerId={g.whitePlayerId} toId={toId} align="left" />
      </div>
      <span className={cn("text-center font-mono text-[13px] font-semibold tabular-nums", g.result ? RESULT_TONE[g.result] ?? "text-muted" : "text-subtle")}>
        {g.result ?? <span className="font-sans text-small font-normal">playing</span>}
      </span>
      <div className="flex min-w-0 items-center justify-end gap-2">
        <Side name={g.blackName} rating={g.blackRating} snr={g.blackSnr} playerId={g.blackPlayerId} toId={toId} align="right" />
        <span className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-[var(--board-dark)]" aria-label="Black" />
      </div>
    </li>
  );
}

function Rounds({ t }: { t: CrTournamentDetail }) {
  const live = t.status === "ongoing";
  const p = roundProgress(t.roundList, null);
  const [round, setRound] = useState<number | null>(t.currentRound ?? p.current);
  const { data: games, isPending, isError, refetch, isPlaceholderData } = useCrRound(t.id, round, live);
  const stripRef = useRef<HTMLDivElement>(null);
  const bySnr = useMemo(() => new Map(t.standings.map((s) => [s.snr, s.playerId])), [t.standings]);
  const toId = (snr: number | null) => (snr == null ? undefined : bySnr.get(snr) ?? undefined);
  const matches = useMemo(() => {
    const m = new Map<number, CrGame[]>();
    for (const g of games ?? []) m.set(g.match, [...(m.get(g.match) ?? []), g]);
    return [...m].sort((a, b) => a[0] - b[0]);
  }, [games]);
  const team = matches.some(([n]) => n > 1);
  const info = t.roundList.find((r) => r.round === round);

  if (!t.roundList.length)
    return <EmptyNote title="No pairings published yet">Round 1 pairings appear here once the arbiter publishes them.</EmptyNote>;

  return (
    <>
      <div ref={stripRef} className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Round" className="inline-flex gap-1 rounded-sm border border-border-strong/70 bg-surface-2 p-0.5">
          {t.roundList.map((r) => {
            const on = r.round === round;
            const playing = live && r.played < r.games;
            return (
              <button
                key={r.round}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setRound(r.round)}
                className={cn("relative flex h-9 min-w-11 items-center justify-center gap-1.5 rounded-[5px] px-3 text-ui font-medium tabular-nums transition-colors", on ? "text-fg" : "text-muted hover:text-fg")}
              >
                {on && <motion.span layoutId="round-thumb" className="absolute inset-0 rounded-[5px] border border-border bg-surface shadow-e1" transition={{ type: "spring", stiffness: 500, damping: 40 }} aria-hidden />}
                <span className="relative">{r.round}</span>
                {playing && <span className="pulse-dot relative h-1.5 w-1.5 rounded-full bg-live" aria-label="in progress" />}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-small text-muted">
        Round {round}
        {info && <> · <span className="tabular-nums">{info.played} of {info.games}</span> results in</>}
      </p>
      <div className={cn("mt-3 transition-opacity", isPlaceholderData && "opacity-60")} role="tabpanel" aria-label={`Round ${round} pairings`}>
        {isPending ? (
          <div className="space-y-2" role="status" aria-label="Loading pairings">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : isError ? (
          <ErrorState title="Couldn't load this round" message="The pairings didn't load. Try again, or open the round on chess-results." onRetry={() => refetch()} />
        ) : !games?.length ? (
          <EmptyNote>No pairings for this round yet.</EmptyNote>
        ) : (
          <div className="space-y-4">
            {matches.map(([n, gs]) => (
              <div key={n} className="overflow-hidden rounded-md border border-border bg-surface shadow-e1">
                {team && <p className="border-b border-border bg-surface-2/60 px-4 py-2 text-label font-medium uppercase tracking-[0.06em] text-muted">Match {n}</p>}
                <ul className="divide-y divide-border/70 text-ui">{gs.map((g) => <GameRow key={`${g.match}-${g.board}`} g={g} toId={toId} />)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ───────────────────────────── page ─────────────────────────────

function PageSkeleton() {
  return (
    <div className={cn(shell, "space-y-4 pt-10")} role="status" aria-label="Loading tournament">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-8 h-72 w-full rounded-md" />
    </div>
  );
}

export default function CrTournamentPage() {
  const { id = "" } = useParams();
  const { data: t, isPending, isError, error, refetch } = useCrTournament(id, true);
  useDocumentMeta(t?.name, t ? `${t.name}: standings, pairings and results from chess-results.com.` : undefined);

  if (isPending) return <PageSkeleton />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="tournament" />;
    return <div className={shell}><ErrorState title="Couldn't load this tournament" message={(error as Error).message} onRetry={() => refetch()} /></div>;
  }
  const started = t.standings.some((s) => s.points != null);
  return (
    <div className={shell}>
      <Header t={t} />
      <div className="mt-10 space-y-14">
        <section aria-labelledby="standings">
          <SectionTitle id="standings" title={started ? "Standings" : "Starting list"} meta={`${t.standings.length} players`} />
          <Standings rows={t.standings} />
        </section>
        <section aria-labelledby="rounds" className="max-w-3xl">
          <SectionTitle id="rounds" title="Rounds" meta={<ExternalLink href={t.chessResultsUrl}>Full pairings</ExternalLink>} />
          <Rounds t={t} />
        </section>
      </div>
      <SourceNote refreshedAt={t.lastRefreshedAt} href={t.chessResultsUrl} className="mt-10" />
    </div>
  );
}
