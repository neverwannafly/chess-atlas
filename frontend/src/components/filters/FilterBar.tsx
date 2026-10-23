import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Chip, Tag } from "@/components/ui/Chip";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/Segmented";
import { activeChips, activeCount, FORMATS, moneyLabel, SORTS, whenLabel, whereLabel, type Filters, type Format, type SortKey } from "@/lib/filters";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { Facets } from "./facets";
import { MoneyPanel, WhenPanel, WherePanel } from "./panels";

type Update = (p: Partial<Filters>) => void;

export function FormatControl({ f, update, facets, stretch, size }: { f: Filters; update: Update; facets: Facets; stretch?: boolean; size?: "md" | "lg" }) {
  return (
    <Segmented<"all" | Format>
      label="Format"
      value={f.format ?? "all"}
      onChange={(v) => update({ format: v === "all" ? null : v })}
      options={[{ value: "all", label: "All" }, ...FORMATS.map((t) => ({ value: t, label: t, count: facets.format[t] }))]}
      stretch={stretch}
      size={size}
    />
  );
}

export function SortMenu({ f, update }: { f: Filters; update: Update }) {
  const current = SORTS.find((s) => s.value === f.sort)!;
  return (
    <Popover label="Sort" value={current.label} active={false} showValue align="end" width="w-52">
      {(close) => (
        <div role="listbox" aria-label="Sort by" className="-m-2">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="option"
              aria-selected={s.value === f.sort}
              onClick={() => { update({ sort: s.value as SortKey }); close(); }}
              className="flex h-9 w-full items-center justify-between rounded-sm px-2.5 text-ui text-fg hover:bg-surface-2"
            >
              {s.label}
              {s.value === f.sort && <Check className="h-4 w-4 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

/** Desktop filter bar: sticks under the header, everything applies instantly. */
export function FilterBar({ f, update, facets, near, setNear, onMore }: {
  f: Filters;
  update: Update;
  facets: Facets;
  near: LatLng | null;
  setNear: (p: LatLng | null) => void;
  onMore: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setStuck(el.getBoundingClientRect().top <= 57);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const w = whenLabel(f), wh = whereLabel(f), m = moneyLabel(f);
  return (
    <div
      ref={ref}
      className={cn(
        "sticky top-[var(--header-h)] z-30 hidden border-b transition-[background-color,border-color,box-shadow] duration-[var(--dur-2)] lg:block",
        stuck ? "glass-bg border-border shadow-e1" : "border-transparent"
      )}
    >
      <div className="mx-auto flex h-[var(--bar-h)] max-w-[1200px] items-center gap-2 px-8">
        <FormatControl f={f} update={update} facets={facets} />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Popover label="When" value={w} active={!!w} width="w-[360px]">
          <WhenPanel f={f} update={update} facets={facets} />
        </Popover>
        <Popover label="Where" value={wh} active={!!wh} width="w-[340px]">
          <WherePanel f={f} update={update} facets={facets} near={near} setNear={setNear} />
        </Popover>
        <Popover label="Money" value={m} active={!!m} width="w-[360px]">
          <MoneyPanel f={f} update={update} facets={facets} />
        </Popover>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Chip pressed={f.fide} count={facets.fide} onClick={() => update({ fide: !f.fide })}>FIDE rated</Chip>
        <Chip pressed={f.open} count={facets.open} onClick={() => update({ open: !f.open })}>Registration open</Chip>
        <div className="ml-auto flex items-center gap-3">
          <p className="whitespace-nowrap text-ui text-muted" aria-live="polite">
            <NumberTicker value={facets.total} duration={0.5} className="font-semibold text-fg tabular-nums" /> {facets.total === 1 ? "tournament" : "tournaments"}
          </p>
          <SortMenu f={f} update={update} />
          <button type="button" onClick={onMore} className="flex h-9 w-9 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg" aria-label="All filters">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mobile: a sideways strip of the most used filters, plus the sheet button. */
export function QuickStrip({ f, update, facets, onMore }: { f: Filters; update: Update; facets: Facets; onMore: () => void }) {
  const n = activeCount(f);
  return (
    <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden">
      <button
        type="button"
        onClick={onMore}
        className={cn("flex h-11 shrink-0 items-center gap-2 rounded-sm border px-3.5 text-ui font-medium", n ? "border-accent/40 bg-accent-soft text-fg" : "border-border-strong/70 bg-surface text-fg")}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filters
        {n > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-fg">{n}</span>}
      </button>
      <FormatControl f={f} update={update} facets={facets} size="lg" />
      <Chip size="lg" pressed={f.fide} count={facets.fide} onClick={() => update({ fide: !f.fide })}>FIDE</Chip>
      <Chip size="lg" pressed={f.open} count={facets.open} onClick={() => update({ open: !f.open })}>Open</Chip>
    </div>
  );
}

export function ActiveFilters({ f, update, clear }: { f: Filters; update: Update; clear: () => void }) {
  const chips = activeChips(f);
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap items-center gap-1.5 pb-3 pt-1 lg:pt-3" aria-label="Active filters">
            <AnimatePresence initial={false} mode="popLayout">
              {chips.map((c) => (
                <motion.span key={c.key} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.16 }}>
                  <Tag label={c.label} onRemove={() => update(c.patch)}>{c.label}</Tag>
                </motion.span>
              ))}
            </AnimatePresence>
            <button type="button" onClick={clear} className="ml-1 h-7 rounded-sm px-2 text-small font-medium text-muted hover:bg-surface-2 hover:text-fg">Clear all</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

