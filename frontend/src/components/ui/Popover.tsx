import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A filter trigger with an anchored panel. Lightweight on purpose: click-outside and Esc close it,
 * focus returns to the trigger, and the panel is a labelled dialog region.
 */
export function Popover({ label, value, active, showValue, children, align = "start", width = "w-[340px]", onOpenChange }: {
  label: string;
  /** Summary shown in the trigger when the filter is set. */
  value?: string | null;
  active?: boolean;
  /** Show the value even when the filter is at its default (e.g. the current sort). */
  showValue?: boolean;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  width?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const setOpen = (v: boolean) => { setOpenState(v); onOpenChange?.(v); };
  const [refocus, setRefocus] = useState(0);
  const close = () => { setOpen(false); setRefocus((n) => n + 1); };
  useEffect(() => { if (refocus) btn.current?.focus(); }, [refocus]);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) { setOpenState(false); onOpenChange?.(false); } };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpenState(false); onOpenChange?.(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open, onOpenChange]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-sm border px-3 text-ui font-medium transition-[background-color,border-color,color] duration-[var(--dur-1)]",
          active ? "border-accent/40 bg-accent-soft text-fg" : "border-border-strong/70 bg-surface text-fg hover:border-border-strong hover:bg-surface-2",
          open && !active && "border-border-strong bg-surface-2"
        )}
      >
        <span className={cn((active || showValue) && value ? "text-muted" : undefined)}>{label}</span>
        {(active || showValue) && value && <span className="max-w-[16ch] truncate text-fg">{value}</span>}
        <ChevronDown className={cn("h-3.5 w-3.5 text-subtle transition-transform duration-[var(--dur-2)]", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            role="dialog"
            aria-label={label}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
            className={cn(
              "absolute top-[calc(100%+8px)] z-50 rounded-md border border-border bg-surface p-4 shadow-e3",
              align === "end" ? "right-0 origin-top-right" : "left-0 origin-top-left",
              width
            )}
          >
            {typeof children === "function" ? children(close) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
