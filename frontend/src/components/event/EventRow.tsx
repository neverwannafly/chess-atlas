import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { EventSummary } from "@/types/event";
import { Badge, StatusBadge } from "@/components/Badge";
import { FactCell } from "@/components/event/Facts";
import { useEvent } from "@/hooks/queries";
import { useSeen } from "@/hooks/useInView";
import { deriveFacts, displayName } from "@/lib/eventFacts";
import { cn } from "@/lib/utils";

/** Fixed desktop columns so facts line up from row to row; a missing fact leaves its column blank. */
const COLS = "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]";

export function EventRow({ e, onOpen }: { e: EventSummary; onOpen?: (code: string) => void }) {
  const [ref, seen] = useSeen<HTMLElement>("300px");
  // Pull the full brochure data once the row is near the viewport: raw time control, fee range, 1st prize.
  const { data: detail } = useEvent(e.eventCode, seen && e.extractionStatus === "done");
  const f = deriveFacts(e, detail);
  const past = f.status.tone === "past";
  const name = displayName(e.name);
  const loc = [e.city, e.state].filter(Boolean).join(", ");

  const click = (ev: React.MouseEvent) => {
    if (!onOpen || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    onOpen(e.eventCode);
  };

  return (
    <article
      ref={ref}
      className={cn(
        "group relative rounded-md border border-border bg-surface transition-[border-color,box-shadow] duration-[var(--dur-1)] hover:border-border-strong hover:shadow-e1 focus-within:border-border-strong",
        past && "opacity-70"
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 sm:px-5 sm:pt-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={f.status} />
            {f.fide && <Badge tone="outline">FIDE rated</Badge>}
          </div>
          <h3 className="text-h3 font-semibold tracking-h3">
            <Link
              to={`/events/${e.eventCode}`}
              onClick={click}
              className="rounded-sm after:absolute after:inset-0 after:rounded-md after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {name}
            </Link>
          </h3>
          <p className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 text-small text-muted">
            {e.venueName && <span className="truncate">{e.venueName}</span>}
            {e.venueName && loc && <span className="text-subtle" aria-hidden>/</span>}
            <span className="truncate">{loc || "Venue to be announced"}</span>
          </p>
        </div>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </div>

      <dl className={cn("mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border px-4 py-3 sm:grid-cols-3 sm:px-5", COLS)}>
        <FactCell label="When" fact={f.when} className="lg:col-start-1" />
        {f.hasDetails ? (
          <>
            {f.timeControl && <FactCell label="Time control" fact={f.timeControl} className="lg:col-start-2" />}
            {f.prize && <FactCell label="Prize fund" fact={f.prize} className="lg:col-start-3" />}
            {f.fee && <FactCell label="Entry" fact={f.fee} className="lg:col-start-4" />}
            {f.registration && <FactCell label="Registration" fact={f.registration} className="lg:col-start-5" />}
          </>
        ) : (
          <div className="col-span-1 self-center text-small text-muted sm:col-span-2 lg:col-span-4 lg:col-start-2">
            {e.extractionStatus === "no_brochure"
              ? "Brochure not published yet. Prizes, fees and schedule appear here once it is."
              : "Brochure published. Prizes and fees are being read from it."}
          </div>
        )}
      </dl>
    </article>
  );
}

export function EventRowSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface" aria-hidden>
      <div className="space-y-2 px-5 pt-4">
        <div className="skeleton h-[22px] w-24 rounded-sm" />
        <div className="skeleton h-5 w-3/4 rounded-sm" />
        <div className="skeleton h-4 w-1/3 rounded-sm" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border px-5 py-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="skeleton h-3 w-12 rounded-sm" />
            <div className="skeleton h-4 w-20 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
