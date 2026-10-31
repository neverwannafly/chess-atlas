import { forwardRef, useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import type { EventSummary } from "@/types/event";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { SearchField } from "@/components/ui/SearchField";
import { formatInr, formatInrFull } from "@/lib/format";
import { useHeroPointer } from "@/hooks/useHeroPointer";
import { Atlas } from "./Atlas";
import { LogoMark } from "@/components/Logo";

export interface HeroFigures {
  ahead: number;
  live: number;
  prize: number;
  cities: number;
}

function Figure({ value, label, format, title }: { value: number | null; label: string; format?: (n: number) => string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <dd className="text-[20px] font-medium leading-none tracking-h2 text-fg sm:text-[24px]">
        {value == null ? <span className="skeleton inline-block h-5 w-12 rounded-sm align-middle sm:h-6" aria-hidden /> : <NumberTicker value={value} format={format} />}
      </dd>
      <dt className="mt-1.5 text-small leading-tight text-muted">{label}</dt>
    </div>
  );
}

/**
 * Hero built around the atlas: the dot map of India is the dominant visual, with the headline, the
 * search field and three live figures beside it (below the headline on phones).
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
  useHeroPointer(ref);
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
      {/* Phones: headline, then the map at full width, then the figures and the search.
          From 768px the map takes its own column on the right and the text sits beside it. */}
      <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 items-center px-4 pb-6 pt-5 sm:px-6 sm:pt-8 md:grid-cols-[minmax(0,1fr)_19rem] md:gap-x-10 md:pb-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-x-16 lg:px-8 lg:pt-6 xl:grid-cols-[minmax(0,1fr)_27.5rem]">
        <motion.div style={reduce ? undefined : { opacity: fade, y: lift }} className="md:col-start-1 md:row-start-1 md:self-end">
          <p className="mb-3 flex items-center gap-2 text-small text-muted">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="pulse-ring absolute inset-0 rounded-full bg-accent" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
            {figures && figures.live > 0 ? <span><span className="text-fg">{figures.live}</span> being played right now</span> : <span>Updated daily from the AICF calendar</span>}
          </p>
          <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
            <span role="img" aria-label="Chess Atlas" className="flex shrink-0 items-center self-center">
              <LogoMark className="h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14" />
            </span>
            <h1 id="hero-title" className="text-[30px] font-semibold leading-[1.08] tracking-display text-fg sm:text-[40px] lg:text-[48px]">
              Find your next chess tournament.
            </h1>
          </div>
          <p className="mt-2 max-w-[52ch] text-ui text-muted sm:text-body">
            Every AICF event in India, with formats, prize funds, fees and deadlines read from the brochures.
          </p>
        </motion.div>

        <motion.div
          style={reduce ? undefined : { scale: mapScale, y: mapY, opacity: fade }}
          className="mx-auto mt-4 w-full max-w-[26rem] md:col-start-2 md:row-span-3 md:row-start-1 md:mt-0 md:max-w-none"
        >
          <Atlas events={atlasEvents} onPick={onPick} className="w-full" />
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-small text-subtle" aria-hidden>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" />Host city</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-accent" />Being played now</span>
            <span className="max-sm:hidden">Select a dot to filter</span>
          </p>
        </motion.div>

        <motion.dl style={reduce ? undefined : { opacity: fade }} className="mt-5 grid grid-cols-3 gap-3 sm:gap-6 md:col-start-1 md:row-start-3 md:max-w-[34rem] md:self-start">
          {figs}
        </motion.dl>

        <motion.div style={reduce ? undefined : { opacity: fade, y: lift }} className="mt-5 md:col-start-1 md:row-start-2 md:mt-6">
          <div ref={searchWrapRef} className="max-w-[34rem]">
            <SearchField ref={inputRef} id="hero-search" size="lg" value={q} onChange={setQ} onEnter={onSubmit} />
          </div>
        </motion.div>
      </div>
    </section>
  );
});
