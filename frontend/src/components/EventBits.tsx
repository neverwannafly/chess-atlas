import type { EventSummary } from "@/types/event";
import { cn } from "@/lib/utils";
import { deadlineDays, deadlineLabel, relativeStart } from "@/lib/format";
import { AlarmClock } from "lucide-react";

export function Pill({ children, tone = "neutral", className, title }: { children: React.ReactNode; tone?: "neutral" | "accent" | "live" | "brass"; className?: string; title?: string }) {
  const tones = {
    neutral: "bg-sunk text-ink",
    accent: "bg-accent-soft text-accent",
    live: "bg-live-soft text-live",
    brass: "bg-brass-soft text-brass",
  };
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StartIndicator({ e }: { e: Pick<EventSummary, "startDate" | "endDate"> }) {
  const r = relativeStart(e.startDate, e.endDate);
  if (r.tone === "past") return <Pill>{r.label}</Pill>;
  if (r.tone === "live")
    return (
      <Pill tone="live">
        <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60 motion-reduce:hidden" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-live" /></span>
        Ongoing
      </Pill>
    );
  return <Pill tone={r.tone === "soon" ? "accent" : "neutral"}>{r.label}</Pill>;
}

export function DeadlineWarning({ deadline, end }: { deadline: string | null; end: string }) {
  const n = deadlineDays(deadline);
  if (n == null || n > 7 || deadline! > end) return null;
  return (
    <Pill tone="brass">
      <AlarmClock className="h-3 w-3" aria-hidden /> Registration {deadlineLabel(n)}
    </Pill>
  );
}

export function TimeControlBadge({ tc }: { tc: string | null }) {
  if (!tc) return null;
  return <Pill>{tc}</Pill>;
}
