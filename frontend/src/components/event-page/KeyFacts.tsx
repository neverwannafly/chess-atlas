import type { EventDetail } from "@/types/event";
import { Ticker } from "@/components/event-page/motion";
import { formatParts, lakhs, registrationOf } from "@/lib/eventDetail";
import { formatDayMonth, formatInrFull, formatWeekdayShort } from "@/lib/format";
import { cn } from "@/lib/utils";

function Cell({ label, children, note, tone, className }: { label: string; children: React.ReactNode; note?: React.ReactNode; tone?: "warn" | "accent"; className?: string }) {
  return (
    <div className={cn("min-w-0 bg-surface px-4 py-4 sm:px-5", className)}>
      <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className={cn("mt-2 truncate text-[17px] font-semibold leading-tight tracking-h3", tone === "warn" && "text-warn", tone === "accent" && "text-accent")}>{children}</dd>
      {note && <dd className={cn("mt-1 truncate text-small", tone === "warn" ? "text-warn" : "text-muted")}>{note}</dd>}
    </div>
  );
}

const Dash = ({ why = "Not listed" }: { why?: string }) => (
  <span className="font-normal text-subtle" title={why}>—</span>
);

export function KeyFacts({ e }: { e: EventDetail }) {
  const d = e.details;
  const f = formatParts(e, d);
  const total = d?.prizes.totalInr ?? e.totalPrizeInr;
  const first = d?.prizes.places.find((p) => (p.amountInr ?? 0) > 0)?.amountInr ?? null;
  const fees = (d?.entryFees ?? []).map((x) => x.amountInr).filter((x): x is number => x != null);
  const paid = fees.filter((x) => x > 0);
  const freeSome = fees.some((x) => x === 0);
  const fromFee = paid.length ? Math.min(...paid) : fees.length ? 0 : e.entryFeeMinInr;
  const reg = registrationOf(e);
  const fide = d?.fideRated ?? e.fideRated;

  // With almost nothing known, a row of dashes reads as broken; the sparse notice says it better.
  const known = [total || first, f.type || f.tc, fide != null, fromFee != null, reg.deadline || reg.link].filter(Boolean).length;
  if (known < 3) return null;

  const formatNote = [f.rounds ? `${f.rounds} rounds` : null, f.system].filter(Boolean).join(" · ");

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border shadow-e1 lg:grid-cols-[1.25fr_1.1fr_0.8fr_1fr_1fr]">
      <Cell label="Prize pool" className="col-span-2 lg:col-span-1" note={total ? [lakhs(total) && `${lakhs(total)}`, first && `1st ${formatInrFull(first)}`].filter(Boolean).join(" · ") : first ? `1st ${formatInrFull(first)}` : "Not listed"}>
        {total ? <Ticker value={total} className="text-[22px] tracking-h2" /> : <Dash />}
      </Cell>
      <Cell label="Format" note={formatNote || (f.raw ?? undefined)}>
        {f.type || f.tc ? (
          <span title={f.raw ?? undefined}>
            {f.type}
            {f.tc && <span className={cn("font-mono text-[15px] font-medium tracking-tight", f.type && "ml-2 text-muted")}>{f.tc}</span>}
          </span>
        ) : <Dash />}
      </Cell>
      <Cell label="Rating" tone={fide ? "accent" : undefined} note={fide ? "Counts for FIDE" : fide === false ? "Unrated event" : undefined}>
        {fide ? "FIDE rated" : fide === false ? "Not rated" : <Dash />}
      </Cell>
      <Cell label="Entry from" note={freeSome && paid.length ? "Free for some players" : fees.length > 1 ? `${fees.length} fee bands` : undefined}>
        {fromFee == null ? <Dash /> : fromFee === 0 ? "Free" : formatInrFull(fromFee)}
      </Cell>
      <Cell
        label="Registration"
        tone={reg.daysLeft != null && reg.daysLeft <= 7 ? "warn" : undefined}
        note={reg.closed ? (reg.deadline ? `Closed ${formatDayMonth(reg.deadline)}` : "Event has ended") : reg.daysLeft != null ? (reg.daysLeft === 0 ? "Closes today" : reg.daysLeft === 1 ? "Closes tomorrow" : `in ${reg.daysLeft} days`) : reg.link ? "Open now" : undefined}
      >
        {reg.closed ? "Closed" : reg.deadline ? `${formatWeekdayShort(reg.deadline)} ${formatDayMonth(reg.deadline)}` : reg.link ? "Open" : <Dash why="No deadline listed" />}
      </Cell>
    </dl>
  );
}
