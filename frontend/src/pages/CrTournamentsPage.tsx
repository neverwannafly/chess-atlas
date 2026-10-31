import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { CrStatus, CrTournament } from "@/types/chessresults";
import { Segmented } from "@/components/ui/Segmented";
import { SearchField } from "@/components/ui/SearchField";
import { ErrorState } from "@/components/States";
import { PageHead, SourceNote, StatusPill } from "@/components/cr/common";
import { useCrCount, useCrTournaments, useDebounced } from "@/hooks/crQueries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { formatMonthLabel } from "@/lib/format";
import { shell } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

type Tab = "live" | "upcoming" | "finished" | "all";
const TAB_STATUS: Record<Tab, CrStatus | undefined> = { live: "ongoing", upcoming: "upcoming", finished: "finished", all: undefined };
const isTab = (v: string | null): v is Tab => v === "live" || v === "upcoming" || v === "finished" || v === "all";

const COLS = "lg:grid lg:grid-cols-[64px_minmax(0,1fr)_150px_72px_96px_36px_16px] lg:gap-x-4";

const dayFmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));

function DateBlock({ start, end }: { start: string | null; end: string | null }) {
  if (!start) return <div className="w-[52px] shrink-0 text-ui text-subtle lg:w-auto" aria-label="Dates not listed">—</div>;
  const multi = !!end && end !== start;
  const crossMonth = multi && start.slice(0, 7) !== end!.slice(0, 7);
  return (
    <div className="w-[52px] shrink-0 lg:w-auto" aria-hidden>
      <div className="flex items-baseline whitespace-nowrap leading-none">
        <span className="text-[20px] font-medium tracking-h2 text-fg">{+start.slice(8)}</span>
        {multi && <span className="text-small font-medium text-subtle">–{+end!.slice(8)}</span>}
      </div>
      <div className="mt-1.5 whitespace-nowrap text-label uppercase tracking-[0.04em] text-muted">
        {crossMonth ? `${dayFmt(start, { month: "short" })}–${dayFmt(end!, { month: "short" })}` : dayFmt(start, { month: "short" })}
      </div>
    </div>
  );
}

