import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion, useScroll, useTransform, motion } from "motion/react";
import { Search, X } from "lucide-react";
import { ActiveFilters } from "@/components/ActiveFilters";
import { CalendarView } from "@/components/CalendarView";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { FilterBar } from "@/components/FilterBar";
import { CardSkeletons, EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/CountUp";
import { scrollToEl } from "@/hooks/useSmoothScroll";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useEventsInfinite, useStats } from "@/hooks/queries";
import { hasActiveFilters, toQuery, useFilters, type Filters } from "@/lib/filters";
import { formatInr, formatInrFull, formatMonthLabel, pluralize } from "@/lib/format";
import type { EventSummary } from "@/types/event";
import { cn } from "@/lib/utils";

const HeroBoard = lazy(() => import("@/components/HeroBoard"));

function Stat({ value, label, title, index }: { value: number; label: string; title?: string; index: number }) {
  return (
    <div className="hall-in border-l-4 border-gold pl-3" style={{ "--i": 4 + index } as React.CSSProperties}>
      <dd className="font-display text-3xl font-extrabold leading-none text-hall-ink sm:text-5xl" title={title}>
        <CountUp value={value} format={(n) => (label === "in prize money" ? formatInr(Math.round(n)) : String(Math.round(n)))} />
      </dd>
      <dt className="mt-1.5 text-[14px] text-hall-muted">{label}</dt>
    </div>
  );
}

function BoardSlot() {
  const { data: s } = useStats();
  const reduce = useReducedMotion();
  const places = useMemo(() => (s?.byState ?? []).slice(0, 6), [s]);
  return (
    <div className="mx-auto w-full max-w-[26rem] lg:max-w-none">
      <Suspense fallback={<div className="aspect-[720/860] w-full animate-pulse rounded-lg bg-hall-up" aria-hidden />}>
        <HeroBoard places={places} total={s?.total ?? 0} still={!!reduce} />
      </Suspense>
    </div>
  );
}

