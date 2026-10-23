import { useEffect, useState } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { EventSummary, Paginated } from "@/types/event";

/** Find the listing row for `code` in any cached list query, so the header can paint before the detail arrives. */
export function useCachedSummary(code: string): EventSummary | undefined {
  const qc = useQueryClient();
  const [hit] = useState(() => {
    for (const [, data] of qc.getQueriesData<Paginated<EventSummary> | InfiniteData<Paginated<EventSummary>>>({ queryKey: ["events"] })) {
      if (!data) continue;
      const pages = "pages" in data ? data.pages : [data];
      for (const p of pages) {
        const e = p?.data?.find((x) => x.eventCode === code);
        if (e) return e;
      }
    }
    return undefined;
  });
  return hit;
}

/** Id of the section whose top has most recently crossed `offset` px from the viewport top. */
export function useScrollSpy(ids: string[], offset = 160) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join(",");
  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    let raf = 0;
    const measure = () => {
      raf = 0;
      let cur = list[0] ?? null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - offset <= 0) cur = id;
      }
      // At the very bottom, the last section wins even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = list[list.length - 1] ?? cur;
      setActive(cur);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key, offset]);
  return active;
}

/** True once the element has scrolled up past the top offset; drives the condensed action bar. Returns a callback ref. */
export function useScrolledPast(topOffset = 56) {
  const [el, setEl] = useState<Element | null>(null);
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      ([en]) => setPast(!en.isIntersecting && en.boundingClientRect.top < topOffset),
      { rootMargin: `-${topOffset}px 0px 0px 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, topOffset]);
  return [setEl, past] as const;
}
