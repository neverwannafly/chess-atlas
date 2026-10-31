import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The one search input, in two sizes: the hero field and the docked header field. */
export const SearchField = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  size?: "lg" | "sm";
  id: string;
  className?: string;
  placeholder?: string;
  onEnter?: () => void;
  /** Accessible label; defaults to the tournament search. */
  label?: string;
  /** Show the ⌘K hint (only where the global shortcut focuses this field). */
  shortcut?: boolean;
}>(function SearchField({ value, onChange, size = "sm", id, className, placeholder = "Search tournaments, cities, venues", onEnter, label = "Search tournaments", shortcut = true }, ref) {
  const lg = size === "lg";
  return (
    <form
      role="search"
      onSubmit={(e) => { e.preventDefault(); onEnter?.(); }}
      className={cn("group relative min-w-0", className)}
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <Search className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle transition-colors group-focus-within:text-accent", lg ? "left-4 h-[18px] w-[18px]" : "left-3 h-4 w-4")} aria-hidden />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") { if (value) onChange(""); else e.currentTarget.blur(); } }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={cn(
          "w-full rounded-md border border-border-strong/80 bg-surface text-fg outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden",
          lg ? "h-12 pl-11 pr-16 text-body shadow-e2" : "h-9 rounded-sm pl-9 pr-12 text-ui shadow-e1"
        )}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={cn("absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-sm text-muted hover:bg-surface-2 hover:text-fg", lg ? "right-2 h-8 w-8" : "right-1 h-7 w-7")}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : shortcut && (
        <kbd
          className={cn(
            "pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-[5px] border border-border bg-surface-2 font-mono text-muted sm:flex",
            lg ? "right-3 h-6 px-1.5 text-[12px]" : "right-2 h-5 px-1 text-[11px]"
          )}
          aria-hidden
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}
    </form>
  );
});
