import { forwardRef, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { EventSummary } from "@/types/event";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { SearchField } from "@/components/ui/SearchField";
import { formatInr, formatInrFull } from "@/lib/format";
import { Atlas } from "./Atlas";

export interface HeroFigures {
  ahead: number;
  live: number;
  prize: number;
  cities: number;
}

function Figure({ value, label, format, title }: { value: number | null; label: string; format?: (n: number) => string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <dd className="inline text-[19px] font-medium leading-none tracking-h2 text-fg sm:block sm:text-[24px]">
        {value == null ? <span className="skeleton inline-block h-[19px] w-12 rounded-sm align-middle sm:h-6" aria-hidden /> : <NumberTicker value={value} format={format} />}
      </dd>
      <dt className="ml-1.5 inline text-small text-muted sm:ml-0 sm:mt-1.5 sm:block">{label}</dt>
    </div>
  );
}

/**
 * Compact hero: headline, one line of copy, the search field, three live figures, and the atlas.
 * It recedes as you scroll (scroll-linked, transform/opacity only); the search docks into the header.
 */
export const Hero = forwardRef<HTMLInputElement, {
  figures: HeroFigures | null;
  atlasEvents: EventSummary[];
  q: string;
  setQ: (v: string) => void;
  onSubmit: () => void;
  onPick: (p: { city: string | null; state: string | null }) => void;
  searchWrapRef: React.Ref<HTMLDivElement>;
}>(function Hero({ figures, atlasEvents, q, setQ, onSubmit, onPick, searchWrapRef }, inputRef) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], [0, -36]);
  const mapScale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const mapY = useTransform(scrollYProgress, [0, 1], [0, 24]);

  const figs = (
    <>
      <Figure value={figures?.ahead ?? null} label="tournaments ahead" />
      <Figure value={figures?.prize ?? null} label="in prize funds" format={(n) => formatInr(Math.round(n / 1e5) * 1e5)} title={figures ? formatInrFull(figures.prize) : undefined} />
      <Figure value={figures?.cities ?? null} label="host cities" />
    </>
  );

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative overflow-hidden border-b border-border">
      <div className="hero-backdrop pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-x-4 px-4 pb-6 pt-5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:px-6 sm:pt-8 md:grid-cols-[minmax(0,1fr)_16rem] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-x-16 lg:px-8 lg:pb-7 lg:pt-6">
        <motion.div style={reduce ? undefined : { opacity: fade, y: lift }} className="col-span-2 md:col-span-1 md:row-start-1">
          <p className="mb-3 flex items-center gap-2 text-small text-muted">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="pulse-ring absolute inset-0 rounded-full bg-accent" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
            {figures && figures.live > 0 ? <span><span className="text-fg">{figures.live}</span> being played right now</span> : <span>Updated daily from the AICF calendar</span>}
          </p>
          <h1 id="hero-title" className="text-[30px] font-semibold leading-[1.08] tracking-display text-fg sm:text-[40px] lg:text-[44px]">
            Find your next chess tournament.
          </h1>
          <p className="mt-2 max-w-[62ch] text-ui text-muted sm:text-body lg:max-w-none">
            Every AICF event in India, with formats, prize funds, fees and deadlines read from the brochures.
          </p>
        </motion.div>

        <motion.dl style={reduce ? undefined : { opacity: fade }} className="col-start-1 row-start-2 mt-4 grid gap-2.5 sm:grid-cols-3 sm:gap-6 md:row-start-3 md:mt-5 md:max-w-[34rem]">
          {figs}
        </motion.dl>

        <motion.div style={reduce ? undefined : { opacity: fade, y: lift }} className="col-span-2 row-start-3 mt-5 md:col-span-1 md:row-start-2 md:mt-5 lg:mt-4">
          <div ref={searchWrapRef} className="max-w-[34rem]">
            <SearchField ref={inputRef} id="hero-search" size="lg" value={q} onChange={setQ} onEnter={onSubmit} />
          </div>
        </motion.div>

        <motion.div
          style={reduce ? undefined : { scale: mapScale, y: mapY, opacity: fade }}
          className="col-start-2 row-start-2 mt-3 md:row-span-3 md:row-start-1 md:mt-0"
        >
          <Atlas events={atlasEvents} onPick={onPick} className="w-full" />
        </motion.div>
      </div>
    </section>
  );
});