function Row({ t, showStatus }: { t: CrTournament; showStatus: boolean }) {
  return (
    <article className={cn("group relative flex gap-3 rounded-sm px-1 py-3.5 transition-colors duration-[var(--dur-1)] hover:bg-surface-2/70 lg:items-center lg:px-3 lg:py-3", COLS)}>
      <DateBlock start={t.startDate} end={t.endDate} />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug tracking-h3 text-fg lg:truncate">
          <Link
            to={`/tournaments/${t.id}`}
            className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-sm after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent"
          >
            {t.status === "ongoing" && <span className="pulse-dot mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-accent align-middle" aria-label="Live" />}
            {t.name}
          </Link>
        </h3>
        <p className="mt-0.5 truncate text-small text-muted">
          {t.location ?? "Location not listed"}
          <span className="lg:hidden">
            {t.timeControl && <><span className="px-1.5 text-subtle" aria-hidden>·</span><span className="font-mono text-[12px]">{t.timeControl}</span></>}
            {t.rounds && <><span className="px-1.5 text-subtle" aria-hidden>·</span>{t.rounds} rds</>}
          </span>
        </p>
        <div className="mt-1.5 flex items-center gap-2 lg:hidden">
          {showStatus && <StatusPill status={t.status} />}
          <a href={t.chessResultsUrl} target="_blank" rel="noopener noreferrer" className="relative z-20 inline-flex h-7 items-center gap-1 text-small text-muted underline decoration-border-strong underline-offset-[3px] hover:text-fg">
            chess-results<ArrowUpRight className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className="hidden truncate font-mono text-[12.5px] text-fg lg:block">{t.timeControl ?? <span className="font-sans text-subtle">—</span>}</div>
      <div className="hidden text-ui tabular-nums text-fg lg:block">{t.rounds ?? <span className="text-subtle">—</span>}</div>
      <div className="hidden lg:block">{showStatus ? <StatusPill status={t.status} /> : null}</div>
      <a
        href={t.chessResultsUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open on chess-results.com"
        className="relative z-20 hidden h-9 w-9 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-3 hover:text-fg lg:flex"
      >
        <ArrowUpRight className="h-4 w-4" aria-hidden />
        <span className="sr-only">Open {t.name} on chess-results.com (new tab)</span>
      </a>
      <ArrowRight className="hidden h-4 w-4 -translate-x-1 text-subtle opacity-0 transition-[opacity,transform] duration-[var(--dur-2)] group-hover:translate-x-0 group-hover:opacity-100 lg:block" aria-hidden />
    </article>
  );
}

interface Group { key: string; title: string; hint?: string; live?: boolean; items: CrTournament[] }

/** Live first, then upcoming by month (soonest first), then finished by month (latest first). */
function group(rows: CrTournament[], tab: Tab): Group[] {
  const rank = (s: CrStatus) => (s === "ongoing" ? 0 : s === "upcoming" ? 1 : 2);
  const sorted = [...rows].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r) return r;
    const as = a.startDate ?? "9999", bs = b.startDate ?? "9999";
    return a.status === "finished" ? bs.localeCompare(as) : as.localeCompare(bs);
  });
  const out: Group[] = [];
  for (const t of sorted) {
    const key = t.status === "ongoing" ? "live" : `${t.status}-${t.startDate?.slice(0, 7) ?? "undated"}`;
    let g = out.find((x) => x.key === key);
    if (!g) {
      g = t.status === "ongoing"
        ? { key, title: "In play now", live: true, items: [] }
        : { key, title: t.startDate ? formatMonthLabel(t.startDate.slice(0, 7)) : "Dates not listed", hint: tab === "all" ? (t.status === "upcoming" ? "Upcoming" : "Finished") : undefined, items: [] };
      out.push(g);
    }
    g.items.push(t);
  }
  return out;
}

function GroupHeader({ g, showStatus }: { g: Group; showStatus: boolean }) {
  return (
    <div className="sticky z-20 -mx-4 bg-bg/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" style={{ top: "var(--header-h)" }}>
      <div className={cn("flex h-11 items-center border-b border-border px-1 lg:px-3", COLS, "lg:items-center")}>
        <h2 className="flex min-w-0 items-baseline gap-2 lg:col-span-2" id={`g-${g.key}`}>
          <span className="flex items-center gap-2 text-ui font-semibold tracking-h3 text-fg">
            {g.live && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            {g.title}
          </span>
          <span className="text-small tabular-nums text-muted">{g.items.length}</span>
          {g.hint && <span className="text-small text-subtle">{g.hint}</span>}
        </h2>
        <div className="hidden text-label font-medium uppercase tracking-[0.06em] text-subtle lg:contents" aria-hidden>
          <span>Time control</span>
          <span>Rounds</span>
          <span>{showStatus ? "Status" : ""}</span>
          <span className="text-center">Source</span>
          <span />
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div role="status" aria-label="Loading tournaments" className="mt-6 divide-y divide-border/70">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex gap-3 px-1 py-4" style={{ opacity: 1 - i * 0.09 }}>
          <div className="w-12 space-y-1.5"><div className="skeleton h-5 w-9 rounded-sm" /><div className="skeleton h-3 w-10 rounded-sm" /></div>
          <div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3 rounded-sm" /><div className="skeleton h-3 w-1/3 rounded-sm" /></div>
        </div>
      ))}
    </div>
  );
}

