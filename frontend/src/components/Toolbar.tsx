import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Chip, Segmented } from "@/components/Chip";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import type { Filters, ViewMode } from "@/lib/filters";
import { cn } from "@/lib/utils";

const QUICK_TC = ["Classical", "Rapid", "Blitz"];

function sheetFilterCount(f: Filters) {
  return [f.state.length, f.city.length, f.from || f.to, f.minPrize, f.maxFee, f.status.length, f.timeControl.includes("Mixed")].filter(Boolean).length;
}

/**
 * The bar under the hero. It pins to the top once the hero has scrolled away and picks up the logo,
 * so search and the key filters are always one tap away. Its height feeds --toolbar-h for sticky headers.
 */
export function Toolbar({ filters: f, update, text, setText, pinned, onOpenFilters }: {
  filters: Filters;
  update: (p: Partial<Filters>) => void;
  text: string;
  setText: (v: string) => void;
  pinned: boolean;
  onOpenFilters: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--toolbar-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // "/" focuses search, like most developer tools
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const toggleTc = (t: string) => update({ timeControl: f.timeControl.includes(t) ? f.timeControl.filter((x) => x !== t) : [...f.timeControl, t] });
  const more = sheetFilterCount(f);

  const quick = (
    <>
      {QUICK_TC.map((t) => <Chip key={t} pressed={f.timeControl.includes(t)} onClick={() => toggleTc(t)}>{t}</Chip>)}
      <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
      <Chip pressed={f.fide} onClick={() => update({ fide: !f.fide })}>FIDE rated</Chip>
      <Chip pressed={f.regOpen} onClick={() => update({ regOpen: !f.regOpen })}>Registration open</Chip>
    </>
  );

  return (
    <div
      ref={ref}
      className={cn(
        "sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow] duration-[var(--dur-2)]",
        pinned ? "glass border-border shadow-e2" : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-2">
          <Link
            to="/"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            aria-label="Chess Atlas, back to top"
            tabIndex={pinned ? 0 : -1}
            aria-hidden={!pinned}
            className={cn(
              "flex shrink-0 items-center gap-2 overflow-hidden rounded-sm transition-[max-width,opacity,margin] duration-[var(--dur-2)]",
              pinned ? "mr-2 max-w-40 opacity-100" : "max-w-0 opacity-0"
            )}
          >
            <LogoMark />
            <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-h3 xl:inline">Chess Atlas</span>
          </Link>

          <form role="search" onSubmit={(e) => { e.preventDefault(); input.current?.blur(); }} className="relative min-w-0 flex-1 lg:min-w-[220px] lg:max-w-sm">
            <label htmlFor="search" className="sr-only">Search tournaments</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              ref={input}
              id="search"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search name, city or venue"
              autoComplete="off"
              enterKeyHint="search"
              className="h-9 w-full rounded-sm border border-border-strong bg-surface pl-9 pr-9 text-ui text-fg shadow-e1 outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {text ? (
              <button type="button" aria-label="Clear search" onClick={() => setText("")} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden h-5 -translate-y-1/2 items-center rounded-[4px] border border-border px-1.5 font-mono text-[11px] text-muted sm:flex" aria-hidden>/</kbd>
            )}
          </form>

          <div className="hidden min-w-0 items-center gap-1.5 lg:flex" role="group" aria-label="Quick filters">{quick}</div>

          <Button variant="secondary" onClick={onOpenFilters} className="shrink-0" aria-label={more ? `More filters, ${more} active` : "More filters"}>
            <SlidersHorizontal aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {more > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-fg">{more}</span>}
          </Button>

          <div className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
            <Segmented<ViewMode>
              label="View"
              value={f.view}
              onChange={(view) => update({ view })}
              options={[{ value: "cards", label: "List" }, { value: "calendar", label: "Calendar" }]}
            />
            <span className={cn("transition-opacity", pinned ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!pinned}>
              <ThemeToggle />
            </span>
          </div>
        </div>

        {/* compact rows: quick filters scroll sideways */}
        <div className="no-scrollbar -mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 sm:-mx-6 sm:px-6 lg:hidden" role="group" aria-label="Quick filters">
          {quick}
          <span className="mx-0.5 h-5 w-px shrink-0 bg-border sm:hidden" aria-hidden />
          <div className="flex shrink-0 gap-1.5 sm:hidden">
            <Chip pressed={f.view === "calendar"} onClick={() => update({ view: f.view === "calendar" ? "cards" : "calendar" })}>Calendar view</Chip>
          </div>
        </div>
      </div>
    </div>
  );
}
