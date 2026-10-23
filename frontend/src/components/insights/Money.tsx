import { Link } from "react-router-dom";
import { motion } from "motion/react";
import type { InsightBand, InsightEvent, InsightsScope } from "@/types/event";
import { formatDateRange, formatInr } from "@/lib/format";
import { EASE, formatColor, place, useReveal } from "./viz";
import { Card } from "./primitives";
import { Columns } from "./Columns";

const PRIZE_SHORT = ["<50K", "50K", "1L", "2L", "5L", "10L", "25L+"];
const FEE_SHORT = ["<500", "500", "1K", "1.5K", "2K", "3K", "5K+"];

const bandItems = (bands: InsightBand[], short: string[], toParam: (b: InsightBand) => string | undefined) =>
  bands.map((b, i) => ({ label: short[i] ?? b.label, title: b.label, value: b.count, to: toParam(b) }));

/** Index of the band holding the median value. */
const medianBand = (bands: InsightBand[], median: number | null) =>
  median == null ? -1 : bands.findIndex((b) => median >= b.min && (b.max == null || median < b.max));

export function MoneyDistributions({ scope, scopeKey }: { scope: InsightsScope; scopeKey: string }) {
  const pm = medianBand(scope.prizeBands, scope.medianPrizeInr);
  const fm = medianBand(scope.feeBands, scope.medianEntryFeeInr);
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card
        id="prize-dist"
        eyebrow="Money"
        title="How big the prize funds are"
        note={scope.medianPrizeInr ? `Half of all purses are above ${formatInr(scope.medianPrizeInr)} (highlighted band), from ${scope.prizeKnown} tournaments that state one.` : undefined}
      >
        <Columns
          animKey={scopeKey}
          items={bandItems(scope.prizeBands, PRIZE_SHORT, (b) => (b.min > 0 ? `/?prize=${b.min}` : undefined))}
          emphasis={(i) => i === pm}
          unit={["tournament", "tournaments"]}
          caption="Tournaments by total prize fund"
          height={160}
        />
      </Card>
      <Card
        id="fee-dist"
        eyebrow="Money"
        title="What it costs to enter"
        note={scope.medianEntryFeeInr ? `The typical adult entry is ${formatInr(scope.medianEntryFeeInr)}. Free entry for titled players and late fees are left out.` : undefined}
      >
        <Columns
          animKey={scopeKey}
          items={bandItems(scope.feeBands, FEE_SHORT, (b) => (b.max ? `/?fee=${b.max - 1}` : undefined))}
          emphasis={(i) => i === fm}
          unit={["tournament", "tournaments"]}
          caption="Tournaments by standard entry fee"
          height={160}
        />
      </Card>
    </div>
  );
}

function EventLine({ e, value, sub, frac, i, shown, reduce, scopeKey }: {
  e: InsightEvent; value: string; sub?: string; frac: number; i: number; shown: boolean; reduce: boolean; scopeKey: string;
}) {
  return (
    <li>
      <Link to={`/events/${encodeURIComponent(e.eventCode)}`} className="group -mx-2 grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-surface-2">
        <span className="pt-0.5 text-label text-subtle tabular-nums">{i + 1}</span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-ui font-medium group-hover:text-fg sm:line-clamp-1">{e.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-label text-muted">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: formatColor(e.timeControlType) }} />
            <span className="truncate">{formatDateRange(e.startDate, e.endDate)} · {place(e)}</span>
          </span>
          <span className="mt-2 block h-1 rounded-full bg-surface-2" aria-hidden>
            <motion.span
              key={scopeKey}
              className="block h-full rounded-full bg-accent"
              initial={reduce ? false : { width: 0 }}
              animate={shown ? { width: `${Math.max(2, frac * 100)}%` } : undefined}
              transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.05 }}
              style={{ opacity: i === 0 ? 1 : 0.5 }}
            />
          </span>
        </span>
        <span className="text-right">
          <span className="block text-ui font-semibold tabular-nums">{value}</span>
          {sub && <span className="block text-label text-subtle tabular-nums">{sub}</span>}
        </span>
      </Link>
    </li>
  );
}

export function MoneyLeaders({ scope, scopeKey }: { scope: InsightsScope; scopeKey: string }) {
  const [r1, s1, reduce] = useReveal<HTMLOListElement>(0.2);
  const [r2, s2] = useReveal<HTMLOListElement>(0.2);
  const maxP = Math.max(1, ...scope.topPrizes.map((e) => e.totalPrizeInr ?? 0));
  const maxV = Math.max(1, ...scope.bestValue.map((e) => e.ratio));
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card id="top-prizes" eyebrow="Leaders" title="Biggest prize funds" note="One entry per festival, even when it runs several sections.">
        <ol ref={r1}>
          {scope.topPrizes.map((e, i) => (
            <EventLine key={e.eventCode} e={e} i={i} value={formatInr(e.totalPrizeInr)} sub={e.entryFeeInr ? `${formatInr(e.entryFeeInr)} entry` : undefined}
              frac={(e.totalPrizeInr ?? 0) / maxP} shown={s1} reduce={reduce} scopeKey={scopeKey} />
          ))}
        </ol>
      </Card>
      <Card id="best-value" eyebrow="Leaders" title="Most prize money per rupee of entry" note="Prize fund divided by the standard adult entry fee. National championships dominate.">
        <ol ref={r2}>
          {scope.bestValue.map((e, i) => (
            <EventLine key={e.eventCode} e={e} i={i} value={`×${e.ratio.toLocaleString("en-IN")}`} sub={`${formatInr(e.totalPrizeInr)} / ${formatInr(e.entryFeeInr)}`}
              frac={e.ratio / maxV} shown={s2} reduce={reduce} scopeKey={scopeKey} />
          ))}
        </ol>
      </Card>
    </div>
  );
}