export default function CrTournamentsPage() {
  useDocumentMeta("Tournaments on chess-results", "Live, upcoming and finished Indian chess tournaments mirrored from chess-results.com.");
  const reduce = !!useReducedMotion();
  const [params, setParams] = useSearchParams();
  const tab: Tab = isTab(params.get("status")) ? (params.get("status") as Tab) : "all";
  const urlQ = params.get("q") ?? "";
  const [text, setText] = useState(urlQ);
  const q = useDebounced(text.trim(), 250);

  useEffect(() => {
    if (q === urlQ) return;
    setParams((p) => { const n = new URLSearchParams(p); if (q) n.set("q", q); else n.delete("q"); return n; }, { replace: true });
  }, [q, urlQ, setParams]);

  const status = TAB_STATUS[tab];
  const list = useCrTournaments({ status, fed: "IND", q: urlQ || undefined });
  const counts = {
    live: useCrCount("ongoing", urlQ).data,
    upcoming: useCrCount("upcoming", urlQ).data,
    finished: useCrCount("finished", urlQ).data,
    all: useCrCount(undefined, urlQ).data,
  };
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.data) ?? [], [list.data]);
  const groups = useMemo(() => group(rows, tab), [rows, tab]);
  const total = list.data?.pages[0]?.meta.total ?? 0;
  const latest = rows.map((t) => t.lastRefreshedAt).filter(Boolean).sort().at(-1) ?? null;
  const showStatus = tab === "all";

  const setTab = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); if (t === "all") n.delete("status"); else n.set("status", t); return n; });

  return (
    <div className={shell}>
      <PageHead eyebrow="India · FIDE federation IND" title="Tournaments">
        Every Indian event we mirror from chess-results.com: in play, about to start, and finished with full results.
      </PageHead>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <Segmented<Tab>
            label="Status"
            value={tab}
            onChange={setTab}
            options={[
              { value: "live", label: "Live", count: counts.live },
              { value: "upcoming", label: "Upcoming", count: counts.upcoming },
              { value: "finished", label: "Finished", count: counts.finished },
              { value: "all", label: "All", count: counts.all },
            ]}
          />
        </div>
        <SearchField id="cr-search" value={text} onChange={setText} className="w-full lg:w-[340px]" placeholder="Search by name or city" shortcut={false} />
      </div>
      <SourceNote refreshedAt={latest} className="mt-4" />

      <div className="mt-4">
        {list.isPending ? (
          <SkeletonRows />
        ) : list.isError ? (
          <ErrorState message={(list.error as Error).message} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <h2 className="text-h3 font-semibold tracking-h3">{urlQ ? `Nothing matches “${urlQ}”` : tab === "live" ? "Nothing in play right now" : "No tournaments here yet"}</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-body text-muted">
              {urlQ ? "Try another name or city, or look in another tab." : tab === "live" ? "Check what's coming up next." : "The mirror adds events as chess-results.com publishes them."}
            </p>
            {tab === "live" && !urlQ && <button type="button" onClick={() => setTab("upcoming")} className="mt-5 h-9 rounded-sm border border-border-strong bg-surface px-4 text-ui font-medium shadow-e1 hover:bg-surface-2">See upcoming</button>}
          </div>
        ) : (
          <div className={cn("transition-opacity", list.isPlaceholderData && "opacity-60")}>
            {groups.map((g) => (
              <section key={g.key} aria-labelledby={`g-${g.key}`} className="mb-6">
                <GroupHeader g={g} showStatus={showStatus} />
                <ul className="divide-y divide-border/70">
                  <AnimatePresence initial={false} mode="popLayout">
                    {g.items.map((t, i) => (
                      <motion.li
                        key={t.id}
                        layout={reduce ? false : "position"}
                        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1], delay: reduce ? 0 : (i % 10) * 0.025 }}
                      >
                        <Row t={t} showStatus={showStatus} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
            <div className="flex justify-center py-6">
              {list.hasNextPage ? (
                <button type="button" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()} className="h-9 rounded-sm border border-border-strong bg-surface px-4 text-ui font-medium text-fg shadow-e1 hover:bg-surface-2 disabled:opacity-60">
                  {list.isFetchingNextPage ? "Loading…" : `Show more (${total - rows.length} left)`}
                </button>
              ) : (
                rows.length > 8 && <p className="flex items-center gap-3 text-small text-subtle"><span className="h-px w-8 bg-border" />{total} tournaments<span className="h-px w-8 bg-border" /></p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
