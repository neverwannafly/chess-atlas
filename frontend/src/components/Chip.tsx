import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Toggle chip (aria-pressed). */
export function Chip({ pressed, className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-3 text-ui font-medium transition-colors duration-[var(--dur-1)]",
        pressed ? "border-accent/60 bg-accent-soft text-accent" : "border-border-strong bg-surface text-fg hover:bg-surface-2",
        className
      )}
      {...props}
    >
      {pressed && <Check className="-ml-0.5 h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />}
      {children}
    </button>
  );
}

/** Segmented control, single choice. */
export function Segmented<T extends string>({ label, options, value, onChange, className }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex h-8 shrink-0 items-center rounded-sm border border-border-strong bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-full items-center rounded-[4px] px-2.5 text-ui font-medium transition-colors duration-[var(--dur-1)]",
              on ? "bg-surface text-fg shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--border)]" : "text-muted hover:text-fg"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
