import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import type { EventDetail, EventSummary } from "@/types/event";
import { Badge } from "@/components/Badge";
import { ActionButtons } from "@/components/event-page/actions";
import { EASE } from "@/components/event-page/motion";
import { countdown, eventDays, longRange, phaseOf, registrationOf } from "@/lib/eventDetail";
import { daysBetween, todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));

export function PhaseBadge({ e }: { e: Pick<EventSummary, "startDate" | "endDate"> }) {
  const p = phaseOf(e);
  if (p === "ongoing")
    return (
      <Badge tone="accent">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />Ongoing
      </Badge>
    );
  if (p === "past") return <Badge tone="neutral">Past</Badge>;
  return (
    <Badge tone="outline" className="border-border">
      <span className="h-1.5 w-1.5 rounded-full bg-fg/70" aria-hidden />Upcoming
    </Badge>
  );
}

function RegistrationBadge({ e }: { e: EventDetail }) {
  const r = registrationOf(e);
  if (phaseOf(e) === "past") return null;
  if (r.closed) return <Badge tone="neutral">Registration closed</Badge>;
  if (r.daysLeft == null) return null;
  const txt = r.daysLeft === 0 ? "Registration closes today" : r.daysLeft === 1 ? "Registration closes tomorrow" : `Registration closes in ${r.daysLeft} days`;
  return <Badge tone={r.daysLeft <= 7 ? "warn" : "neutral"}>{txt}</Badge>;
}

/** A small calendar strip: the date span set large, with one cell per day of play. */
function DateCard({ e, className }: { e: EventSummary; className?: string }) {
  const today = todayIST();
  const days = eventDays(e.startDate, e.endDate);
  const n = daysBetween(e.startDate, e.endDate) + 1;
  const same = e.startDate === e.endDate;
  const sameMonth = e.startDate.slice(0, 7) === e.endDate.slice(0, 7);
  const big = same ? String(Number(e.startDate.slice(8))) : sameMonth ? `${Number(e.startDate.slice(8))}–${Number(e.endDate.slice(8))}` : `${Number(e.startDate.slice(8))} ${fmt(e.startDate, { month: "short" })} – ${Number(e.endDate.slice(8))}`;
  const month = fmt(e.endDate, { month: "long", year: "numeric" });
  const cells = days.length <= 10 ? days : null;
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-5 shadow-e1", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label font-medium uppercase tracking-[0.08em] text-muted">{n === 1 ? "One day" : `${n} days`}</p>
        <p className={cn("text-small font-medium", phaseOf(e) === "ongoing" ? "text-accent" : "text-fg")}>{countdown(e)}</p>
      </div>
      <p className="mt-3 text-[40px] font-semibold leading-none tracking-h1 tabular-nums">{big}</p>
      <p className="mt-1.5 text-ui text-muted">{month}</p>
      {cells && (
        <ol className="mt-5 grid gap-1" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, ${cells.length < 5 ? "48px" : "1fr"}))` }} aria-label="Days of play">
          {cells.map((d) => {
            const isToday = d === today;
            const done = d < today;
            return (
              <li key={d} className={cn("flex flex-col items-center gap-1 rounded-sm border py-1.5", isToday ? "border-accent bg-accent-soft" : "border-border bg-surface-2", done && "opacity-50")}>
                <span className="text-[10px] font-medium uppercase leading-none text-muted">{fmt(d, { weekday: "narrow" })}</span>
                <span className={cn("font-mono text-small leading-none", isToday ? "text-accent" : "text-fg")}>{Number(d.slice(8))}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function EventHeader({ e, name, tagline, actionsRef }: { e: EventDetail; name: string; tagline: string | null; actionsRef: (el: Element | null) => void }) {
  const reduce = useReducedMotion();
  const venue = e.details?.venue.name ?? e.venueName;
  const loc = [e.city, e.state].filter(Boolean).join(", ") || "Location to be announced";
  const fade = (i: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: EASE, delay: 0.06 * i } };

  return (
    <header className="relative pt-5 sm:pt-6">
      <motion.nav {...fade(0)} aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-small text-muted">
        <Link
          to="/"
          onClick={(ev) => { if (window.history.state?.idx > 0) { ev.preventDefault(); window.history.back(); } }}
          className="-mx-1 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-1 hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />All tournaments
        </Link>
        {e.state && (
          <>
            <span className="text-subtle" aria-hidden>/</span>
            <Link to={`/?state=${encodeURIComponent(e.state)}`} className="truncate rounded-sm hover:text-fg">{e.state}</Link>
          </>
        )}
      </motion.nav>

      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end lg:gap-14">
        <div className="min-w-0">
          <motion.div {...fade(1)} className="mb-4 flex flex-wrap items-center gap-1.5">
            <PhaseBadge e={e} />
            {(e.details?.fideRated ?? e.fideRated) && <Badge tone="accent">FIDE rated</Badge>}
            <RegistrationBadge e={e} />
          </motion.div>
          {/* No entrance animation on the title: it morphs from the listing row via the View Transitions API. */}
          <h1
            className="max-w-[26ch] text-[28px] font-semibold leading-[1.12] tracking-h1 text-balance sm:text-[36px] lg:text-h1"
            style={{ viewTransitionName: `event-title-${e.eventCode}` }}
          >
            {name}
          </h1>
          {tagline && <motion.p {...fade(2)} className="mt-3 max-w-[62ch] text-body-lg text-muted">{tagline}</motion.p>}
          <motion.dl {...fade(3)} className="mt-5 grid gap-2 text-ui sm:flex sm:flex-wrap sm:gap-x-6">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Dates</dt>
              <CalendarDays className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
              <dd>{longRange(e.startDate, e.endDate)}</dd>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <dt className="sr-only">Where</dt>
              <MapPin className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
              <dd className="min-w-0 truncate">{venue ? <><span>{venue}</span><span className="text-muted">, {loc}</span></> : loc}</dd>
            </div>
          </motion.dl>
          <motion.div {...fade(4)} ref={actionsRef} className="mt-7">
            <ActionButtons e={e} name={name} size="lg" className="max-sm:[&>*]:min-w-0 max-sm:[&>*]:flex-1 max-sm:[&>*]:basis-0 max-sm:[&>*]:px-2 max-sm:[&>*:first-child]:basis-full" />
          </motion.div>
        </div>
        <motion.div {...fade(3)} className="hidden lg:block">
          <DateCard e={e} />
        </motion.div>
      </div>
    </header>
  );
}
