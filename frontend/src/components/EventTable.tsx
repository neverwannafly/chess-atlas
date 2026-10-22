import { Link } from "react-router-dom";
import type { EventSummary } from "@/types/event";
import { formatDateRange, formatInr, formatInrFull, location } from "@/lib/format";
import { Pill, StartIndicator } from "@/components/EventBits";

export function EventTable({ events }: { events: EventSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-ink/15 bg-surface">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <caption className="sr-only">Tournaments</caption>
        <thead className="border-b-2 border-ink/20 bg-sunk text-[13px] text-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">Dates</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">Tournament</th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold md:table-cell">Format</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">Prize</th>
            <th scope="col" className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Fee</th>
            <th scope="col" className="hidden px-3 py-2.5 font-semibold lg:table-cell">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {events.map((e) => (
            <tr key={e.eventCode} className="relative hover:bg-sunk/60 focus-within:bg-sunk/60">
              <td className="whitespace-nowrap px-3 py-2.5 font-display text-lg font-bold">{formatDateRange(e.startDate, e.endDate)}</td>
              <td className="px-3 py-2.5">
                <Link to={`/events/${e.eventCode}`} className="font-display text-lg font-bold leading-tight after:absolute after:inset-0 after:content-['']">{e.name}</Link>
                <div className="text-[13px] text-muted">{location(e)}</div>
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 md:table-cell">
                <div className="flex gap-1.5">{e.timeControlType && <Pill>{e.timeControlType}</Pill>}{e.fideRated && <Pill tone="accent">FIDE</Pill>}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold" title={e.totalPrizeInr != null ? formatInrFull(e.totalPrizeInr) : undefined}>{formatInr(e.totalPrizeInr && e.totalPrizeInr > 0 ? e.totalPrizeInr : null)}</td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-right sm:table-cell" title={e.entryFeeMinInr != null ? formatInrFull(e.entryFeeMinInr) : undefined}>{formatInr(e.entryFeeMinInr)}</td>
              <td className="hidden px-3 py-2.5 lg:table-cell"><StartIndicator e={e} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
