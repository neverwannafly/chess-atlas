import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardSkeletons, ErrorState } from "@/components/States";
import { EventCard } from "@/components/EventCard";
import { useEventsPage } from "@/hooks/queries";
import { toQuery, type Filters } from "@/lib/filters";
import { addDays, formatMonthLabel, formatWeekday, todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shiftMonth(ym: string, delta: number) {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function CalendarView({ filters, update }: { filters: Filters; update: (p: Partial<Filters>) => void }) {
  const today = todayIST();
  const month = filters.month ?? today.slice(0, 7);
  const first = `${month}-01`;
  const lastDay = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, "0")}`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && picked.startsWith(month) ? picked : month === today.slice(0, 7) ? today : first;

  const query = toQuery(filters, {
    from: first, to: last, pageSize: 200, sort: "startDate",
    status: filters.status.length ? filters.status : ["upcoming", "ongoing", "past"],
  });
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useEventsPage(query);

  const byDay = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["data"]>();
    for (const e of data?.data ?? []) {
      for (let d = e.startDate < first ? first : e.startDate; d <= e.endDate && d <= last; d = addDays(d, 1)) {
        m.set(d, [...(m.get(d) ?? []), e]);
      }
    }
    return m;
  }, [data, first, last]);

  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: lastDay }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const dayEvents = byDay.get(selected) ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-3xl font-extrabold" aria-live="polite">{formatMonthLabel(month)}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => update({ month: shiftMonth(month, -1) })}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-10" onClick={() => update({ month: undefined })}>Today</Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => update({ month: shiftMonth(month, 1) })}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isPending ? (
        <CardSkeletons n={2} />
      ) : (
        <div className={cn(isPlaceholderData && "opacity-60 transition-opacity")}>
          <div role="grid" aria-label={formatMonthLabel(month)} className="overflow-hidden rounded-lg border-2 border-ink/20 bg-surface">
            <div role="row" className="grid grid-cols-7 border-b border-line bg-sunk text-center text-[13px] font-bold text-muted">
              {DOW.map((d) => <div key={d} role="columnheader" className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} className="min-h-14 border-b border-r border-line bg-sunk/40 sm:min-h-24" />;
                const evs = byDay.get(d) ?? [];
                const isSel = d === selected;
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-label={`${formatWeekday(d)}, ${evs.length} tournaments`}
                    onClick={() => setPicked(d)}
                    className={cn("flex min-h-14 cursor-pointer flex-col items-start gap-0.5 border-b border-r border-line p-1 text-left sm:min-h-24 sm:p-1.5", isSel ? "bg-accent-soft ring-2 ring-inset ring-accent" : "hover:bg-sunk/60")}
                  >
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded text-xs font-bold", d === today && "bg-accent text-accent-ink")}>{+d.slice(8)}</span>
                    <span className="hidden w-full flex-col gap-0.5 sm:flex">
                      {evs.slice(0, 2).map((e) => <span key={e.eventCode} className="truncate rounded bg-accent px-1 text-[11px] font-semibold text-accent-ink">{e.name}</span>)}
                      {evs.length > 2 && <span className="px-1 text-[11px] text-muted">+{evs.length - 2} more</span>}
                    </span>
                    {evs.length > 0 && <span className="mt-auto flex gap-0.5 sm:hidden">{evs.slice(0, 3).map((e) => <span key={e.eventCode} className="h-1.5 w-1.5 rounded-full bg-accent" />)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <section className="mt-5" aria-label={`Tournaments on ${formatWeekday(selected)}`}>
            <h3 className="mb-3 font-display text-2xl font-bold">{formatWeekday(selected)}</h3>
            {dayEvents.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{dayEvents.map((e, i) => <EventCard key={e.eventCode} e={e} index={i} />)}</div>
            ) : (
              <p className="text-muted">No tournaments on this day. <button type="button" className="cursor-pointer text-accent underline" onClick={() => update({ view: "list" })}>Switch to list view</button> to browse everything.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
