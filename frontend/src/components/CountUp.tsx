import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/** Counts from 0 to `value` the first time it scrolls into view. Static under reduced motion. */
export function CountUp({ value, format = (n) => String(Math.round(n)), className, title }: { value: number; format?: (n: number) => string; className?: string; title?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return setN(value);
    if (!inView) return;
    const c = animate(0, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setN });
    return () => c.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className={className} title={title}>{format(inView || reduce ? n : 0)}</span>;
}
