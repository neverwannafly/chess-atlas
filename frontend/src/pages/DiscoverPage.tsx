import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { ActiveFilters } from "@/components/ActiveFilters";
import { CalendarView } from "@/components/CalendarView";
import { EventCard } from "@/components/EventCard";
import { EventTable } from "@/components/EventTable";
import { FilterBar } from "@/components/FilterBar";
import { CardSkeletons, EmptyState, ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useEventsInfinite, useStats } from "@/hooks/queries";
import { hasActiveFilters, toQuery, useFilters, type Filters } from "@/lib/filters";
import { formatInr, formatInrFull, formatMonthLabel, pluralize } from "@/lib/format";
import type { EventSummary } from "@/types/event";
import { cn } from "@/lib/utils";

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <div>
      <dd className="font-display text-3xl font-semibold leading-none sm:text-4xl" title={title}>{value}</dd>
      <dt className="mt-1.5 text-[13px] text-muted">{label}</dt>
    </div>
  );
}

function Hero({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const { data: s } = useStats();
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="board-bg pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 sm:block" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pb-12 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">The Indian tournament almanac</p>
        <h1 className="mt-3 max-w-2xl text-balance text-4xl font-semibold leading-[1.05] sm:text-6xl">
          Every rated board in India, <em className="text-accent">mapped.</em>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">Find your next tournament by city, time control, prize and entry fee — straight from the AICF calendar.</p>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-6 max-w-2xl">
          <label htmlFor="search" className="sr-only">Search tournaments</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by city, state, venue or tournament…"
              autoComplete="off"
              className="h-14 w-full rounded-xl border border-line bg-surface pl-12 pr-12 text-base shadow-sm placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-sunk">
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
        </form>
        <dl className="mt-8 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
          {s ? (
            <>
              <Stat value={String(s.upcoming + s.ongoing)} label="tournaments ahead" />
              <Stat value={formatInr(s.upcomingPrizePoolInr || null)} label="in prize money" title={s.upcomingPrizePoolInr ? formatInrFull(s.upcomingPrizePoolInr) : undefined} />
              <Stat value={String(s.startingThisWeek)} label="starting this week" />
            </>
          ) : (
            [0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-sunk" aria-hidden />)
          )}
        </dl>
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
    <div className={cn(q.isPlaceholderData && "opacity-60 transition-opacity")}>
      <p className="mb-3 text-sm text-muted" role="status" aria-live="polite">
        Showing <strong className="text-ink">{events.length}</strong> of {pluralize(total, "tournament")}
      </p>
      {groups.map((g) => (
        <Fragment key={g.month || "all"}>
          {g.month && (
            <h2 className="sticky top-0 z-10 -mx-4 mb-3 mt-6 border-b border-line bg-paper/95 px-4 py-2 text-xl font-semibold backdrop-blur first:mt-0">
              {formatMonthLabel(g.month)} <span className="ml-1 font-sans text-sm font-normal text-muted">{g.items.length}</span>
            </h2>
          )}
          {filters.view === "list" ? (
            <EventTable events={g.items} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {g.items.map((e) => <EventCard key={e.eventCode} e={e} />)}
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
      <div className="mx-auto max-w-6xl space-y-4 px-4 pt-6">
        <FilterBar filters={filters} update={update} />
        {hasActiveFilters(filters) && <ActiveFilters f={filters} update={update} clear={clear} />}
        <div className="pt-2">
          {filters.view === "calendar" ? <CalendarView filters={filters} update={update} /> : <Results filters={filters} update={update} clear={clear} />}
        </div>
      </div>
    </>
  );
}
