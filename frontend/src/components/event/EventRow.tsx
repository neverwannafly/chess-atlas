import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { EventSummary } from "@/types/event";
import { useEvent } from "@/hooks/queries";
import { useSeen } from "@/hooks/useInView";
import { displayName, rowFacts } from "@/lib/eventFacts";
import { cn } from "@/lib/utils";

/** Desktop columns: date · name/place · format · FIDE · prize · entry · registration · arrow. Shared with the sticky group headers. */
export const ROW_COLS = "lg:grid lg:grid-cols-[76px_minmax(0,1fr)_128px_48px_84px_92px_136px_16px] lg:gap-x-4";

const dayFmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));

function DateBlock({ start, end, dayOf }: { start: string; end: string; dayOf: string | null }) {
  const sd = +start.slice(8), ed = +end.slice(8);
  const multi = start !== end;
  const crossMonth = start.slice(0, 7) !== end.slice(0, 7);
  const wd = multi ? `${dayFmt(start, { weekday: "short" })}–${dayFmt(end, { weekday: "short" })}` : dayFmt(start, { weekday: "short" });
  const mo = crossMonth ? `${dayFmt(start, { month: "short" })}–${dayFmt(end, { month: "short" })}` : dayFmt(start, { month: "short" });
  return (
    <div className="w-[52px] shrink-0 lg:w-auto" aria-hidden>
      <div className="flex items-baseline whitespace-nowrap leading-none">
        <span className="text-[20px] font-medium tracking-h2 text-fg lg:text-[22px]">{sd}</span>
        {multi && <span className="text-small font-medium text-subtle lg:text-ui">–{ed}</span>}
      </div>
      <div className="mt-1.5 hidden whitespace-nowrap text-label uppercase tracking-[0.04em] text-muted lg:block">{dayOf ? <span className="normal-case tracking-normal text-accent">{dayOf}</span> : multi ? (crossMonth ? mo : wd) : `${wd} · ${mo}`}</div>
      <div className="mt-1 whitespace-nowrap text-label uppercase tracking-[0.04em] text-muted lg:hidden">{multi ? mo : wd}</div>
    </div>
  );
}

const Dash = () => <span className="text-subtle" aria-label="not listed">—</span>;

function Cell({ main, note, className, title, tone }: { main: React.ReactNode | null; note?: React.ReactNode | null; className?: string; title?: string; tone?: string }) {
  return (
    <div className={cn("hidden min-w-0 lg:block", className)} title={title}>
      <div className={cn("truncate text-ui font-medium leading-tight text-fg", tone)}>{main ?? <Dash />}</div>
      {note && <div className="mt-1 truncate text-small leading-tight text-muted">{note}</div>}
    </div>
  );
}

/**
 * One tournament as a single almanac line. Desktop: aligned fact columns. Mobile: a tight three-line
 * entry (name · place & format · money & deadline). The whole row links to the event page.
 */
