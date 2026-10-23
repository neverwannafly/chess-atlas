import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Insights } from "@/types/event";
import { formatMonthLabel, formatWeekday, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { seq, useReveal, useTip, useWidth } from "./viz";
import { Card, Tip, TipBody } from "./primitives";

/** In-play count → level 0–5. Thresholds follow the real spread (most days have 1–6 events). */
const LEVELS = [1, 2, 4, 7, 10];
const levelOf = (n: number) => LEVELS.reduce((l, t, i) => (n >= t ? i + 1 : l), 0);
const levelColor = (l: number) => (l === 0 ? "var(--surface-2)" : seq((l - 1) / (LEVELS.length - 1)));
const WD = ["M", "T", "W", "T", "F", "S", "S"];

function monthRange(from: string, n: number): string[] {
  let [y, m] = from.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export function CalendarHeatmap({ data, scope }: { data: Insights; scope: "upcoming" | "all" }) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [revealRef, shown, reduce] = useReveal<HTMLDivElement>(0.15);
  const { tip, show, hide } = useTip();
  const navigate = useNavigate();
  const box = wrapRef;
  // Stagger only the entrance; afterwards hover feedback must be instant.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setSettled(true), 1600);
    return () => clearTimeout(t);
  }, [shown]);

  const byDate = useMemo(() => new Map(data.days.map((d) => [d.date, d])), [data.days]);
  const thisMonth = data.today.slice(0, 7);
  const months = useMemo(() => {
    const all = data.months.map((m) => m.month);
    if (scope === "all") return all;
    // From this month through the last month that has anything starting, at most 8.
    const ahead = all.filter((m) => m >= thisMonth);
    const lastWith = [...data.months].reverse().find((m) => m.total > 0 && m.month >= thisMonth)?.month ?? thisMonth;
    const n = Math.min(6, Math.max(3, ahead.indexOf(lastWith) + 1));
    return monthRange(thisMonth, n);
  }, [data.months, scope, thisMonth]);

  const busiest = useMemo(() => {
    const inRange = data.days.filter((d) => months.includes(d.date.slice(0, 7)));
    return inRange.reduce<(typeof inRange)[number] | null>((a, d) => (!a || d.inPlay > a.inPlay ? d : a), null);
  }, [data.days, months]);

  const cols = width >= 1000 ? 6 : width >= 700 ? 4 : width >= 480 ? 3 : 2;

  return (
    <Card
      id="almanac"
      eyebrow="The almanac"
      title="Days with tournaments in play"
      note={
        <>
          Each square is a day, shaded by how many tournaments are running.
          {busiest && <> Busiest: <span className="text-fg">{formatWeekday(busiest.date)}</span>, with {pluralize(busiest.inPlay, "event")} on.</>}
        </>
      }
      action={
        <div className="flex items-center gap-1.5 text-label text-subtle" aria-hidden>
          Fewer
          {[0, 1, 2, 3, 4, 5].map((l) => <span key={l} className="h-3 w-3 rounded-[3px]" style={{ background: levelColor(l) }} />)}
          More
        </div>
      }
    >
      <div ref={revealRef}>
        <div ref={wrapRef} className="relative" onPointerLeave={hide}>
          <div className="grid gap-x-5 gap-y-6 sm:gap-x-7" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {months.map((ym, mi) => {
              const [y, mo] = ym.split("-").map(Number);
              const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
              const lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
              const starting = data.months.find((m) => m.month === ym)?.total ?? 0;
              return (
                <div key={ym} className="min-w-0">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className={cn("text-small font-medium", ym === thisMonth ? "text-fg" : "text-muted")}>{formatMonthLabel(ym)}</h3>
                    <span className="text-label text-subtle tabular-nums">{starting}</span>
                  </div>
                  <div className="grid grid-cols-7 gap-[3px]" role="grid" aria-label={formatMonthLabel(ym)}>
                    {WD.map((w, i) => <span key={i} aria-hidden className="pb-0.5 text-center text-[10px] leading-none text-subtle">{w}</span>)}
                    {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
                    {Array.from({ length: days }, (_, di) => {
                      const date = `${ym}-${String(di + 1).padStart(2, "0")}`;
                      const d = byDate.get(date);
                      const n = d?.inPlay ?? 0;
                      const lvl = levelOf(n);
                      const isToday = date === data.today;
                      const past = date < data.today;
                      const label = `${formatWeekday(date)}: ${n ? `${pluralize(n, "tournament")} in play${d?.starting ? `, ${d.starting} starting` : ""}` : "no tournaments"}`;
                      const open = (e: { pointerType?: string }, el: HTMLElement) => {
                        const r = el.getBoundingClientRect();
                        const c = box.current!.getBoundingClientRect();
                        show(e, {
                          x: r.left - c.left + r.width / 2,
                          y: r.top - c.top + r.height / 2,
                          content: (
                            <TipBody
                              title={formatWeekday(date)}
                              rows={n ? [{ key: "in play", value: n, color: levelColor(lvl), line: false }, ...(d?.starting ? [{ key: "starting", value: d.starting }] : [])] : [{ key: "", value: "No tournaments" }]}
                              foot={n ? "Select to see them" : undefined}
                            />
                          ),
                        });
                      };
                      return (
                        <button
                          key={date}
                          type="button"
                          role="gridcell"
                          aria-label={label}
                          disabled={!n}
                          onClick={() => navigate(`/?from=${date}&to=${date}${past ? "&past=1" : ""}`)}
                          onPointerEnter={(e) => open(e, e.currentTarget)}
                          onFocus={(e) => open({}, e.currentTarget)}
                          onBlur={() => hide()}
                          className={cn(
                            "aspect-square w-full rounded-[3px] outline-offset-1 transition-[opacity,transform] duration-500 ease-out enabled:hover:scale-[1.18] enabled:hover:shadow-e2 disabled:cursor-default",
                            isToday && "ring-[1.5px] ring-fg ring-offset-1 ring-offset-surface",
                            past && !isToday && "opacity-60",
                          )}
                          style={{
                            background: levelColor(lvl),
                            opacity: shown ? undefined : 0,
                            transform: shown ? undefined : "scale(0.4)",
                            transitionDelay: shown && !reduce && !settled ? `${Math.min(mi, 7) * 60 + di * 9}ms` : "0ms",
                            transitionDuration: settled ? "160ms" : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <Tip tip={tip} width={width} />
        </div>
      </div>
    </Card>
  );
}
