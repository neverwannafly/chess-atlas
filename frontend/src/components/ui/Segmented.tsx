import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Radio-style segmented control with a sliding thumb. Options with zero results dim but stay pickable. */
export function Segmented<T extends string>({ label, value, options, onChange, size = "md", className, stretch }: {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  size?: "md" | "lg";
  className?: string;
  stretch?: boolean;
}) {
  const id = useId();
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const n = options[(i + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
    onChange(n.value);
    (e.currentTarget.querySelector(`[data-v="${n.value}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn("relative inline-flex items-center rounded-sm border border-border-strong/70 bg-surface-2 p-0.5", stretch && "flex w-full", className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-v={o.value}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[5px] font-medium transition-colors duration-[var(--dur-1)]",
              size === "lg" ? "h-10 px-3 text-ui" : "h-8 px-3 text-ui",
              stretch && "flex-1",
              on ? "text-fg" : "text-muted hover:text-fg",
              o.count === 0 && !on && "opacity-45"
            )}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[5px] border border-border bg-surface shadow-e1"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                aria-hidden
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count != null && <span className={cn("relative text-small tabular-nums", on ? "text-muted" : "text-subtle")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
