import { useState } from "react";
import { ArrowUpRight, CalendarPlus, Check, FileText, Link2, Share2 } from "lucide-react";
import type { EventDetail } from "@/types/event";
import { Button, type ButtonProps } from "@/components/ui/button";
import { calendarUrl } from "@/lib/api";
import { registrationOf } from "@/lib/eventDetail";
import { cn } from "@/lib/utils";

const canShare = () => typeof navigator !== "undefined" && "share" in navigator && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

function useShare(title: string) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (canShare()) {
      try { await navigator.share({ title, url }); return; } catch (err) { if ((err as Error).name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };
  return { share, copied, native: canShare() };
}

export function ShareButton({ title, iconOnly, size, variant = "secondary", className }: { title: string; iconOnly?: boolean; size?: ButtonProps["size"]; variant?: ButtonProps["variant"]; className?: string }) {
  const { share, copied, native } = useShare(title);
  const Icon = copied ? Check : native ? Share2 : Link2;
  return (
    <Button variant={variant} size={iconOnly ? "icon" : size} onClick={share} className={className} aria-label={iconOnly ? (copied ? "Link copied" : "Share this tournament") : undefined} title={iconOnly ? "Share" : undefined}>
      <Icon aria-hidden className={cn(copied && "text-accent")} />
      {!iconOnly && <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>}
      {iconOnly && <span className="sr-only" aria-live="polite">{copied ? "Link copied" : ""}</span>}
    </Button>
  );
}

/** Register (when open) / Brochure / Add to calendar / Share, in priority order. */
export function ActionButtons({ e, name, size = "md", compact, className }: { e: EventDetail; name: string; size?: "sm" | "md" | "lg"; compact?: boolean; className?: string }) {
  const reg = registrationOf(e);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {reg.open && reg.link && (
        <Button asChild size={size}>
          <a href={reg.link} target="_blank" rel="noopener noreferrer">Register<ArrowUpRight aria-hidden /></a>
        </Button>
      )}
      {e.brochureUrl && (
        <Button asChild size={size} variant={reg.open ? "secondary" : "primary"}>
          <a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText aria-hidden />Brochure</a>
        </Button>
      )}
      <Button asChild size={compact ? "icon" : size} variant="secondary" className={cn(compact && size === "sm" && "h-8 w-8")}>
        <a href={calendarUrl(e.eventCode)} download aria-label={compact ? "Add to calendar" : undefined} title={compact ? "Add to calendar" : undefined}>
          <CalendarPlus aria-hidden />{!compact && <><span className="sm:hidden">Calendar</span><span className="max-sm:hidden">Add to calendar</span></>}
        </a>
      </Button>
      <ShareButton title={name} iconOnly={compact} size={size} className={cn(compact && size === "sm" && "h-8 w-8")} />
    </div>
  );
}
