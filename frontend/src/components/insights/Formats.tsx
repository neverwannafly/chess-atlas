import { Link } from "react-router-dom";
import { motion } from "motion/react";
import type { InsightsScope } from "@/types/event";
import { formatInr } from "@/lib/format";
import { EASE, formatColor, formatName, useReveal } from "./viz";
import { Card, SrTable, Swatch } from "./primitives";

export function Formats({ scope, scopeKey }: { scope: InsightsScope; scopeKey: string }) {
  const [ref, shown, reduce] = useReveal<HTMLDivElement>(0.3);
  const total = Math.max(1, scope.formats.reduce((a, f) => a + f.count, 0));
  const known = scope.formats.filter((f) => f.format !== "Unknown");
  const lead = [...known].sort((a, b) => b.count - a.count)[0];
  const tcMax = Math.max(1, ...scope.timeControls.map((t) => t.count));
  const top = scope.timeControls[0];

  return (
    <Card
      id="formats"
      eyebrow="How"
      title="Formats and time controls"
      note={lead ? `${lead.format} leads with ${Math.round((lead.count / total) * 100)}% of tournaments.${top ? ` ${top.label} is the single most common clock.` : ""}` : undefined}
    >
      <div ref={ref} className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
        {/* 100% stacked bar */}
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Share of tournaments by format">
          {scope.formats.map((f, i) => (
            <motion.span
              key={`${scopeKey}-${f.format}`}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ background: formatColor(f.format) }}
              initial={reduce ? false : { flexGrow: 0.0001 }}
              animate={shown ? { flexGrow: f.count } : undefined}
              transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.06 }}
            />
          ))}
        </div>

        {/* per-format readout */}
        <div className="mt-5 overflow-hidden rounded-md border border-border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-2 border-b border-border bg-surface-2 px-3 py-2 text-label text-subtle sm:px-4">
            <span>Format</span>
            <span className="text-right">Share</span>
            <span className="text-right">Rounds</span>
            <span className="text-right"><span className="sm:hidden">Purse</span><span className="hidden sm:inline">Median purse</span></span>
          </div>
          <ul>
            {scope.formats.map((f) => {
              const row = (
                <>
                  <span className="flex min-w-0 items-center gap-2">
                    <Swatch color={formatColor(f.format)} />
                    <span className="font-medium leading-tight">{formatName(f.format)}</span>
                    <span className="hidden text-subtle tabular-nums sm:inline">{f.count}</span>
                  </span>
                  <span className="text-right tabular-nums">{Math.round((f.count / total) * 100)}%</span>
                  <span className="text-right tabular-nums text-muted">{f.medianRounds ?? "—"}</span>
                  <span className="text-right tabular-nums text-muted">{f.medianPrizeInr ? formatInr(f.medianPrizeInr) : "—"}</span>
                </>
              );
              const cls = "grid min-h-11 grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] items-center gap-2 border-b border-border px-3 text-ui last:border-b-0 sm:px-4";
              return (
                <li key={f.format}>
                  {f.format === "Unknown" || f.format === "Mixed" ? (
                    <div className={cls}>{row}</div>
                  ) : (
                    <Link to={`/?tc=${f.format}`} className={`${cls} transition-colors hover:bg-surface-2`}>{row}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        </div>
        {/* time controls */}
        {scope.timeControls.length > 0 && (
          <div className="min-w-0">
            <h3 className="mb-4 text-small font-medium text-muted">Most common clocks <span className="text-subtle">· minutes + seconds per move</span></h3>
            <ol className="space-y-2">
              {scope.timeControls.slice(0, 8).map((t, i) => (
                <li key={t.label} className="grid min-h-8 grid-cols-[3.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-ui">
                  <span className="font-mono text-small">{t.label}</span>
                  <span className="relative h-3" aria-hidden>
                    <motion.span
                      key={scopeKey}
                      className="absolute inset-y-0 left-0 rounded-r-[4px]"
                      style={{ background: formatColor(t.format) }}
                      initial={reduce ? false : { width: 0 }}
                      animate={shown ? { width: `${Math.max(2, (t.count / tcMax) * 100)}%` } : undefined}
                      transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.3 + i * 0.05 }}
                    />
                  </span>
                  <span className="text-right font-medium tabular-nums">{t.count}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-label text-subtle">Bars take their format’s colour.</p>
          </div>
        )}
      </div>
      <SrTable caption="Tournaments by format" head={["Format", "Tournaments", "Median rounds", "Median purse"]} rows={scope.formats.map((f) => [formatName(f.format), f.count, f.medianRounds ?? "—", f.medianPrizeInr ? formatInr(f.medianPrizeInr) : "—"])} />
    </Card>
  );
}
