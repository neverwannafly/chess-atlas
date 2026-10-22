import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useNavigate } from "react-router-dom";
import { ActiveFilters } from "@/components/ActiveFilters";
import { EventRow } from "@/components/event/EventRow";
import { EmptyState, ErrorState, RowSkeletons } from "@/components/States";
import { Toolbar } from "@/components/Toolbar";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useEventsInfinite, useStats } from "@/hooks/queries";
import { registrationOpen } from "@/lib/eventFacts";
import { hasActiveFilters, SORTS, toQuery, useFilters, type Filters } from "@/lib/filters";
import { formatInr, formatInrFull, formatMonthLabel, formatWeekdayShort, pluralize, todayIST } from "@/lib/format";
import type { EventSummary } from "@/types/event";
import { cn } from "@/lib/utils";

const HeroBoard = lazy(() => import("@/components/HeroBoard"));
// Overlays and the calendar load on first use to keep the first paint light.
const EventDrawer = lazy(() => import("@/components/event/EventDrawer").then((m) => ({ default: m.EventDrawer })));
const FilterSheet = lazy(() => import("@/components/FilterSheet").then((m) => ({ default: m.FilterSheet })));
const CalendarView = lazy(() => import("@/components/CalendarView").then((m) => ({ default: m.CalendarView })));

/* ───────────────────────── hero ───────────────────────── */

function Stat({ value, label, title }: { value: string; label: string; title?: string }) {
  return (
    <div className="min-w-0 sm:flex-1 sm:border-l sm:border-border sm:pl-4 sm:first:border-l-0 sm:first:pl-0">
      <dd className="text-[24px] font-medium leading-none tracking-h1 sm:text-stat" title={title}>{value}</dd>
      <dt className="mt-1.5 text-small text-muted">{label}</dt>
    </div>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { data: s } = useStats();
  // The banner recedes as it scrolls away; by the time its bottom edge leaves, it has faded out entirely.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.97]);
  const ahead = s ? s.upcoming + s.ongoing : null;

  return (
    <section ref={ref} className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
      <motion.div
        style={reduce ? undefined : { opacity, y, scale }}
        className="relative mx-auto grid max-w-[1200px] origin-top items-center gap-10 px-4 pb-10 pt-6 sm:px-6 sm:pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16 lg:px-8 lg:pb-14 lg:pt-14"
      >
        <div>
          {s && s.ongoing > 0 && (
            <p className="mb-5 inline-flex h-7 items-center gap-2 rounded-full border border-border bg-surface px-3 text-small text-muted shadow-e1">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              {pluralize(s.ongoing, "tournament")} being played right now
            </p>
          )}
          <h1 id="hero-title" className="max-w-[14ch] text-[38px] font-semibold leading-[1.04] tracking-display sm:text-[48px] lg:text-display">
            Every AICF tournament in India, organised.
          </h1>
          <p className="mt-5 max-w-[52ch] text-body-lg text-muted">
            Dates, time controls, prize funds, entry fees and registration deadlines, read from each brochure and laid out side by side. Filter by city, format or budget, then register.
          </p>
          <dl className="mt-9 grid max-w-xl grid-cols-2 gap-x-4 gap-y-6 sm:flex sm:gap-0">
            {s ? (
              <>
                <Stat value={String(ahead)} label="tournaments ahead" />
                <Stat value={String(s.startingThisWeek)} label="start this week" />
                {s.upcomingPrizePoolInr > 0 && <Stat value={formatInr(s.upcomingPrizePoolInr)} label="in prize funds" title={formatInrFull(s.upcomingPrizePoolInr)} />}
                <Stat value={String(s.byState.length)} label="states and UTs" />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-12 w-24 rounded-sm" aria-hidden />)
            )}
          </dl>
        </div>
        <figure className="mx-auto w-full max-w-[20rem] md:max-w-none">
          <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-e2">
            <Suspense fallback={<div className="skeleton aspect-[720/800] w-full" aria-hidden />}>
              <HeroBoard still={!!reduce} />
            </Suspense>
          </div>
          <figcaption className="sr-only">Aronian versus Anand, Wijk aan Zee 2013, replayed move by move. Anand won with Black.</figcaption>
        </figure>
      </motion.div>
    </section>
  );
}

/* ───────────────────────── listing ───────────────────────── */

type Group = { key: string; title: string; items: EventSummary[]; days: { date: string; items: EventSummary[] }[] };

function groupEvents(events: EventSummary[], today: string): Group[] {
  const groups: Group[] = [];
  const push = (key: string, title: string, e: EventSummary, day: string) => {
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, title, items: [], days: [] }));
    g.items.push(e);
    const d = g.days[g.days.length - 1];
    if (d && d.date === day) d.items.push(e);
    else g.days.push({ date: day, items: [e] });
  };
  for (const e of events) {
    if (e.startDate <= today && e.endDate >= today) push("now", "Happening now", e, e.startDate);
    else push(e.startDate.slice(0, 7), formatMonthLabel(e.startDate.slice(0, 7)), e, e.startDate);
  }
  return groups;
}

