import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

export const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Fades and lifts its children once, the first time they scroll into view. */
export function Reveal({ children, className, delay = 0, y = 14, as = "div" }: { children: React.ReactNode; className?: string; delay?: number; y?: number; as?: "div" | "section" | "li" }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  if (reduce) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

const group = new Intl.NumberFormat("en-IN");

/** Counts up to `value` (Indian digit grouping) when it first scrolls into view. */
export function Ticker({ value, prefix = "₹", duration = 1.1, className }: { value: number; prefix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -5% 0px" });
  const reduce = useReducedMotion();
  const final = `${prefix}${group.format(value)}`;
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const c = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => { el.textContent = `${prefix}${group.format(Math.round(v))}`; },
    });
    return () => c.stop();
  }, [inView, reduce, value, prefix, duration]);
  return (
    <span className={className}>
      <span className="sr-only">{final}</span>
      {/* Reserve the final width so the layout doesn't jitter while counting. */}
      <span aria-hidden className="inline-grid">
        <span className="invisible col-start-1 row-start-1">{final}</span>
        <span ref={ref} className="col-start-1 row-start-1">{reduce ? final : `${prefix}0`}</span>
      </span>
    </span>
  );
}
