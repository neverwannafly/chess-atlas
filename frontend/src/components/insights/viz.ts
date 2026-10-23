import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useInView, useReducedMotion } from "motion/react";
import type { InsightFormat } from "@/types/event";
import { cn } from "@/lib/utils";

// ───────────────────────────── palette ─────────────────────────────
// Format identity hues, validated with the dataviz palette checker (lightness band, chroma floor,
// adjacent CVD ΔE ≥ 8, normal-vision ΔE ≥ 15, ≥ 3:1 contrast) against our light (#ffffff) and
// dark (#121519) surfaces. Rapid is the brand teal stepped into the chart band. Declared once here
// as CSS custom properties on the page root; marks reference them by role.
export const VIZ_VARS = cn(
  "[--viz-classical:#2a78d6] [--viz-rapid:#0f9580] [--viz-blitz:#eb6834] [--viz-mixed:#6250d6] [--viz-unknown:var(--border-strong)]",
  "dark:[--viz-classical:#3987e5] dark:[--viz-rapid:#24a88e] dark:[--viz-blitz:#d95926] dark:[--viz-mixed:#9085e9]",
);

export const FORMATS: InsightFormat[] = ["Classical", "Rapid", "Blitz", "Mixed", "Unknown"];
export const formatColor = (f: InsightFormat | null) => `var(--viz-${(f ?? "Unknown").toLowerCase()})`;
export const formatName = (f: InsightFormat) => (f === "Unknown" ? "Not stated" : f);

/** Sequential teal ramp: t in [0,1] → accent mixed into the quiet surface. */
export const seq = (t: number) =>
  t <= 0 ? "var(--surface-2)" : `color-mix(in oklch, var(--accent) ${Math.round(16 + Math.min(1, t) * 84)}%, var(--surface-2))`;

export const EASE = [0.2, 0.8, 0.2, 1] as const;

// ───────────────────────────── layout hooks ─────────────────────────────

/** Width of an element, tracked with ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Once-only in-view flag; true immediately under reduced motion. */
export function useReveal<T extends Element>(amount = 0.25) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduce = useReducedMotion();
  return [ref, inView || !!reduce, !!reduce] as const;
}

/** Nice axis ticks covering [0, max]. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export const compact = (n: number) =>
  n >= 1e7 ? `${+(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.round(n));

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
  /** Which side of x the box opens on; default: away from the nearer edge. */
  side?: "left" | "right";
}

/** Pointer handlers that keep a tooltip open on touch (tap shows, tap elsewhere hides). */
export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const touch = useRef(false);
  useEffect(() => {
    if (!tip || !touch.current) return;
    const off = () => setTip(null);
    const t = setTimeout(() => window.addEventListener("pointerdown", off, { once: true }), 0);
    return () => { clearTimeout(t); window.removeEventListener("pointerdown", off); };
  }, [tip]);
  return {
    tip,
    show: (e: { pointerType?: string }, next: TipState) => {
      touch.current = e.pointerType === "touch" || e.pointerType === "pen";
      setTip(next);
    },
    hide: (e?: { pointerType?: string }) => {
      if (e && (e.pointerType === "touch" || e.pointerType === "pen")) return;
      setTip(null);
    },
    clear: () => setTip(null),
  };
}


/** "Pune, Maharashtra"; a city-state ("Delhi, Delhi") is named once. */
export const place = (e: { city: string | null; state: string | null }) =>
  (e.city && e.city === e.state ? [e.city] : [e.city, e.state].filter(Boolean)).join(", ") || "Location TBA";
