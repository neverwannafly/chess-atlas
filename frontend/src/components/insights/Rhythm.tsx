import { motion } from "motion/react";
import type { InsightsScope } from "@/types/event";
import { pluralize } from "@/lib/format";
import { EASE, useReveal } from "./viz";
import { Card, SrTable, Ticker } from "./primitives";
import { Columns } from "./Columns";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEAD_SHORT = ["0", "1d", "2d", "3d", "4–7d", "1–2w", "2w+"];

export function Rhythm({ scope, scopeKey }: { scope: InsightsScope; scopeKey: string }) {
  const wk = scope.weekdays;
  const total = Math.max(1, wk.reduce((a, b) => a + b, 0));
  const weekend = Math.round(((wk[5] + wk[6]) / total) * 100);
  const oneDay = scope.durations.find((d) => d.label === "1")?.count ?? 0;
  const durTotal = Math.max(1, scope.durations.reduce((a, d) => a + d.count, 0));
  const leadTotal = scope.leadBands.reduce((a, b) => a + b.count, 0);

  return (
    <Card id="rhythm" eyebrow="When" title="The weekly rhythm" note="When tournaments start, how long they run, and how early registration closes.">
      <div className="grid gap-8 md:grid-cols-3 md:gap-6">
        <div className="min-w-0">
          <p className="text-small text-muted"><span className="text-h3 font-semibold text-fg">{weekend}%</span> start on a weekend</p>
          <div className="mt-4">
            <Columns animKey={scopeKey} items={wk.map((v, i) => ({ label: WEEKDAYS[i], title: `Starting on ${WEEKDAYS_LONG[i]}`, value: v }))} emphasis={(i) => i >= 5} unit={["tournament", "tournaments"]} caption="Start day of week" height={120} />
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-small text-muted"><span className="text-h3 font-semibold text-fg">{Math.round((oneDay / durTotal) * 100)}%</span> are one-day events</p>
          <div className="mt-4">
            <Columns animKey={scopeKey} items={scope.durations.map((d) => ({ label: d.label, title: d.label === "7+" ? "7 days or longer" : pluralize(+d.label, "day"), value: d.count }))} emphasis={(i) => i === 0} unit={["tournament", "tournaments"]} caption="Length in days" height={120} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-subtle">days</p>
        </div>
        <div className="min-w-0">
          <p className="text-small text-muted">
            Registration closes a median <span className="text-h3 font-semibold text-fg">{scope.medianLeadDays ?? "—"}</span> {scope.medianLeadDays === 1 ? "day" : "days"} before
          </p>
          <div className="mt-4">
            <Columns animKey={scopeKey} items={scope.leadBands.map((b, i) => ({ label: LEAD_SHORT[i] ?? b.label, title: `${b.label} before the start`, value: b.count }))} unit={["tournament", "tournaments"]} caption="Registration deadline, days before start" height={120} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-subtle">{leadTotal ? `from ${leadTotal} brochures with a deadline` : "before the start"}</p>
        </div>
      </div>
    </Card>
  );
}

export function CategoryPrizes({ scope, scopeKey }: { scope: InsightsScope; scopeKey: string }) {
  const [ref, shown, reduce] = useReveal<HTMLDivElement>(0.3);
  return (
    <Card
      id="categories"
      eyebrow="Who can win"
      title="Prizes beyond the top places"
      note={`Share of the ${scope.withDetails} tournaments with brochure details that set aside prizes for each group.`}
    >
      <div ref={ref} className="grid gap-8 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-10">
        <div>
          <p className="text-[56px] font-semibold leading-none tracking-display [font-variant-numeric:proportional-nums]">
            {scope.avgPrizesPerEvent != null ? <Ticker value={scope.avgPrizesPerEvent} format={(n) => String(Math.round(n))} /> : "—"}
          </p>
          <p className="mt-3 max-w-[22ch] text-small text-muted">prizes on the average tournament’s list, places and categories together</p>
        </div>
        <ul className="space-y-3.5">
          {scope.categoryPrizes.map((c, i) => (
            <li key={c.key} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_3rem] items-center gap-3 text-ui max-sm:grid-cols-[minmax(0,1fr)_3rem] max-sm:gap-y-1.5">
              <span className="truncate">{c.label}</span>
              <span className="relative h-2 rounded-full bg-accent-soft max-sm:order-3 max-sm:col-span-2" aria-hidden>
                <motion.span
                  key={scopeKey}
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  initial={reduce ? false : { width: 0 }}
                  animate={shown ? { width: `${c.share * 100}%` } : undefined}
                  transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.06 }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">{Math.round(c.share * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
      <SrTable caption="Category prizes" head={["Group", "Tournaments", "Share"]} rows={scope.categoryPrizes.map((c) => [c.label, c.events, `${Math.round(c.share * 100)}%`])} />
    </Card>
  );
}
