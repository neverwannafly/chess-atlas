import { useEffect, useRef, useState } from "react";

/** True once the element has come within `margin` of the viewport (sticky: never flips back). */
export function useSeen<T extends Element>(margin = "400px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) setSeen(true); }, { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen] as const;
}