function Hero({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const { data: s } = useStats();
  const pool = s?.upcomingPrizePoolInr ?? 0;
  return (
    <section className="on-hall relative overflow-hidden bg-hall text-hall-ink">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-10 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 lg:pb-14 lg:pt-12">
        <div>
          <h1 className="display-xl hall-in text-balance text-[3.25rem] sm:text-7xl lg:text-[5.5rem]" style={{ "--i": 0 } as React.CSSProperties}>
            Every rated tournament in India, on one board.
          </h1>
          <p className="hall-in mt-5 max-w-lg text-lg text-hall-muted" style={{ "--i": 1 } as React.CSSProperties}>
            Search the AICF calendar by city, time control, prize and entry fee, then see the schedule, venue and how to register.
          </p>
          <form role="search" onSubmit={(e) => e.preventDefault()} className="hall-in mt-7 max-w-xl" style={{ "--i": 2 } as React.CSSProperties}>
            <label htmlFor="search" className="sr-only">Search tournaments</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-hall" aria-hidden />
              <input
                id="search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="City, state, venue or tournament name"
                autoComplete="off"
                className="h-14 w-full rounded-md border-4 border-gold bg-hall-ink pl-12 pr-12 text-base font-medium text-hall placeholder:text-hall/60 focus-visible:outline-4 focus-visible:outline-offset-2 [&::-webkit-search-cancel-button]:hidden"
              />
              {q && (
                <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-hall hover:bg-hall/10">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </form>
          <dl className="mt-9 flex max-w-xl flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
            {s ? (
              <>
                <Stat index={0} value={s.upcoming + s.ongoing} label="tournaments ahead" />
                {pool > 0 && <Stat index={1} value={pool} label="in prize money" title={formatInrFull(pool)} />}
                <Stat index={2} value={s.startingThisWeek} label="starting this week" />
              </>
            ) : (
              [0, 1, 2].map((i) => <div key={i} className="h-14 w-28 animate-pulse rounded bg-hall-up" aria-hidden />)
            )}
          </dl>
        </div>
        <BoardSlot />
      </div>
      <div className="grid grid-cols-8 text-center font-display text-sm font-bold text-hall-muted" aria-hidden>
        {"abcdefgh".split("").map((f, i) => <span key={f} className={cn("py-1.5", i % 2 ? "bg-hall" : "bg-hall-up")}>{f}</span>)}
      </div>
    </section>
  );
}

function groupByMonth(events: EventSummary[]) {
  const groups: { month: string; items: EventSummary[] }[] = [];
  for (const e of events) {
    const m = e.startDate.slice(0, 7);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.items.push(e);
    else groups.push({ month: m, items: [e] });
  }
  return groups;
}

/** Month stations beside the list. The fill follows scroll position through the list, like rounds ticking over. */
function MonthRail({ months, active, listRef }: { months: string[]; active: string; listRef: React.RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 30%", "end 70%"] });
  const fill = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <nav aria-label="Jump to month" className="sticky top-6 hidden self-start lg:block">
      <div className="relative py-1 pl-6">
        <span className="absolute bottom-1 left-[5px] top-1 w-1 rounded bg-ink/15" aria-hidden />
        <motion.span className="absolute bottom-1 left-[5px] top-1 w-1 origin-top rounded bg-gold" style={{ scaleY: fill }} aria-hidden />
        <ol className="space-y-1">
          {months.map((m) => (
            <li key={m} className="relative">
              <span className={cn("absolute -left-[22px] top-2.5 h-3.5 w-3.5 border-2 border-ink transition-colors", m === active ? "bg-gold" : "bg-paper")} aria-hidden />
              <button
                type="button"
                aria-current={m === active ? "true" : undefined}
                onClick={() => { const el = document.getElementById(`m-${m}`); if (el) scrollToEl(el); }}
                className={cn("w-full cursor-pointer rounded py-1.5 text-left font-display text-lg leading-tight", m === active ? "font-extrabold text-ink" : "font-semibold text-muted hover:text-ink")}
              >
                {formatMonthLabel(m)}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

function Results({ filters, update, clear }: { filters: Filters; update: (p: Partial<Filters>) => void; clear: () => void }) {
  const q = useEventsInfinite(toQuery(filters));
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const events = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
  const total = q.data?.pages[0]?.meta.total ?? 0;
  const grouped = filters.sort === "startDate" || filters.sort === "-startDate";
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState("");
  const monthKey = grouped ? events.map((e) => e.startDate.slice(0, 7)).filter((m, i, a) => a.indexOf(m) === i).join() : "";
  useEffect(() => {
    const heads = listRef.current?.querySelectorAll<HTMLElement>("[data-month]");
    if (!heads?.length) return;
    const io = new IntersectionObserver(
      (en) => { for (const x of en) if (x.isIntersecting) setActive((x.target as HTMLElement).dataset.month ?? ""); },
      { rootMargin: "-10% 0px -80% 0px" }
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [monthKey]);

  if (q.isError && !q.data) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (q.isPending) return <CardSkeletons />;

  if (!events.length) {
    const suggestions: { label: string; onClick: () => void }[] = [];
    if (filters.q) suggestions.push({ label: "Clear search", onClick: () => update({ q: "" }) });
    if (filters.status.length !== 3) suggestions.push({ label: "Include past events", onClick: () => update({ status: ["upcoming", "ongoing", "past"] }) });
    if (filters.from || filters.to) suggestions.push({ label: "Any date", onClick: () => update({ from: undefined, to: undefined }) });
    if (filters.minPrize) suggestions.push({ label: "Any prize", onClick: () => update({ minPrize: undefined }) });
    if (filters.maxFee) suggestions.push({ label: "Any fee", onClick: () => update({ maxFee: undefined }) });
    if (filters.state.length || filters.city.length) suggestions.push({ label: "All locations", onClick: () => update({ state: [], city: [] }) });
    if (filters.fide) suggestions.push({ label: "Include unrated", onClick: () => update({ fide: false }) });
    return <EmptyState suggestions={suggestions} onClear={clear} />;
  }

  const groups = grouped ? groupByMonth(events) : [{ month: "", items: events }];
  return (
    <div ref={listRef} className={cn("lg:grid lg:gap-10", grouped && "lg:grid-cols-[9.5rem_minmax(0,1fr)]", q.isPlaceholderData && "opacity-60 transition-opacity")}>
      {grouped && <MonthRail months={groups.map((g) => g.month)} active={active} listRef={listRef} />}
      <div className="min-w-0">
      <p className="mb-3 text-sm text-muted" role="status" aria-live="polite">
        Showing <strong className="text-ink">{events.length}</strong> of {pluralize(total, "tournament")}
      </p>
      {groups.map((g) => (
        <Fragment key={g.month || "all"}>
          {g.month && (
            <h2 id={`m-${g.month}`} data-month={g.month} className="sticky top-0 z-10 -mx-4 mb-4 mt-8 flex items-baseline gap-3 border-b-4 border-ink bg-paper px-4 py-2 font-display text-3xl font-extrabold first:mt-0 sm:text-4xl lg:mx-0 lg:px-0">
              {formatMonthLabel(g.month)} <span className="rounded bg-gold px-2 py-0.5 font-sans text-sm font-bold text-hall">{g.items.length}</span>
            </h2>
          )}
          {filters.view === "list" ? (
            <EventTable events={g.items} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {g.items.map((e, i) => <EventCard key={e.eventCode} e={e} index={i} />)}
            </div>
          )}
        </Fragment>
      ))}
      <div ref={sentinel} className="mt-8 flex justify-center">
        {hasNextPage ? (
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : (
          <p className="text-sm text-muted">That's everything.</p>
        )}
      </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  useDocumentMeta();
  const { filters, update, clear } = useFilters();
  const [text, setText] = useState(filters.q);

  // URL -> input (back/forward, clear all): adjust state during render
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q);
  }
  // input -> URL (debounced)
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => update({ q: text }), 300);
    return () => clearTimeout(t);
  }, [text, filters.q, update]);

  return (
    <>
      <Hero q={text} setQ={setText} />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-8">
        <FilterBar filters={filters} update={update} />
        {hasActiveFilters(filters) && <ActiveFilters f={filters} update={update} clear={clear} />}
        <div className="pt-2">
          {filters.view === "calendar" ? <CalendarView filters={filters} update={update} /> : <Results filters={filters} update={update} clear={clear} />}
        </div>
      </div>
    </>
  );
}