function DayLabel({ date, today }: { date: string; today: string }) {
  const n = +date.slice(8);
  const isToday = date === today;
  return (
    <div className="mb-2 flex items-baseline gap-1.5 md:sticky md:mb-0 md:block md:self-start md:pt-3.5" style={{ top: "calc(var(--toolbar-h) + 56px)" }}>
      <span className={cn("text-small font-medium md:block", isToday ? "text-accent" : "text-muted")}>{isToday ? "Today" : formatWeekdayShort(date)}</span>
      <span className="text-small font-medium text-fg md:mt-0.5 md:block md:text-[24px] md:leading-none md:tracking-h1">
        {n}
        <span className="ml-1 md:hidden">{new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))}</span>
      </span>
    </div>
  );
}

function SectionHeader({ g }: { g: Group }) {
  const prize = g.items.reduce((a, e) => a + (e.totalPrizeInr ?? 0), 0);
  return (
    <div className="glass-bg sticky z-20 -mx-4 border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ top: "var(--toolbar-h)" }}>
      <h2 id={`g-${g.key}`} className="flex h-11 items-center gap-3">
        <span className="flex items-center gap-2 text-[15px] font-semibold tracking-h3">
          {g.key === "now" && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
          {g.title}
        </span>
        <span className="text-small text-muted">{pluralize(g.items.length, "tournament")}</span>
        {prize > 0 && <span className="ml-auto text-small text-muted" title={formatInrFull(prize)}>{formatInr(prize)} in prizes</span>}
      </h2>
    </div>
  );
}

function Results({ q, events, filters, update, clear, onOpen }: {
  q: ReturnType<typeof useEventsInfinite>;
  events: EventSummary[];
  filters: Filters;
  update: (p: Partial<Filters>) => void;
  clear: () => void;
  onOpen: (code: string) => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting && !isFetchingNextPage) fetchNextPage(); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const today = todayIST();
  if (q.isError && !q.data) return <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />;
  if (q.isPending) return <RowSkeletons />;

  if (!events.length) {
    const s: { label: string; onClick: () => void }[] = [];
    if (filters.q) s.push({ label: "Clear search", onClick: () => update({ q: "" }) });
    if (filters.regOpen) s.push({ label: "Include closed registration", onClick: () => update({ regOpen: false }) });
    if (filters.from || filters.to) s.push({ label: "Any date", onClick: () => update({ from: undefined, to: undefined }) });
    if (filters.minPrize) s.push({ label: "Any prize", onClick: () => update({ minPrize: undefined }) });
    if (filters.maxFee) s.push({ label: "Any fee", onClick: () => update({ maxFee: undefined }) });
    if (filters.state.length || filters.city.length) s.push({ label: "All locations", onClick: () => update({ state: [], city: [] }) });
    if (filters.timeControl.length) s.push({ label: "Any time control", onClick: () => update({ timeControl: [] }) });
    if (filters.fide) s.push({ label: "Include unrated", onClick: () => update({ fide: false }) });
    if (filters.status.length !== 3) s.push({ label: "Include past events", onClick: () => update({ status: ["upcoming", "ongoing", "past"] }) });
    return <EmptyState suggestions={s.slice(0, 4)} onClear={clear} />;
  }

  const chrono = filters.sort === "startDate";
  return (
    <div className={cn("transition-opacity", q.isPlaceholderData && "opacity-60")}>
      {chrono ? (
        groupEvents(events, today).map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`} className="mb-8">
            <SectionHeader g={g} />
            <ol className="mt-3 space-y-4">
              {g.days.map((d) => (
                <li key={d.date} className="md:grid md:grid-cols-[3.5rem_minmax(0,1fr)] md:gap-4">
                  {g.key === "now" ? <span className="hidden md:block" /> : <DayLabel date={d.date} today={today} />}
                  <ul className="space-y-2">
                    {d.items.map((e) => <li key={e.eventCode}><EventRow e={e} onOpen={onOpen} /></li>)}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        ))
      ) : (
        <ul className="space-y-2">
          {events.map((e) => <li key={e.eventCode}><EventRow e={e} onOpen={onOpen} /></li>)}
        </ul>
      )}
      <div ref={sentinel} className="mt-8 flex justify-center">
        {hasNextPage ? (
          <Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>{isFetchingNextPage ? "Loading…" : "Load more"}</Button>
        ) : (
          <p className="text-small text-muted">End of the list.</p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */

export default function DiscoverPage() {
  useDocumentMeta();
  const { filters, update, clear } = useFilters();
  const navigate = useNavigate();
  const [text, setText] = useState(filters.q);
  const [sheet, setSheet] = useState(false);
  const [pinned, setPinned] = useState(false);
  const pinRef = useRef<HTMLDivElement>(null);
  const openedHere = useRef(false);
  const [usedSheet, setUsedSheet] = useState(false);
  const [usedDrawer, setUsedDrawer] = useState(false);
  if (sheet && !usedSheet) setUsedSheet(true);
  if (filters.event && !usedDrawer) setUsedDrawer(true);

  // URL -> input (back/forward, clear all): adjust state during render
  const [seenQ, setSeenQ] = useState(filters.q);
  if (seenQ !== filters.q) {
    setSeenQ(filters.q);
    setText(filters.q);
  }
  // input -> URL (debounced)
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => update({ q: text }), 250);
    return () => clearTimeout(t);
  }, [text, filters.q, update]);

  // The toolbar is pinned once the zero-height marker above it has scrolled to the top edge.
  useEffect(() => {
    const el = pinRef.current;
    if (!el) return;
    let raf = 0;
    const check = () => { raf = 0; setPinned(el.getBoundingClientRect().top <= 0); };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);

  const listMode = filters.view === "cards";
  const q = useEventsInfinite(toQuery(filters, filters.regOpen ? { pageSize: 200 } : {}), listMode);
  const events = useMemo(() => {
    const all = q.data?.pages.flatMap((p) => p.data) ?? [];
    return filters.regOpen ? all.filter((e) => registrationOpen(e)) : all;
  }, [q.data, filters.regOpen]);
  const total = filters.regOpen ? (q.hasNextPage ? undefined : events.length) : q.data?.pages[0]?.meta.total;

  const openEvent = useCallback((code: string) => {
    openedHere.current = true;
    update({ event: code }, { push: true });
  }, [update]);
  const closeEvent = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      navigate(-1);
    } else update({ event: undefined });
  }, [navigate, update]);

  const scrollToList = () => {
    const el = pinRef.current;
    if (el && el.getBoundingClientRect().top < 0) window.scrollTo({ top: el.offsetTop, behavior: "instant" as ScrollBehavior });
  };
  const updateAndReveal = useCallback((p: Partial<Filters>) => { update(p); requestAnimationFrame(scrollToList); }, [update]);

  return (
    <>
      <Hero />
      <div ref={pinRef} aria-hidden />
      <Toolbar filters={filters} update={updateAndReveal} text={text} setText={setText} pinned={pinned} onOpenFilters={() => setSheet(true)} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-4 pt-5">
          <p className="text-ui text-muted" role="status" aria-live="polite">
            {listMode ? (total != null ? <><strong className="font-semibold text-fg">{total.toLocaleString("en-IN")}</strong> {total === 1 ? "tournament" : "tournaments"}</> : q.isPending ? "Loading…" : `${events.length}+ tournaments`) : "Calendar"}
          </p>
          {hasActiveFilters(filters) && <ActiveFilters f={filters} update={update} clear={clear} />}
          {listMode && (
            <label className="ml-auto flex items-center gap-2 text-small text-muted">
              Sort
              <select
                className="h-8 rounded-sm border border-border-strong bg-surface px-2 text-ui text-fg"
                value={filters.sort}
                onChange={(e) => update({ sort: e.target.value })}
              >
                {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {listMode ? (
          <Results q={q} events={events} filters={filters} update={update} clear={clear} onOpen={openEvent} />
        ) : (
          <Suspense fallback={<div className="skeleton h-96 w-full rounded-md" aria-hidden />}>
            <CalendarView filters={filters} update={update} onOpen={openEvent} />
          </Suspense>
        )}
      </div>

      <Suspense fallback={null}>
        {usedSheet && <FilterSheet open={sheet} onOpenChange={setSheet} filters={filters} update={update} clear={clear} count={listMode ? total : undefined} />}
        {usedDrawer && <EventDrawer code={filters.event} summary={events.find((e) => e.eventCode === filters.event)} onClose={closeEvent} />}
      </Suspense>
    </>
  );
}
