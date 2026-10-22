import { Link } from "react-router-dom";
import { Award, MapPin, Swords, Ticket } from "lucide-react";
import type { EventSummary } from "@/types/event";
import { formatDateRange, formatInr, formatInrFull, location } from "@/lib/format";
import { DeadlineWarning, Pill, StartIndicator, TimeControlBadge } from "@/components/EventBits";
import { cn } from "@/lib/utils";

function DateBlock({ start, end }: { start: string; end: string }) {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const mon = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(d(start));
  const sd = d(start).getUTCDate();
  const ed = d(end).getUTCDate();
  const range = start === end ? `${sd}` : start.slice(0, 7) === end.slice(0, 7) ? `${sd}–${ed}` : `${sd}`;
  return (
    <div className="flex w-[4.5rem] shrink-0 self-start flex-col items-center justify-center rounded-lg bg-sunk py-2 text-center" aria-hidden>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">{mon}</span>
      <span className="whitespace-nowrap font-display text-xl font-semibold leading-tight">{range}</span>
    </div>
  );
}

export function EventCard({ e, className }: { e: EventSummary; className?: string }) {
  const past = e.status === "past";
  return (
    <article className={cn("group relative rounded-xl border border-line bg-surface transition-shadow hover:shadow-md hover:shadow-black/5 focus-within:shadow-md", past && "opacity-80", className)}>
      <div className="flex gap-4 p-4">
        <DateBlock start={e.startDate} end={e.endDate} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug">
            <Link to={`/events/${e.eventCode}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4">
              {e.name}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{location(e)}</span>
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{formatDateRange(e.startDate, e.endDate)}</span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <StartIndicator e={e} />
            <TimeControlBadge tc={e.timeControlType} />
            {e.fideRated && <Pill tone="accent">FIDE rated</Pill>}
            {!past && <DeadlineWarning deadline={e.registrationDeadline} end={e.endDate} />}
          </div>
          {(e.totalPrizeInr != null || e.entryFeeMinInr != null || e.rounds != null) ? (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-2.5 text-[13px]">
              {e.totalPrizeInr != null && (
                <div className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-brass" aria-hidden />
                  <dt className="sr-only">Total prize</dt>
                  <dd className="font-semibold" title={formatInrFull(e.totalPrizeInr)}>{formatInr(e.totalPrizeInr)}</dd>
                </div>
              )}
              {e.entryFeeMinInr != null && (
                <div className="flex items-center gap-1.5">
                  <Ticket className="h-3.5 w-3.5 text-muted" aria-hidden />
                  <dt className="sr-only">Entry fee from</dt>
                  <dd><span className="text-muted">from </span><span className="font-semibold" title={formatInrFull(e.entryFeeMinInr)}>{formatInr(e.entryFeeMinInr)}</span></dd>
                </div>
              )}
              {e.rounds != null && (
                <div className="flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5 text-muted" aria-hidden />
                  <dt className="sr-only">Rounds</dt>
                  <dd>{e.rounds} rounds</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 border-t border-line pt-2.5 text-[13px] text-muted">
              {e.extractionStatus === "no_brochure" ? "No brochure published yet" : "Details being processed"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
