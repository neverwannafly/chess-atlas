import { Link } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useNow } from "@/hooks/crQueries";
import { absoluteTime, relativeTime } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

export interface Source { name: string; href: string }

export const SOURCES = {
  chessResults: { name: "chess-results.com", href: "https://chess-results.com/" },
  fide: { name: "FIDE rating list", href: "https://ratings.fide.com/download_lists.phtml" },
  aicf: { name: "AICF calendar", href: "https://aicf.in/all-events/" },
} satisfies Record<string, Source>;

/**
 * The source and freshness line every data block carries (docs/PRODUCT.md, trust rule 1):
 * "Data: chess-results.com · refreshed 12 minutes ago". Pass `refreshedAt={undefined}` to omit the time.
 */
export function SourceLine({ sources, refreshedAt, verb = "refreshed", live, failed, className, children }: {
  sources: Source[];
  refreshedAt?: string | number | null;
  verb?: string;
  live?: boolean;
  failed?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const now = useNow();
  const rel = relativeTime(refreshedAt, now);
  const iso = refreshedAt == null ? undefined : new Date(refreshedAt).toISOString();
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-small text-muted", className)}>
      <span>
        Data:{" "}
        {sources.map((s, i) => (
          <span key={s.href + s.name}>
            {i > 0 && (i === sources.length - 1 ? " and " : ", ")}
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-border-strong underline-offset-[3px] transition-colors hover:decoration-fg">{s.name}</a>
          </span>
        ))}
      </span>
      {refreshedAt !== undefined && (
        <>
          <span className="text-subtle" aria-hidden>·</span>
          <span className="inline-flex items-center gap-1" title={iso ? `${absoluteTime(iso)} IST` : undefined}>
            {live && <RefreshCw className="h-3 w-3 text-subtle" aria-hidden />}
            {rel ? <>{verb} <time dateTime={iso}>{rel}</time></> : `not ${verb} yet`}
          </span>
        </>
      )}
      {live && <span className="text-subtle">· page re-checks every minute</span>}
      {failed && (
        <span className="inline-flex items-center gap-1 text-warn">
          <AlertTriangle className="h-3 w-3" aria-hidden />last refresh failed
        </span>
      )}
      {children}
    </p>
  );
}

/** Outline "Beta" pill beside the wordmark; leads to the privacy notice, which explains the beta. */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <Link
      to="/privacy"
      title="Chess Atlas is in beta. Some details are still being completed."
      className={cn("inline-flex h-5 items-center rounded-sm border border-border-strong px-1.5 text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-muted transition-colors hover:text-fg", className)}
    >
      Beta
    </Link>
  );
}

/** Dashed empty state used across pages: optional piece art, a title, a hint and one action. */
export function EmptyNote({ title, children, action, piece, className }: { title?: string; children?: React.ReactNode; action?: React.ReactNode; piece?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-md border border-dashed border-border-strong px-6 py-12 text-center", className)}>
      {piece && <img src={`/pieces/cburnett/${piece}.svg`} alt="" className="mb-4 h-12 w-12 opacity-80" />}
      {title && <h3 className="text-h3 font-semibold tracking-h3 text-fg">{title}</h3>}
      {children && <div className={cn("max-w-sm text-body text-muted", title && "mt-1.5")}>{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
