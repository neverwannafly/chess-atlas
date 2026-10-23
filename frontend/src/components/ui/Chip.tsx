import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** A pressable pill: toggles a boolean filter or picks a preset. Shows an optional live count. */
export function Chip({ pressed, onClick, children, count, className, size = "md" }: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
  className?: string;
  size?: "md" | "lg";
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border font-medium transition-[background-color,border-color,color,opacity] duration-[var(--dur-1)]",
        size === "lg" ? "h-11 px-3.5 text-ui" : "h-9 px-3 text-ui",
        pressed ? "border-accent/40 bg-accent-soft text-fg" : "border-border-strong/70 bg-surface text-fg hover:border-border-strong hover:bg-surface-2",
        count === 0 && !pressed && "opacity-45",
        className
      )}
    >
      <span
        className={cn(
          "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-colors",
          pressed ? "border-accent bg-accent text-accent-fg" : "border-border-strong bg-surface"
        )}
        aria-hidden
      >
        {pressed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      {children}
      {count != null && <span className="text-small tabular-nums text-muted">{count}</span>}
    </button>
  );
}

/** Small removable tag for an active filter. */
export function Tag({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface pl-2.5 pr-1 text-small font-medium text-fg shadow-e1">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-subtle transition-colors hover:bg-surface-3 hover:text-fg"
      >
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </span>
  );
}
