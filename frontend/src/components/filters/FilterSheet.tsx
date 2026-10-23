import * as D from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Segmented } from "@/components/ui/Segmented";
import { activeCount, SORTS, type Filters, type SortKey } from "@/lib/filters";
import type { LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { Facets } from "./facets";
import { FormatControl } from "./FilterBar";
import { MoneyPanel, WhenPanel, WherePanel } from "./panels";

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border-b border-border px-5 py-5", className)}>
      <h2 className="mb-3 text-[15px] font-semibold tracking-h3 text-fg">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Bottom sheet holding every filter (the desktop bar's ⋯ opens it too, as a side panel). Changes
 * apply live; the footer button only closes, and says how many tournaments you're about to see.
 */
export function FilterSheet({ open, onOpenChange, f, update, clear, facets, near, setNear }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  f: Filters;
  update: (p: Partial<Filters>) => void;
  clear: () => void;
  facets: Facets;
  near: LatLng | null;
  setNear: (p: LatLng | null) => void;
}) {
  const drag = useDragControls();
  const reduce = useReducedMotion();
  const n = activeCount(f);
  const side = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  const hidden = reduce ? { opacity: 0 } : side ? { x: "105%" } : { y: "100%" };
  const shown = reduce ? { opacity: 1 } : side ? { x: 0 } : { y: 0 };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={cn(
                  "fixed z-[61] flex flex-col bg-surface text-fg shadow-e3 outline-none",
                  "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-[18px] border-t border-border",
                  "lg:inset-y-2 lg:left-auto lg:right-2 lg:max-h-none lg:w-[440px] lg:rounded-lg lg:border"
                )}
                initial={hidden}
                animate={shown}
                exit={hidden}
                transition={{ type: "spring", stiffness: 420, damping: 42, mass: 0.9 }}
                drag={side ? false : "y"}
                dragControls={drag}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onOpenChange(false); }}
              >
                <div className="touch-none cursor-grab pb-1 pt-2.5 active:cursor-grabbing lg:hidden" onPointerDown={(e) => drag.start(e)}>
                  <span className="mx-auto block h-1 w-10 rounded-full bg-border-strong" aria-hidden />
                </div>
                <header className="flex items-center justify-between border-b border-border px-5 pb-3 pt-1 lg:pt-4" onPointerDown={(e) => { if (window.innerWidth < 1024) drag.start(e); }}>
                  <D.Title className="text-[17px] font-semibold tracking-h3">
                    Filters{n > 0 && <span className="ml-2 text-ui font-normal text-muted">{n} active</span>}
                  </D.Title>
                  <D.Close className="-mr-2 flex h-10 w-10 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close filters">
                    <X className="h-5 w-5" aria-hidden />
                  </D.Close>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <Section title="Sort by">
                    <Segmented<SortKey> label="Sort by" value={f.sort} onChange={(v) => update({ sort: v })} options={SORTS.map((s) => ({ value: s.value, label: s.label.replace("Biggest prize", "Prize").replace("Cheapest entry", "Entry") }))} stretch size="lg" />
                  </Section>
                  <Section title="Format">
                    <FormatControl f={f} update={update} facets={facets} stretch size="lg" />
                  </Section>
                  <Section title="Options">
                    <div className="flex flex-wrap gap-2">
                      <Chip size="lg" pressed={f.fide} count={facets.fide} onClick={() => update({ fide: !f.fide })}>FIDE rated</Chip>
                      <Chip size="lg" pressed={f.open} count={facets.open} onClick={() => update({ open: !f.open })}>Registration open</Chip>
                      <Chip size="lg" pressed={f.past} onClick={() => update({ past: !f.past })}>Include finished</Chip>
                    </div>
                  </Section>
                  <Section title="When"><WhenPanel f={f} update={update} facets={facets} big /></Section>
                  <Section title="Money"><MoneyPanel f={f} update={update} facets={facets} /></Section>
                  <Section title="Where" className="border-b-0"><WherePanel f={f} update={update} facets={facets} near={near} setNear={setNear} big /></Section>
                </div>

                <footer className="flex items-center gap-3 border-t border-border bg-surface px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
                  <button type="button" onClick={clear} disabled={!n && !f.q} className="h-12 rounded-sm px-3 text-ui font-medium text-muted hover:text-fg disabled:opacity-40">
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="h-12 flex-1 rounded-md bg-accent text-ui font-semibold text-accent-fg shadow-e1 transition-[filter] hover:brightness-110 disabled:opacity-60"
                  >
                    {facets.total === 0 ? "No tournaments match" : `Show ${facets.total.toLocaleString("en-IN")} ${facets.total === 1 ? "tournament" : "tournaments"}`}
                  </button>
                </footer>
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
