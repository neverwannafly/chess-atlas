import { ArrowUpRight } from "lucide-react";
import type { CrStatus } from "@/types/chessresults";
import { Badge } from "@/components/Badge";
import { SourceLine } from "@/components/Trust";
import { CR_SOURCE } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

/** Ongoing, upcoming and finished each have their own status colour (docs/DESIGN_SYSTEM.md). */
export function StatusPill({ status, className }: { status: CrStatus; className?: string }) {
  if (status === "ongoing")
    return (
      <Badge tone="live" className={className}>
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-live" aria-hidden />Live
      </Badge>
    );
  if (status === "upcoming")
    return (
      <Badge tone="upcoming" className={className}>
        <span className="h-1.5 w-1.5 rounded-full border-[1.5px] border-upcoming" aria-hidden />Upcoming
      </Badge>
    );
  return <Badge tone="finished" className={className}>Finished</Badge>;
}

export function TitleBadge({ title }: { title: string | null | undefined }) {
  if (!title) return null;
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-[4px] border border-border-strong px-1.5 font-mono text-[11px] font-semibold tracking-[0.04em] text-fg" title={`FIDE title: ${title}`}>
      {title}
    </span>
  );
}

export function ExternalLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1 rounded-sm underline decoration-border-strong underline-offset-[3px] transition-colors hover:text-fg hover:decoration-fg", className)}>
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** "Data: chess-results.com · refreshed 4 minutes ago". Always shown next to mirrored data. */
export function SourceNote({ refreshedAt, className, live, failed, href = CR_SOURCE.url, children }: { refreshedAt: string | null | undefined; className?: string; live?: boolean; failed?: boolean; href?: string; children?: React.ReactNode }) {
  return (
    <SourceLine sources={[{ name: CR_SOURCE.name, href }]} refreshedAt={refreshedAt} live={live} failed={failed} className={className}>
      {children}
    </SourceLine>
  );
}

export function PageHead({ eyebrow, title, children, aside }: { eyebrow?: React.ReactNode; title: string; children?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-end sm:justify-between sm:pt-12">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 flex items-center gap-2 text-label font-medium uppercase tracking-[0.08em] text-muted">{eyebrow}</p>}
        <h1 className="text-title font-semibold tracking-h1 sm:text-[36px] sm:leading-[1.12]">{title}</h1>
        {children && <div className="mt-2 max-w-[62ch] text-body text-muted">{children}</div>}
      </div>
      {aside}
    </header>
  );
}
