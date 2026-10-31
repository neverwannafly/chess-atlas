import { useEffect, type RefObject } from "react";

/** Pointer effects only where there is a precise hovering pointer and the user allows motion. */
const QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";
/** How far a magnetic element follows the pointer (fraction of the offset), and the cap in px. */
const PULL = 0.2;
const MAX = 3;

/** Glow radius as a fraction of the map width (about 105px for the 440px map at 1440 wide). */
const RADIUS = 0.24;
const MAX_SCALE = 0.6;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

/**
 * Hero cursor effects, all written as CSS custom properties once per animation frame:
 * - proximity glow: the `[data-glow-dot]` circles of the atlas near the pointer get opacity and a
 *   small scale from a linear falloff of their distance (only dots inside the radius are touched);
 * - `--mx` / `--my` on the `[data-magnetic]` element under the pointer (a few px of eased pull);
 * - `--ux` on `[data-underline]` links at the moment the pointer enters, so the underline draws
 *   outward from where the pointer came in.
 * Nothing is attached on touch devices or with reduced motion; CSS keeps the static hover states.
 */
export function useHeroPointer(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia(QUERY);
    let detach: (() => void) | null = null;

    const attach = () => {
      let frame = 0;
      let x = 0, y = 0;
      let target: Element | null = null;
      let mag: HTMLElement | null = null;
      let lit: SVGElement[] = [];

      const clearGlow = () => {
        for (const d of lit) { d.style.opacity = "0"; d.style.transform = ""; }
        lit = [];
      };

      const release = (m: HTMLElement | null) => {
        if (!m) return;
        m.style.setProperty("--mx", "0px");
        m.style.setProperty("--my", "0px");
      };

      const paintGlow = () => {
        const svg = el.querySelector<SVGSVGElement>("svg[data-glow-grid]");
        if (!svg) return clearGlow();
        const box = svg.getBoundingClientRect();
        const cols = Number(svg.dataset.cols), rows = Number(svg.dataset.rows);
        const cell = box.width / cols;
        const R = box.width * RADIUS;
        const px = (x - box.left) / cell, py = (y - box.top) / cell, rc = R / cell;
        const next: SVGElement[] = [];
        const dots = svg.querySelectorAll<SVGElement>("[data-glow-dot]");
        const c0 = Math.max(0, Math.floor(px - rc)), c1 = Math.min(cols - 1, Math.ceil(px + rc));
        const r0 = Math.max(0, Math.floor(py - rc)), r1 = Math.min(rows - 1, Math.ceil(py + rc));
        const idx = (svg as unknown as { __idx?: Map<number, SVGElement> }).__idx
          ?? ((svg as unknown as { __idx: Map<number, SVGElement> }).__idx = new Map(Array.from(dots, (d) => [Number(d.dataset.i), d] as const)));
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) {
            const d = idx.get(r * cols + c);
            if (!d) continue;
            const w = 1 - Math.hypot(c + 0.5 - px, r + 0.5 - py) / rc;
            if (w <= 0) continue;
            const e = w * w * (3 - 2 * w);
            d.style.opacity = e.toFixed(3);
            d.style.transform = `scale(${(1 + MAX_SCALE * e).toFixed(3)})`;
            next.push(d);
          }
        const keep = new Set(next);
        for (const d of lit) if (!keep.has(d)) { d.style.opacity = "0"; d.style.transform = ""; }
        lit = next;
      };

      const paint = () => {
        frame = 0;
        paintGlow();
        const next = (target?.closest("[data-magnetic]") as HTMLElement | null) ?? null;
        if (next !== mag) { release(mag); mag = next; }
        if (mag) {
          const r = mag.getBoundingClientRect();
          const cap = Number(mag.dataset.magnetic) || MAX;
          mag.style.setProperty("--mx", `${clamp((x - (r.left + r.width / 2)) * PULL, cap).toFixed(2)}px`);
          mag.style.setProperty("--my", `${clamp((y - (r.top + r.height / 2)) * PULL, cap).toFixed(2)}px`);
        }
      };

      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
        x = e.clientX; y = e.clientY; target = e.target as Element;
        if (!frame) frame = requestAnimationFrame(paint);
      };
      const enter = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
        /* glow is written on the first move */
      };
      const leave = () => {
        clearGlow();
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        release(mag);
        mag = null;
      };
      // Underline origin: captured on entry (pointerover bubbles; pointerenter does not).
      const over = (e: PointerEvent) => {
        const link = (e.target as Element).closest("[data-underline]") as HTMLElement | null;
        if (!link || link.contains(e.relatedTarget as Node)) return;
        const r = link.getBoundingClientRect();
        link.style.setProperty("--ux", `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
      };
      const out = (e: PointerEvent) => {
        const link = (e.target as Element).closest("[data-underline]") as HTMLElement | null;
        if (!link || link.contains(e.relatedTarget as Node)) return;
        const r = link.getBoundingClientRect();
        link.style.setProperty("--ux", `${Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100)}%`);
      };

      el.addEventListener("pointermove", move, { passive: true });
      el.addEventListener("pointerenter", enter);
      el.addEventListener("pointerleave", leave);
      el.addEventListener("pointerover", over);
      el.addEventListener("pointerout", out);
      return () => {
        leave();
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerenter", enter);
        el.removeEventListener("pointerleave", leave);
        el.removeEventListener("pointerover", over);
        el.removeEventListener("pointerout", out);
      };
    };

    const sync = () => {
      detach?.();
      detach = mq.matches ? attach() : null;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => { mq.removeEventListener("change", sync); detach?.(); };
  }, [ref]);
}
