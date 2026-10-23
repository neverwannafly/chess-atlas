import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE, seq, useReveal, useTip, useWidth } from "./viz";
import { SrTable, Tip, TipBody } from "./primitives";

export interface ColumnItem {
  label: string;
  value: number;
  /** Longer label for the tooltip / table. */
  title?: string;
  to?: string;
}

/**
 * Small column chart (≤ ~8 categories). Emphasis form: highlighted columns in the accent, the rest in
 * a pale step of the same ramp. The largest and the emphasised columns carry a value label.
 */
export function Columns({
  items, emphasis, height = 140, unit, caption, format = String, animKey,
}: {
  items: ColumnItem[];
  emphasis?: (i: number, item: ColumnItem) => boolean;
  height?: number;
  unit: [string, string];
  caption: string;
  format?: (n: number) => string;
  animKey?: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [revealRef, shown, reduce] = useReveal<HTMLDivElement>(0.4);
  const { tip, show, hide } = useTip();
  const navigate = useNavigate();
  const max = Math.max(1, ...items.map((d) => d.value));
  const peak = items.findIndex((d) => d.value === max);
  const total = items.reduce((a, d) => a + d.value, 0);

  return (
    <div ref={revealRef}>
      <div ref={wrapRef} className="relative" onPointerLeave={hide}>
        <div className="flex items-end gap-1.5 border-b border-border-strong" style={{ height }}>
          {items.map((d, i) => {
            const em = emphasis ? emphasis(i, d) : i === peak;
            const labelled = i === peak || em;
            const pct = d.value / max;
            const open = (e: { pointerType?: string }, el: HTMLElement) => {
              const r = el.getBoundingClientRect();
              const c = wrapRef.current!.getBoundingClientRect();
              show(e, {
                x: r.left - c.left + r.width / 2,
                y: Math.max(28, r.top - c.top + r.height - Math.max(8, pct * (height - 22)) - 4),
                content: (
                  <TipBody
                    title={d.title ?? d.label}
                    rows={[
                      { key: d.value === 1 ? unit[0] : unit[1], value: format(d.value), color: em ? "var(--accent)" : seq(0.3), line: false },
                      ...(total ? [{ key: "of total", value: `${Math.round((d.value / total) * 100)}%` }] : []),
                    ]}
                    foot={d.to ? "Select to browse" : undefined}
                  />
                ),
              });
            };
            return (
              <button
                key={d.label}
                type="button"
                tabIndex={d.to ? 0 : -1}
                aria-label={`${d.title ?? d.label}: ${format(d.value)} ${d.value === 1 ? unit[0] : unit[1]}`}
                onClick={() => d.to && navigate(d.to)}
                onPointerEnter={(e) => open(e, e.currentTarget)}
                onFocus={(e) => open({}, e.currentTarget)}
                onBlur={() => hide()}
                className={cn("group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-t-sm outline-offset-0", d.to ? "cursor-pointer" : "cursor-default")}
              >
                <span className={cn("mb-1 text-[11px] font-semibold tabular-nums transition-opacity", labelled ? "text-fg opacity-100" : "text-muted opacity-0 group-hover:opacity-100")}>
                  {d.value ? format(d.value) : ""}
                </span>
                <motion.span
                  key={animKey}
                  className="block w-full max-w-7 origin-bottom rounded-t-[4px] transition-[filter] group-hover:brightness-110"
                  style={{ height: d.value ? Math.max(3, pct * (height - 22)) : 1, background: d.value ? (em ? "var(--accent)" : seq(0.3)) : "var(--border)" }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={shown ? { scaleY: 1 } : undefined}
                  transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.05 }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {items.map((d) => (
            <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11px] leading-tight text-subtle">{d.label}</span>
          ))}
        </div>
        <Tip tip={tip} width={width} />
      </div>
      <SrTable caption={caption} head={["", unit[1]]} rows={items.map((d) => [d.title ?? d.label, format(d.value)])} />
    </div>
  );
}
