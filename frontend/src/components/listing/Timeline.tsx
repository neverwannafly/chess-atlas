import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { EventSummary } from "@/types/event";
import { EventRow, ROW_COLS } from "@/components/event/EventRow";
import { formatInr, formatInrFull, todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import { groupByTime, type TimeGroup } from "./groups";

const STEP = 60;
/** Rows rendered per result set, kept across navigations so Back can restore deep scroll positions. */
const limits = new Map<string, number>();

function ColumnLabels() {
  return (
    <div className={cn("hidden text-label font-medium uppercase tracking-[0.06em] text-subtle lg:contents")} aria-hidden>
      <span>Format</span>
      <span>FIDE</span>
      <span className="text-right">Prize fund</span>
      <span className="text-right">Entry from</span>
      <span>Registration</span>
      <span />
    </div>
  );
}

function GroupHeader({ g, flatTitle }: { g?: TimeGroup; flatTitle?: string }) {
  const prize = g ? g.items.reduce((a, e) => a + (e.totalPrizeInr ?? 0), 0) : 0;
  return (
    <div className="sticky z-20 -mx-4 bg-bg/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" style={{ top: "var(--chrome-h)" }}>
      <div className={cn("flex h-11 items-center border-b border-border px-1 lg:px-3", ROW_COLS, "lg:items-center")}>
        <h2 className="flex min-w-0 items-baseline gap-2 lg:col-span-2" id={g ? `g-${g.key}` : undefined}>
          <span className="flex items-center gap-2 text-ui font-semibold tracking-h3 text-fg">
            {g?.live && <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
            {g?.title ?? flatTitle}
          </span>
          {g && <span className="text-small text-muted tabular-nums">{g.items.length}</span>}
          {g?.hint && <span className="hidden truncate text-small text-subtle sm:inline">{g.hint}</span>}
          {prize > 0 && <span className="ml-auto truncate text-small text-muted lg:hidden" title={formatInrFull(prize)}>{formatInr(prize)} in prizes</span>}
        </h2>
        <ColumnLabels />
      </div>
    </div>
  );
}

function Rows({ items, offset, reduce }: { items: EventSummary[]; offset: number; reduce: boolean }) {
  return (
    <ul className="divide-y divide-border/70">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((e, i) => (
          <motion.li
            key={e.eventCode}
            layout={reduce ? false : "position"}
            initial={{ opacity: 0, y: reduce ? 0 : 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -24px 0px" }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1], delay: reduce ? 0 : ((offset + i) % 10) * 0.03, layout: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } }}
          >
            <EventRow e={e} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** The almanac: sticky time groups (or one flat list for non-chronological sorts) of aligned rows. */
export function Timeline({ events, grouped, resultKey, flatTitle }: { events: EventSummary[]; grouped: boolean; resultKey: string; flatTitle: string }) {
  const reduce = !!useReducedMotion();
  const [limit, setLimit] = useState(() => limits.get(resultKey) ?? STEP);
  const [seenKey, setSeenKey] = useState(resultKey);
  if (seenKey !== resultKey) {
    setSeenKey(resultKey);
    setLimit(limits.get(resultKey) ?? STEP);
  }
  useEffect(() => { limits.set(resultKey, limit); }, [resultKey, limit]);

  const shown = events.slice(0, limit);
  const groups = grouped ? groupByTime(shown, todayIST()) : null;
  const more = events.length > limit;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more) return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) setLimit((l) => l + STEP); }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more]);

  let offset = 0;
  return (
    <div>
      {groups ? (
        groups.map((g) => {
          const o = offset;
          offset += g.items.length;
          return (
            <section key={g.key} aria-labelledby={`g-${g.key}`} className="mb-6">
              <GroupHeader g={g} />
              <Rows items={g.items} offset={o} reduce={reduce} />
            </section>
          );
        })
      ) : (
        <section aria-label={flatTitle}>
          <GroupHeader flatTitle={flatTitle} />
          <Rows items={shown} offset={0} reduce={reduce} />
        </section>
      )}
      <div ref={sentinel} className="flex justify-center py-8">
        {more ? (
          <button type="button" onClick={() => setLimit((l) => l + STEP)} className="h-9 rounded-sm border border-border-strong bg-surface px-4 text-ui font-medium text-fg shadow-e1 hover:bg-surface-2">
            Show more
          </button>
        ) : (
          events.length > 8 && <p className="flex items-center gap-3 text-small text-subtle"><span className="h-px w-8 bg-border" />End of the list<span className="h-px w-8 bg-border" /></p>
        )}
      </div>
    </div>
  );
}
