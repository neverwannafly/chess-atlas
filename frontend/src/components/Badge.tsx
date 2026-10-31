import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/eventFacts";

type BadgeTone = "neutral" | "accent" | "warn" | "outline" | "live" | "upcoming" | "finished";

export function Badge({ tone = "neutral", className, children, title }: { tone?: BadgeTone; className?: string; children: React.ReactNode; title?: string }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    outline: "border border-border-strong text-fg",
    live: "bg-live-soft text-live",
    upcoming: "bg-upcoming-soft text-upcoming",
    finished: "bg-finished-soft text-finished",
  };
  return (
    <span title={title} className={cn("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-sm px-2 text-small font-medium leading-none", tones[tone], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: { label: string; tone: Tone } }) {
  if (status.tone === "live")
    return (
      <Badge tone="accent">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        {status.label}
      </Badge>
    );
  return <Badge tone="neutral" className={status.tone === "soon" ? "text-fg" : undefined}>{status.label}</Badge>;
}
