import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { EventSummary } from "@/types/event";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE } from "@/components/event-page/motion";
import { useRelatedEvents } from "@/hooks/queries";
import { displayName, eventPath } from "@/lib/eventFacts";
import { addDays, formatMoney, todayIST } from "@/lib/format";
import { cn } from "@/lib/utils";

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));

function Row({ e, i }: { e: EventSummary; i: number }) {
  const reduce = useReducedMotion();
  const multi = e.startDate !== e.endDate;
  const tc = [e.timeControlType, e.rounds ? `${e.rounds}R` : null].filter(Boolean).join(" · ");
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease: EASE, delay: i * 0.05 }}
    >
      <Link
        to={eventPath(e)}
        viewTransition
        className="group grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-4 rounded-md px-3 py-3 transition-colors hover:bg-surface-2"
      >
        <span className="flex flex-col items-center rounded-sm border border-border bg-surface py-1.5 leading-none">
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted">{fmt(e.startDate, { month: "short" })}</span>
          <span className="mt-1 text-[17px] font-semibold tabular-nums">{Number(e.startDate.slice(8))}</span>
          {multi && <span className="mt-0.5 text-[10px] text-subtle">→{Number(e.endDate.slice(8))}</span>}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-ui font-medium group-hover:text-fg" style={{ viewTransitionName: `event-title-${e.eventCode}` }}>{displayName(e.name)}</span>
          <span className="mt-0.5 block truncate text-small text-muted">
            {[e.city, e.state].filter(Boolean).join(", ") || "Location TBA"}
            {tc && <span className="text-subtle"> · {tc}</span>}
            {e.fideRated && <span className="text-subtle"> · FIDE</span>}
          </span>
        </span>
        <span className="flex items-center gap-3">
          <span className={cn("hidden text-right text-ui font-medium tabular-nums sm:block", !e.totalPrizeInr && "text-subtle")}>{e.totalPrizeInr ? formatMoney(e.totalPrizeInr) : "—"}</span>
          <ArrowRight className="h-4 w-4 text-subtle transition-transform duration-[var(--dur-2)] group-hover:translate-x-0.5 group-hover:text-fg" aria-hidden />
        </span>
      </Link>
    </motion.li>
  );
}

function Column({ title, list, loading, href }: { title: string; list: EventSummary[]; loading: boolean; href: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-3">
        <h3 className="text-ui font-semibold">{title}</h3>
        <Link to={href} className="text-small text-muted hover:text-fg">See all</Link>
      </div>
      {loading ? (
        <div className="space-y-2 px-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
      ) : (
        <ul>{list.map((x, i) => <Row key={x.eventCode} e={x} i={i} />)}</ul>
      )}
    </div>
  );
}

export function MoreTournaments({ e }: { e: EventSummary }) {
  const today = todayIST();
  const { sameState, sameWeek } = useRelatedEvents(e, today);
  const stateList = (sameState.data?.data ?? []).filter((x) => x.eventCode !== e.eventCode).slice(0, 4);
  const taken = new Set([e.eventCode, ...stateList.map((x) => x.eventCode)]);
  const weekList = (sameWeek.data?.data ?? []).filter((x) => !taken.has(x.eventCode) && x.state !== e.state).slice(0, 4);
  const from = e.startDate > today ? e.startDate : today;
  const loadingState = !!e.state && sameState.isPending;
  const showState = loadingState || stateList.length > 0;
  const showWeek = sameWeek.isPending || weekList.length > 0;

  if (!showState && !showWeek)
    return (
      <p className="text-body text-muted">
        Nothing else nearby yet. <Link to="/" className="text-fg underline decoration-border-strong underline-offset-2">Browse every tournament</Link>.
      </p>
    );
  return (
    <div className={cn("grid gap-8", showState && showWeek && "lg:grid-cols-2 lg:gap-10")}>
      {showState && <Column title={`Also in ${e.state}`} list={stateList} loading={loadingState} href={`/?state=${encodeURIComponent(e.state ?? "")}`} />}
      {showWeek && <Column title="The same week elsewhere" list={weekList} loading={sameWeek.isPending} href={`/?from=${from}&to=${addDays(from, 6)}`} />}
    </div>
  );
}
