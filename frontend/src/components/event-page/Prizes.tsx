import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Trophy } from "lucide-react";
import type { BrochureExtraction } from "@/types/event";
import { EASE, Ticker } from "@/components/event-page/motion";
import { categoryPrizeSections, lakhs } from "@/lib/eventDetail";
import { formatInrFull, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Places = BrochureExtraction["prizes"]["places"];

const PODIUM = ["Champion", "Runner-up", "Third place"];

function Podium({ places }: { places: Places }) {
  const reduce = useReducedMotion();
  const top = places.slice(0, 3);
  const max = Math.max(1, ...top.map((p) => p.amountInr ?? 0));
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {top.map((p, i) => {
        const pct = ((p.amountInr ?? 0) / max) * 100;
        return (
          <motion.li
            key={i}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -10% 0px" }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.08 * i }}
            className={cn(
              "relative min-w-0 overflow-hidden rounded-md border p-4 sm:p-5",
              i === 0 && "max-sm:col-span-2",
              i === 0 ? "border-accent/40 bg-accent-soft/60" : "border-border bg-surface"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("font-mono text-small", i === 0 ? "text-accent" : "text-muted")}>{p.label}</span>
              <span className="truncate text-label text-muted max-sm:hidden">{PODIUM[i]}</span>
            </div>
            <p className={cn("mt-3 font-semibold leading-none tracking-h2", i === 0 ? "text-[30px]" : "text-[20px] sm:text-[24px]")}>
              {p.amountInr != null ? <Ticker value={p.amountInr} duration={1 + 0.15 * (2 - i)} /> : <span className="text-muted">Trophy</span>}
            </p>
            <p className="mt-2 h-5 truncate text-small text-muted">
              {p.extra ? <span className="inline-flex items-center gap-1"><Trophy className="h-3.5 w-3.5" aria-hidden />+ {p.extra}</span> : p.amountInr && lakhs(p.amountInr) ? lakhs(p.amountInr) : ""}
            </p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <motion.div
                className={cn("h-full origin-left rounded-full", i === 0 ? "bg-accent" : "bg-fg/40")}
                style={{ width: `${pct}%` }}
                initial={reduce ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.15 + 0.08 * i }}
              />
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Ladder({ places, start }: { places: Places; start: number }) {
  const reduce = useReducedMotion();
  const [all, setAll] = useState(false);
  const LIMIT = 12;
  const shown = all ? places : places.slice(0, LIMIT);
  const max = Math.max(1, ...places.map((p) => p.amountInr ?? 0));
  return (
    <div className="mt-3">
      <ol className="grid gap-x-8 sm:grid-cols-2">
        <AnimatePresence initial={false}>
          {shown.map((p, i) => (
            <motion.li
              key={start + i}
              layout={reduce ? false : "position"}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: EASE, delay: i < LIMIT ? 0.025 * i : 0.015 * (i - LIMIT) }}
              className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2.5 text-ui"
            >
              <span className="font-mono text-small text-muted">{p.label}</span>
              <span className="relative h-px bg-transparent" aria-hidden>
                <span className="absolute inset-y-0 left-0 bg-border-strong" style={{ width: `${Math.max(6, ((p.amountInr ?? 0) / max) * 100)}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums">
                {p.amountInr != null ? formatInrFull(p.amountInr) : <span className="text-muted">{p.extra ?? "—"}</span>}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {places.length > LIMIT && (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-3 inline-flex h-9 items-center rounded-sm text-small font-medium text-accent hover:underline">
          {all ? "Show fewer places" : `Show all ${places.length + start} places`}
        </button>
      )}
    </div>
  );
}

function CategoryGrid({ list }: { list: BrochureExtraction["prizes"]["categoryPrizes"] }) {
  const reduce = useReducedMotion();
  const sections = categoryPrizeSections(list);
  const [tab, setTab] = useState(0);
  const [all, setAll] = useState(false);
  const cur = sections[Math.min(tab, sections.length - 1)];
  const LIMIT = 6;
  const groups = all ? cur.groups : cur.groups.slice(0, LIMIT);
  const named = sections.length > 1;
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-ui font-semibold">Category prizes</h3>
        {named && (
          <div role="tablist" aria-label="Event" className="inline-flex rounded-sm border border-border bg-surface-2 p-0.5">
            {sections.map((s, i) => (
              <button
                key={s.name || "main"}
                role="tab"
                type="button"
                aria-selected={i === tab}
                onClick={() => { setTab(i); setAll(false); }}
                className={cn("relative h-8 rounded-[5px] px-3 text-small font-medium transition-colors", i === tab ? "text-fg" : "text-muted hover:text-fg")}
              >
                {i === tab && <motion.span layoutId="cat-tab" className="absolute inset-0 rounded-[5px] bg-surface shadow-e1" transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} />}
                <span className="relative">{s.name || "Main event"} <span className="text-subtle">{s.groups.length}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <motion.ul
        key={tab}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="grid gap-2 sm:grid-cols-2"
      >
        {groups.map((g, gi) => (
          <motion.li
            key={g.category}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: EASE, delay: Math.min(gi, 8) * 0.03 }}
            className="rounded-md border border-border bg-surface p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="min-w-0 truncate text-ui font-medium" title={g.category}>{g.category}</h4>
              {g.total > 0 && <span className="shrink-0 text-small font-medium tabular-nums text-muted">{formatMoney(g.total)}</span>}
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {g.items.map((it, i) => (
                <li key={i} className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-surface-2 px-2 text-small">
                  <span className="text-muted">{it.label}</span>
                  <span className="font-medium tabular-nums">{it.amountInr != null ? formatMoney(it.amountInr) : "Trophy"}</span>
                </li>
              ))}
            </ul>
          </motion.li>
        ))}
      </motion.ul>
      {cur.groups.length > LIMIT && (
        <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-3 inline-flex h-9 items-center rounded-sm text-small font-medium text-accent hover:underline">
          {all ? "Show fewer categories" : `Show all ${cur.groups.length} categories`}
        </button>
      )}
    </div>
  );
}

export function PrizesBody({ prizes }: { prizes: BrochureExtraction["prizes"] }) {
  const total = prizes.totalInr;
  const places = prizes.places;
  return (
    <div className="space-y-10">
      {total != null && total > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="text-[40px] font-semibold leading-none tracking-h1 sm:text-[48px]"><Ticker value={total} duration={1.4} /></p>
            <p className="mt-2 text-ui text-muted">Total prize fund{lakhs(total) ? `, ${lakhs(total)}` : ""}</p>
          </div>
          <dl className="flex gap-8 sm:text-right">
            {places.length > 0 && <div><dt className="text-label uppercase tracking-[0.08em] text-muted">Places</dt><dd className="mt-1 text-[20px] font-semibold tabular-nums">{places.length}</dd></div>}
            {prizes.categoryPrizes.length > 0 && <div><dt className="text-label uppercase tracking-[0.08em] text-muted">Category prizes</dt><dd className="mt-1 text-[20px] font-semibold tabular-nums">{prizes.categoryPrizes.length}</dd></div>}
          </dl>
        </div>
      )}
      {places.length > 0 && (
        <div>
          <h3 className="mb-4 text-ui font-semibold">Main standings</h3>
          <Podium places={places} />
          {places.length > 3 && <Ladder places={places.slice(3)} start={3} />}
        </div>
      )}
      {prizes.categoryPrizes.length > 0 && <CategoryGrid list={prizes.categoryPrizes} />}
      {prizes.notes && (
        <details className="group rounded-md border border-border bg-surface-2/50 px-4 py-3 text-small">
          <summary className="flex h-6 items-center justify-between font-medium text-fg marker:content-none">
            Prize rules and tie-breaks
            <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
          </summary>
          <p className="mt-2 max-w-[72ch] leading-relaxed text-muted">{prizes.notes}</p>
        </details>
      )}
    </div>
  );
}
