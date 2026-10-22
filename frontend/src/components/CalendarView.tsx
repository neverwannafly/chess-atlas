import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/States";
import { EventRow } from "@/components/event/EventRow";
import { useEventsPage } from "@/hooks/queries";
import { displayName } from "@/lib/eventFacts";
import { toQuery, type Filters } from "@/lib/filters";
import { addDays, formatMonthLabel, formatWeekday, pluralize, todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function shiftMonth(ym: string, delta: number) {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function CalendarView({ filters, update, onOpen }: { filters: Filters; update: (p: Partial<Filters>) => void; onOpen: (code: string) => void }) {
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
  while (cells.length % 7) cells.push(null);
  const dayEvents = byDay.get(selected) ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-h3" aria-live="polite">
          {formatMonthLabel(month)}
          {data && <span className="ml-2 text-small font-normal text-muted">{pluralize(data.meta.total, "tournament")}</span>}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" aria-label="Previous month" onClick={() => update({ month: shiftMonth(month, -1) })}><ChevronLeft aria-hidden /></Button>
          <Button variant="secondary" onClick={() => update({ month: undefined })}>Today</Button>
          <Button variant="secondary" size="icon" aria-label="Next month" onClick={() => update({ month: shiftMonth(month, 1) })}><ChevronRight aria-hidden /></Button>
        </div>
      </div>
      {isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="skeleton h-96 w-full rounded-md" aria-hidden />
      ) : (
        <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
          <div role="grid" aria-label={formatMonthLabel(month)} className="overflow-hidden rounded-md border border-border bg-surface">
            <div role="row" className="grid grid-cols-7 border-b border-border">
              {DOW.map((d) => <div key={d} role="columnheader" className="py-2 pl-2.5 text-label font-medium text-muted">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
              {cells.map((d, i) => {
                if (!d) return <div key={`b${i}`} className="min-h-14 border-b border-r border-border bg-surface-2/50 sm:min-h-24" aria-hidden />;
                const evs = byDay.get(d) ?? [];
                const isSel = d === selected;
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    aria-selected={isSel}
                    aria-label={`${formatWeekday(d)}, ${pluralize(evs.length, "tournament")}`}
                    onClick={() => setPicked(d)}
                    className={cn(
                      "relative flex min-h-14 flex-col items-start gap-1 border-b border-r border-border p-1.5 text-left transition-colors sm:min-h-24 sm:p-2",
                      isSel ? "bg-accent-soft" : "hover:bg-surface-2",
                      d < today && "text-muted"
                    )}
                  >
                    {isSel && <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-accent" aria-hidden />}
                    <span className={cn("flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-small font-medium", isToday && "bg-accent text-accent-fg")}>{+d.slice(8)}</span>
                    <span className="hidden w-full flex-col gap-0.5 sm:flex">
                      {evs.slice(0, 2).map((e) => (
                        <span key={e.eventCode} className="truncate rounded-[4px] border-l-2 border-accent bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium leading-tight text-fg">{displayName(e.name)}</span>
                      ))}
                      {evs.length > 2 && <span className="px-1 text-[11px] text-muted">+{evs.length - 2} more</span>}
                    </span>
                    {evs.length > 0 && (
                      <span className="mt-auto flex gap-0.5 sm:hidden" aria-hidden>
                        {evs.slice(0, 3).map((e) => <span key={e.eventCode} className="h-1 w-1 rounded-full bg-accent" />)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <section className="mt-6" aria-label={`Tournaments on ${formatWeekday(selected)}`}>
            <h3 className="mb-3 flex items-baseline gap-2 text-[15px] font-semibold tracking-h3">
              {formatWeekday(selected)}
              <span className="text-small font-normal text-muted">{pluralize(dayEvents.length, "tournament")}</span>
            </h3>
            {dayEvents.length ? (
              <ul className="space-y-2">{dayEvents.map((e) => <li key={e.eventCode}><EventRow e={e} onOpen={onOpen} /></li>)}</ul>
            ) : (
              <p className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center text-body text-muted">
                Nothing on this day. Pick another date, or{" "}
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => update({ view: "cards" })}>see the full list</button>.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

