import { useEffect, useRef, type ReactNode } from "react";
import { animate, AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE, useReveal, type TipState } from "./viz";
// ───────────────────────────── ticker ─────────────────────────────

/** Number that counts up when first seen and glides between values afterwards. */
export function Ticker({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const from = useRef(0);
  const fmt = useRef(format);
  useEffect(() => { fmt.current = format; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = fmt.current(value);
      from.current = value;
      return;
    }
    if (!inView) return;
    const c = animate(from.current, value, {
      duration: from.current === 0 ? 1.4 : 0.7,
      ease: EASE,
      onUpdate: (v) => { el.textContent = fmt.current(v); },
    });
    from.current = value;
    return () => c.stop();
  }, [value, inView, reduce]);
  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      <span aria-hidden>{reduce ? format(value) : format(0)}</span>
    </span>
  );
}

// ───────────────────────────── segmented control ─────────────────────────────

export function Segmented<T extends string>({
  value, onChange, options, label, size = "md", id,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: "sm" | "md";
  id: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border bg-surface-2 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative rounded-[8px] font-medium transition-colors",
              size === "sm" ? "h-8 px-3 text-small" : "h-9 px-3.5 text-ui",
              on ? "text-fg" : "text-muted hover:text-fg",
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[8px] border border-border bg-surface shadow-e1"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ───────────────────────────── card ─────────────────────────────

export function Card({
  id, eyebrow, title, note, action, children, className,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [ref, shown, reduce] = useReveal<HTMLElement>(0.08);
  return (
    <motion.section
      ref={ref}
      aria-labelledby={id}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={shown ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.6, ease: EASE }}
      className={cn("min-w-0 rounded-lg border border-border bg-surface p-5 shadow-e1 sm:p-6", className)}
    >
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-subtle">{eyebrow}</p>}
          <h2 id={id} className="text-h3 font-semibold tracking-h3">{title}</h2>
          {note && <p className="mt-1 max-w-[62ch] text-small text-muted">{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </motion.section>
  );
}

// ───────────────────────────── tooltip ─────────────────────────────

/**
 * Floating readout inside a `relative` chart container. Flips to the left of the pointer in the
 * right half so it never leaves the card.
 */
export function Tip({ tip, width }: { tip: TipState | null; width: number }) {
  const left = tip ? (tip.side ? tip.side === "left" : tip.x > width / 2) : false;
  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          key="tip"
          role="status"
          initial={{ opacity: 0, x: tip.x + (left ? -12 : 12), y: tip.y }}
          animate={{ opacity: 1, x: tip.x + (left ? -12 : 12), y: tip.y }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: "spring", stiffness: 700, damping: 45, opacity: { duration: 0.12 } }}
          className="pointer-events-none absolute left-0 top-0 z-20"
        >
          <div
            className="w-max max-w-[240px] rounded-md border border-border bg-surface px-3 py-2.5 text-small shadow-e2 transition-transform duration-150"
            style={{ transform: `translate(${left ? "-100%" : "0"}, -50%)` }}
          >
            {tip.content}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Tooltip body: heading, then rows of [key, value]. Values lead (strong), labels follow. */
export function TipBody({ title, rows, foot }: { title: ReactNode; rows?: { key: string; value: ReactNode; color?: string; line?: boolean }[]; foot?: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-label font-medium text-muted">{title}</p>
      {rows && (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2">
              {r.color && <span aria-hidden className={cn("shrink-0 rounded-full", r.line === false ? "h-2 w-2" : "h-[2px] w-3")} style={{ background: r.color }} />}
              <span className="font-semibold text-fg tabular-nums">{r.value}</span>
              <span className="truncate text-muted">{r.key}</span>
            </li>
          ))}
        </ul>
      )}
      {foot && <p className="mt-1.5 border-t border-border pt-1.5 text-label text-subtle">{foot}</p>}
    </div>
  );
}

/** Screen-reader table twin for a chart. */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
    </table>
    </div>
  );
}

/** Legend swatch (rect for bars/areas). */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]", className)} style={{ background: color }} />;
}
