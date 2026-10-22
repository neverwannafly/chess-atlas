import { Link } from "react-router-dom";
import { Award, CalendarDays, MapPin, Swords, Ticket } from "lucide-react";
import type { EventSummary } from "@/types/event";
import { formatDateRange, formatInr, formatInrFull, location } from "@/lib/format";
import { DeadlineWarning, Pill, StartIndicator, TimeControlBadge } from "@/components/EventBits";
import { cn } from "@/lib/utils";

/** The date sits on a board square; squares alternate by row like a board. */
function DateTile({ start, end, dark }: { start: string; end: string; dark: boolean }) {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const mon = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(d(start));
  const sd = d(start).getUTCDate();
  const ed = d(end).getUTCDate();
  const range = start === end ? `${sd}` : start.slice(0, 7) === end.slice(0, 7) ? `${sd}–${ed}` : `${sd}`;
  return (
    <div className={cn("flex w-[5.25rem] shrink-0 flex-col items-center justify-center px-1 py-3 text-center sm:w-24", dark ? "sq-dark" : "sq-light")} aria-hidden>
      <span className="text-sm font-bold">{mon}</span>
      <span className="font-display text-[1.7rem] font-extrabold leading-none whitespace-nowrap">{range}</span>
    </div>
  );
}

export function EventCard({ e, index = 0, className }: { e: EventSummary; index?: number; className?: string }) {
  const past = e.status === "past";
  const hasFacts = e.totalPrizeInr != null || e.entryFeeMinInr != null || e.rounds != null;
  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-lg border-2 border-ink/15 bg-surface transition-[transform,box-shadow,border-color] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-accent hover:shadow-[4px_4px_0_var(--accent)] focus-within:border-accent focus-within:shadow-[4px_4px_0_var(--accent)]",
        past && "opacity-80",
        className
      )}
    >
      <DateTile start={e.startDate} end={e.endDate} dark={index % 2 === 0} />
      <div className="min-w-0 flex-1 p-4">
        <h3 className="font-display text-xl font-bold leading-tight">
          <Link to={`/events/${e.eventCode}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4">
            {e.name}
          </Link>
        </h3>
        <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{location(e)}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-muted">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          <span>{formatDateRange(e.startDate, e.endDate)}</span>
        </p>
        {e.tagline && <p className="mt-2 text-[15px] leading-snug">{e.tagline}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StartIndicator e={e} />
          <TimeControlBadge tc={e.timeControlType} />
          {e.fideRated && <Pill tone="accent">FIDE rated</Pill>}
          {!past && <DeadlineWarning deadline={e.registrationDeadline} end={e.endDate} />}
        </div>
        {hasFacts ? (
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t-2 border-dashed border-ink/15 pt-2.5 text-[14px]">
            {e.totalPrizeInr != null && e.totalPrizeInr > 0 && (
              <div className="flex items-center gap-1.5">
                <Award className="h-4 w-4 text-brass" aria-hidden />
                <dt className="sr-only">Total prize</dt>
                <dd className="font-bold" title={formatInrFull(e.totalPrizeInr)}>{formatInr(e.totalPrizeInr)}</dd>
              </div>
            )}
            {e.entryFeeMinInr != null && (
              <div className="flex items-center gap-1.5">
                <Ticket className="h-4 w-4 text-muted" aria-hidden />
                <dt className="sr-only">Entry fee from</dt>
                <dd><span className="text-muted">from </span><span className="font-bold" title={formatInrFull(e.entryFeeMinInr)}>{formatInr(e.entryFeeMinInr)}</span></dd>
              </div>
            )}
            {e.rounds != null && (
              <div className="flex items-center gap-1.5">
                <Swords className="h-4 w-4 text-muted" aria-hidden />
                <dt className="sr-only">Rounds</dt>
                <dd>{e.rounds} rounds</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 border-t-2 border-dashed border-ink/15 pt-2.5 text-[14px] text-muted">
            {e.extractionStatus === "no_brochure" ? "No brochure published yet" : "Prizes and fees are being read from the brochure"}
          </p>
        )}
      </div>
    </article>
  );
}
