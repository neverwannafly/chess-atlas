import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

const defaultFormat = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * A number that rolls to its new value. The text node is written directly while animating, so React
 * doesn't re-render per frame (its own child stays the constant first value and never overwrites it).
 */
export function NumberTicker({ value, format = defaultFormat, className, duration = 0.9 }: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const [initial] = useState(() => format(reduce ? value : 0));
  const from = useRef<number>(reduce ? value : 0);
  const fmt = useRef(format);
  useLayoutEffect(() => { fmt.current = format; });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = from.current;
    from.current = value;
    if (reduce || start === value) {
      el.textContent = fmt.current(value);
      return;
    }
    const c = animate(start, value, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => { el.textContent = fmt.current(v); },
    });
    return () => c.stop();
  }, [value, reduce, duration]);

  return <span ref={ref} className={className}>{initial}</span>;
}
