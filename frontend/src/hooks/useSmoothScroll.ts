import { useEffect } from "react";
import Lenis from "lenis";
import { useLocation } from "react-router-dom";

let instance: Lenis | null = null;

/** Lenis smooth scroll for the whole app; skipped when the user prefers reduced motion. */
export function useSmoothScroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const lenis = new Lenis({ anchors: true, lerp: 0.12 });
    instance = lenis;
    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      instance = null;
    };
  }, []);
  useEffect(() => { instance?.scrollTo(0, { immediate: true }); }, [pathname]);
}

/** Scroll to an element through Lenis when active, natively otherwise. */
export function scrollToEl(el: HTMLElement) {
  if (instance) instance.scrollTo(el, { offset: -8 });
  else el.scrollIntoView({ block: "start" });
}
