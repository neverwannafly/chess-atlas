import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventRowSkeleton } from "@/components/event/EventRow";

export function RowSkeletons({ n = 8 }: { n?: number }) {
  return (
    <div role="status" aria-label="Loading tournaments">
      <div className="flex h-11 items-center border-b border-border px-1 lg:px-3"><div className="skeleton h-4 w-28 rounded-sm" /></div>
      <div className="divide-y divide-border/70">
        {Array.from({ length: n }, (_, i) => <div key={i} style={{ opacity: 1 - i * 0.09 }}><EventRowSkeleton /></div>)}
      </div>
    </div>
  );
}

/** A tiny dot-matrix glyph used by the empty and error states, echoing the atlas. */
function DotGlyph({ tone = "muted" }: { tone?: "muted" | "danger" }) {
  const lit = new Set(tone === "danger" ? [6, 8, 12, 16, 18] : [2, 7, 12, 13, 17]);
  return (
    <svg viewBox="0 0 50 50" className="mx-auto h-12 w-12" aria-hidden>
      {Array.from({ length: 25 }, (_, i) => (
        <circle key={i} cx={5 + (i % 5) * 10} cy={5 + Math.floor(i / 5) * 10} r={lit.has(i) ? 3.2 : 2} fill={lit.has(i) ? (tone === "danger" ? "var(--danger)" : "var(--accent)") : "var(--atlas-dot)"} />
      ))}
    </svg>
  );
}

export interface Relaxation {
  label: string;
  count: number;
  onClick: () => void;
}

export function EmptyState({ suggestions, onClear, title = "No tournaments match", hint }: { suggestions: Relaxation[]; onClear: () => void; title?: string; hint?: string }) {
  return (
    <div className="px-4 py-16 text-center">
      <DotGlyph />
      <h2 className="mt-5 text-h3 font-semibold tracking-h3 text-fg">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-body text-muted">{hint ?? (suggestions.length ? "Loosen one filter. Each option below says how many tournaments it brings back." : "Try a different search.")}</p>
      {suggestions.length > 0 && (
        <ul className="mx-auto mt-6 max-w-sm divide-y divide-border overflow-hidden rounded-md border border-border bg-surface text-left shadow-e1">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button type="button" onClick={s.onClick} className="flex h-11 w-full items-center gap-3 px-4 text-ui text-fg transition-colors hover:bg-surface-2">
                <span className="truncate">{s.label}</span>
                <span className="ml-auto shrink-0 text-small tabular-nums text-accent">+{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-5" variant="secondary" onClick={onClear}><RotateCcw aria-hidden />Clear all filters</Button>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="px-4 py-16 text-center">
      <DotGlyph tone="danger" />
      <h2 className="mt-5 flex items-center justify-center gap-2 text-h3 font-semibold tracking-h3 text-fg">
        <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />
        Couldn't load tournaments
      </h2>
      <p className="mx-auto mt-1.5 max-w-sm text-body text-muted">{message ?? "The server didn't respond."}</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}><RotateCcw aria-hidden />Try again</Button>
    </div>
  );
}
