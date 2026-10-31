import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Hero, type HeroFigures } from "@/components/hero/Hero";
import { Timeline } from "@/components/listing/Timeline";
import { computeFacets } from "@/components/filters/facets";
import { ActiveFilters, FilterBar, QuickStrip } from "@/components/filters/FilterBar";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { EmptyState, ErrorState, RowSkeletons, type Relaxation } from "@/components/States";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { useCatalog } from "@/hooks/useCatalog";
import { useHealth } from "@/hooks/queries";
import { SourceLine, SOURCES } from "@/components/Trust";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useSearchText } from "@/hooks/useSearchText";
import { getUi, setUi, useUi } from "@/hooks/useDiscoverUi";
import { activeChips, applyFilters, serialize, SORTS, sortEvents, useFilters, type Filters, type SortKey } from "@/lib/filters";
import type { LatLng } from "@/lib/geo";
import { todayIST } from "@/lib/format";

/** Focus requests already served, so a remount doesn't steal focus again. */
let servedFocus = 0;

export default function DiscoverPage() {
  useDocumentMeta();
  const { filters, update, clear } = useFilters();
  const f = useDeferredValue(filters);
  const catalog = useCatalog(filters.past);
  const health = useHealth();
  const today = todayIST();
  const ctx = useMemo(() => ({ today }), [today]);
  const [near, setNear] = useState<LatLng | null>(null);
  const [text, setText] = useSearchText();

  const all = useMemo(() => catalog.data ?? [], [catalog.data]);
  const results = useMemo(() => sortEvents(applyFilters(all, f, ctx), f.sort, today), [all, f, ctx, today]);
  const facets = useMemo(() => computeFacets(all, filters, ctx), [all, filters, ctx]);
  const atlasEvents = useMemo(() => results.filter((e) => e.endDate >= today), [results, today]);

  const figures = useMemo<HeroFigures | null>(() => {
    if (!catalog.data) return null;
    const ahead = all.filter((e) => e.endDate >= today);
    return {
      ahead: ahead.length,
      live: ahead.filter((e) => e.startDate <= today).length,
      prize: ahead.reduce((a, e) => a + (e.totalPrizeInr ?? 0), 0),
      cities: new Set(ahead.map((e) => e.city ?? e.state).filter(Boolean)).size,
    };
  }, [catalog.data, all, today]);

  /* ── docking: the hero search hands over to the header once it scrolls under it ── */
  const searchWrap = useRef<HTMLDivElement>(null);
  const heroInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = searchWrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => setUi({ docked: !en.isIntersecting && en.boundingClientRect.top < 80 }), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => { io.disconnect(); setUi({ docked: false, sheetOpen: false }); };
  }, []);

  const focusTick = useUi((s) => s.focusTick);
  useEffect(() => {
    if (focusTick <= servedFocus) return;
    servedFocus = focusTick;
    if (!getUi().docked) heroInput.current?.focus({ preventScroll: false });
  }, [focusTick]);

  /* ── keep the list in view when a filter changes deep in the page ── */
  const listTop = useRef<HTMLDivElement>(null);
  const key = serialize({ ...filters, q: "" }).toString();
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    const el = listTop.current;
    if (!el) return;
    const chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chrome-h")) || 56;
    const top = el.getBoundingClientRect().top + window.scrollY - chrome;
    if (window.scrollY > top + 4) window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  }, [key]);
  const revealList = useCallback(() => {
    const el = listTop.current;
    if (!el) return;
    const chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chrome-h")) || 56;
    const top = el.getBoundingClientRect().top + window.scrollY - chrome;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.scrollY < top) window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const pick = useCallback((p: { city: string | null; state: string | null }) => {
    if (p.city) update({ city: [p.city], state: [] });
    else if (p.state) update({ state: [p.state], city: [] });
    requestAnimationFrame(revealList);
  }, [update, revealList]);

  const sheetOpen = useUi((s) => s.sheetOpen);
  const setSheet = useCallback((v: boolean) => setUi({ sheetOpen: v }), []);

  const relaxations: Relaxation[] = useMemo(() => {
    if (results.length) return [];
    return activeChips(f)
      .map((c) => ({ label: `Remove “${c.label.replace(/[“”]/g, "")}”`, count: applyFilters(all, { ...f, ...c.patch } as Filters, ctx).length, onClick: () => update(c.patch) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [results.length, f, all, ctx, update]);

  const sortLabel = SORTS.find((s) => s.value === f.sort)!.label;
  const resultKey = serialize(f).toString();

  let body: React.ReactNode;
  if (catalog.isError && !catalog.data) body = <ErrorState message={(catalog.error as Error).message} onRetry={() => catalog.refetch()} />;
  else if (!catalog.data) body = <RowSkeletons />;
  else if (!results.length)
    body = (
      <EmptyState
        title={f.q && activeChips(f).length === 1 ? `Nothing matches “${f.q}”` : "No tournaments match"}
        suggestions={relaxations}
        onClear={clear}
      />
    );
  else body = <Timeline events={results} grouped={f.sort === "soon"} resultKey={resultKey} flatTitle={`Sorted by ${sortLabel.toLowerCase()}`} />;

  return (
    <>
      <Hero
        ref={heroInput}
        searchWrapRef={searchWrap}
        figures={figures}
        atlasEvents={atlasEvents}
        q={text}
        setQ={setText}
        onSubmit={() => { heroInput.current?.blur(); revealList(); }}
        onPick={pick}
      />
      <FilterBar f={filters} update={update} facets={facets} near={near} setNear={setNear} onMore={() => setSheet(true)} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <QuickStrip f={filters} update={update} facets={facets} onMore={() => setSheet(true)} />
        <ActiveFilters f={filters} update={update} clear={clear} />
        <div className="flex items-center justify-between gap-3 pb-1 lg:hidden">
          <p className="text-ui text-muted" aria-live="polite">
            <NumberTicker value={facets.total} duration={0.5} className="font-semibold text-fg" /> {facets.total === 1 ? "tournament" : "tournaments"}
          </p>
          <label className="relative flex items-center text-small text-muted">
            <span className="sr-only">Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
              className="h-10 appearance-none rounded-sm bg-transparent pl-2 pr-7 text-right text-ui font-medium text-fg"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 h-4 w-4 text-subtle" aria-hidden />
          </label>
        </div>
        <SourceLine sources={[SOURCES.aicf]} refreshedAt={health.data ? health.data.lastScrapeAt : undefined} verb="calendar checked" className="pb-2 pt-1">
          <span className="text-subtle">· brochure details summarised automatically; confirm with the organiser</span>
        </SourceLine>
        <div ref={listTop} className="scroll-mt-0" />
        <div className="lg:pt-2" style={{ opacity: f !== filters ? 0.7 : 1, transition: "opacity 120ms" }}>{body}</div>
      </div>

      <FilterSheet open={sheetOpen} onOpenChange={setSheet} f={filters} update={update} clear={clear} facets={facets} near={near} setNear={setNear} />
    </>
  );
}
