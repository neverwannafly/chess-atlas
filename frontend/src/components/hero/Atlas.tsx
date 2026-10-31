import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { EventSummary } from "@/types/event";
import { placePoint } from "@/lib/geo";
import { pluralize, todayIST } from "@/lib/format";
import { ATLAS } from "./atlasDots";

/** Decode the run-length rows into [col,row] land cells, once. */
const LAND: [number, number][] = (() => {
  const out: [number, number][] = [];
  ATLAS.rows.forEach((row, r) => {
    let c = 0;
    row.split(".").forEach((n, i) => {
      const len = +n;
      if (i % 2 === 1) for (let k = 0; k < len; k++) out.push([c + k, r]);
      c += len;
    });
  });
  return out;
})();
const LAND_SET = new Set(LAND.map(([c, r]) => `${c},${r}`));
const W = ATLAS.cols;
const H = ATLAS.rows.length;

/** Nearest land cell to a lat/lng, so coastal cities never float in the sea. */
function cellFor(lat: number, lng: number): [number, number] {
  const c = (lng - ATLAS.lng0) / ATLAS.dLng;
  const r = (ATLAS.lat0 - lat) / ATLAS.dLat;
  const rc = Math.round(c), rr = Math.round(r);
  if (LAND_SET.has(`${rc},${rr}`)) return [rc, rr];
  let best: [number, number] = [rc, rr];
  let bd = Infinity;
  for (let dc = -3; dc <= 3; dc++)
    for (let dr = -3; dr <= 3; dr++) {
      const k = `${rc + dc},${rr + dr}`;
      const d = (rc + dc - c) ** 2 + (rr + dr - r) ** 2;
      if (LAND_SET.has(k) && d < bd) { bd = d; best = [rc + dc, rr + dr]; }
    }
  return best;
}

/** All base dots as one path: a full circle per cell drawn with two arcs. */
const BASE_R = 0.24;
const BASE_PATH = LAND.map(([c, r]) => `M${c + 0.5 - BASE_R} ${r + 0.5}a${BASE_R} ${BASE_R} 0 1 0 ${BASE_R * 2} 0a${BASE_R} ${BASE_R} 0 1 0 ${-BASE_R * 2} 0`).join("");

/** Per-dot circles for the pointer glow (see hooks/useHeroPointer.ts); invisible until lit. */
const GLOW_DOTS = LAND.map(([c, r]) => (
  <circle key={`${c},${r}`} data-glow-dot data-i={r * W + c} cx={c + 0.5} cy={r + 0.5} r={0.3} className="atlas-glow-dot" />
));

interface Spot {
  key: string;
  c: number;
  r: number;
  count: number;
  live: boolean;
  label: string;
  city: string | null;
  state: string | null;
}

/**
 * The "atlas": a dot-matrix India where lit dots are the cities in the current result set. Lit dots
 * grow with the number of tournaments, ongoing ones breathe, and a dot is a shortcut to filter by it.
 */
export const Atlas = memo(function Atlas({ events, onPick, className }: {
  events: EventSummary[];
  onPick?: (p: { city: string | null; state: string | null }) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<Spot | null>(null);
  const spots = useMemo(() => {
    const today = todayIST();
    const m = new Map<string, Spot>();
    for (const e of events) {
      const p = placePoint(e.city, e.state);
      if (!p) continue;
      const [c, r] = cellFor(p[0], p[1]);
      const key = `${c},${r}`;
      const live = e.startDate <= today && e.endDate >= today;
      const s = m.get(key);
      if (s) {
        s.count++;
        s.live ||= live;
        if (s.city !== e.city) s.city = null;
        if (s.state !== e.state) s.state = null;
      } else m.set(key, { key, c, r, count: 1, live, label: "", city: e.city, state: e.state });
    }
    for (const s of m.values()) s.label = s.city ?? s.state ?? "Several places";
    return [...m.values()].sort((a, b) => a.count - b.count);
  }, [events]);

  return (
    <div className={className}>
      <div className="relative" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" data-glow-grid data-cols={W} data-rows={H} role="img" aria-label={`Map of India with ${pluralize(spots.length, "place")} hosting tournaments`}>
          <defs>
            <radialGradient id="atlas-glow">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d={BASE_PATH} fill="var(--atlas-dot)" />
          <g aria-hidden pointerEvents="none">{GLOW_DOTS}</g>
          <AnimatePresence initial={!reduce}>
            {spots.map((s, i) => {
              const rad = Math.min(0.34 + Math.sqrt(s.count) * 0.13, 0.85);
              const cx = s.c + 0.5, cy = s.r + 0.5;
              return (
                <motion.g
                  key={s.key}
                  initial={{ opacity: 0, scale: 0.2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.2 }}
                  transition={{ duration: 0.5, delay: reduce ? 0 : 0.25 + (i % 24) * 0.025, ease: [0.2, 0.8, 0.2, 1] }}
                  className={onPick ? "cursor-pointer" : undefined}
                  onPointerEnter={() => setHover(s)}
                  onPointerLeave={() => setHover((h) => (h?.key === s.key ? null : h))}
                  onClick={() => onPick?.({ city: s.city, state: s.state })}
                >
                  <circle cx={cx} cy={cy} r={rad * 3.2} fill="url(#atlas-glow)" opacity={Math.min(0.35 + s.count * 0.08, 0.9)} />
                  {s.live && <circle cx={cx} cy={cy} r={rad * 1.5} fill="none" stroke="var(--accent)" strokeWidth={0.12} className="atlas-ping" />}
                  <circle cx={cx} cy={cy} r={rad} fill="var(--accent)" />
                  <circle cx={cx} cy={cy} r={1.2} fill="transparent" />
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>
        <AnimatePresence>
          {hover && (
            <motion.div
              key={hover.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-border bg-surface px-2 py-1 text-small shadow-e2"
              style={{ left: `${((hover.c + 0.5) / W) * 100}%`, top: `calc(${((hover.r + 0.5) / H) * 100}% - 10px)` }}
            >
              <span className="font-medium text-fg">{hover.label}</span>
              <span className="ml-1.5 text-muted">{hover.count}</span>
              {hover.live && <span className="ml-1.5 text-accent">· live</span>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