export function EventRow({ e }: { e: EventSummary; onOpen?: (code: string) => void }) {
  const [ref, seen] = useSeen<HTMLElement>("400px");
  // The summary lacks the time-control notation and fee tiers; fetch the brochure data once near the viewport.
  const { data: detail } = useEvent(e.eventCode, seen && e.extractionStatus === "done");
  const f = rowFacts(e, detail);
  const name = displayName(e.name);
  const nameRef = useRef<HTMLSpanElement>(null);
  const place = [e.city, e.state].filter(Boolean).join(", ") || "Venue to be announced";
  const tcLine = [f.format, f.tc].filter(Boolean).join(" ");
  const regTone = f.reg?.tone === "warn" ? "text-warn" : f.reg?.tone === "muted" ? "text-muted" : undefined;

  const mobileMeta = [place, tcLine || null].filter(Boolean) as string[];
  const mobileMoney = [
    f.fide ? "FIDE" : null,
    f.prize ? `${f.prize} prize` : null,
    f.fee ? (f.fee === "Free" ? "Free entry" : `from ${f.fee}`) : null,
  ].filter(Boolean) as string[];

  return (
    <article
      ref={ref}
      className={cn(
        "group relative flex gap-3 rounded-sm px-1 py-3.5 transition-colors duration-[var(--dur-1)] hover:bg-surface-2/70 lg:items-center lg:px-3 lg:py-3",
        f.past && "opacity-60",
        ROW_COLS
      )}
    >
      <div><DateBlock start={e.startDate} end={e.endDate} dayOf={f.dayOf} /></div>

      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] font-medium leading-snug tracking-h3 text-fg lg:line-clamp-none lg:truncate">
          <Link
            to={`/events/${encodeURIComponent(e.eventCode)}`}
            viewTransition
            onClick={() => {
              // Name the clicked title so the event page title (view-transition-name: event-title-{code}) morphs from it.
              if (nameRef.current) nameRef.current.style.viewTransitionName = `event-title-${e.eventCode}`;
            }}
            className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-sm after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent"
          >
            {f.live && <span className="pulse-dot mr-1.5 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-accent align-middle" aria-label="Happening now" />}
            <span ref={nameRef}>{name}</span>
          </Link>
        </h3>
        <p className="mt-0.5 hidden truncate text-small text-muted lg:block">
          {place}
          {e.venueName && <span className="text-subtle"> · {e.venueName}</span>}
        </p>
        {/* mobile: two dense lines under the name */}
        <p className="mt-1 truncate text-small text-muted lg:hidden">
          {mobileMeta.map((m, i) => (
            <span key={i}>
              {i > 0 && <span className="px-1.5 text-subtle" aria-hidden>·</span>}
              {m}
            </span>
          ))}
        </p>
        {(mobileMoney.length > 0 || f.reg || f.dayOf) && (
          <p className="mt-0.5 text-small text-muted lg:hidden">
            {f.dayOf && <span className="text-accent">{f.dayOf}</span>}
            {mobileMoney.map((m, i) => (
              <span key={i}>
                {(i > 0 || f.dayOf) && <span className="px-1.5 text-subtle" aria-hidden>·</span>}
                <span className={m === "FIDE" ? "font-medium text-fg" : m.endsWith(" prize") ? "font-medium text-fg" : undefined}>{m}</span>
              </span>
            ))}
            {f.reg && (
              <span>
                {(mobileMoney.length > 0 || f.dayOf) && <span className="px-1.5 text-subtle" aria-hidden>·</span>}
                <span className={regTone}>{f.reg.label}</span>
              </span>
            )}
          </p>
        )}
      </div>

      <Cell
        main={f.format ? <>{f.format}{f.tc && <span className="ml-1.5 font-mono text-[12.5px] font-normal text-muted">{f.tc}</span>}</> : null}
        note={f.rounds ? `${f.rounds} rounds` : null}
      />
      <Cell main={f.fide ? <span className="inline-flex h-5 items-center rounded-[4px] border border-border-strong px-1.5 text-[11px] font-semibold tracking-[0.04em]">FIDE</span> : null} />
      <Cell className="text-right" main={f.prize} note={f.prizeNote} title={f.prizeTitle} />
      <Cell className="text-right" main={f.fee} note={f.feeNote} />
      <Cell main={f.reg?.label ?? null} tone={regTone} />
      <ArrowRight className="hidden h-4 w-4 -translate-x-1 text-subtle opacity-0 transition-[opacity,transform] duration-[var(--dur-2)] group-hover:translate-x-0 group-hover:opacity-100 lg:block" aria-hidden />
    </article>
  );
}

export function EventRowSkeleton() {
  return (
    <div className={cn("flex gap-3 px-1 py-4 lg:items-center lg:px-3", ROW_COLS)} aria-hidden>
      <div className="w-12 space-y-1.5 lg:w-auto"><div className="skeleton h-5 w-9 rounded-sm" /><div className="skeleton h-3 w-14 rounded-sm" /></div>
      <div className="flex-1 space-y-2"><div className="skeleton h-4 w-3/4 rounded-sm" /><div className="skeleton h-3 w-1/3 rounded-sm" /></div>
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="hidden lg:block"><div className="skeleton h-4 w-16 rounded-sm" /></div>)}
      <div className="hidden lg:block" />
    </div>
  );
}
