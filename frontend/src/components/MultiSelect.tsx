import { useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FacetCount } from "@/types/event";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  options: FacetCount[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchPlaceholder?: string;
}

export function MultiSelect({ label, options, selected, onChange, searchPlaceholder }: Props) {
  const [open, setOpen] = useState(false);
  // selected values missing from facets (e.g. from a shared URL) should still be listed
  const merged = [...options, ...selected.filter((s) => !options.some((o) => o.value === s)).map((value) => ({ value, count: 0 }))];
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border-2 bg-surface px-3 text-sm font-semibold hover:border-accent",
          selected.length ? "border-accent text-accent" : "border-ink/15"
        )}
        aria-label={`${label}${selected.length ? `, ${selected.length} selected` : ""}`}
      >
        {label}
        {selected.length > 0 && <span className="rounded bg-accent px-1.5 text-xs text-accent-ink">{selected.length}</span>}
        <ChevronDown className="h-4 w-4 opacity-60" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Command label={label} filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <Command.Input placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}…`} className="h-11 w-full border-b border-line bg-transparent px-3 text-sm outline-none placeholder:text-muted" />
          <Command.List className="max-h-64 overflow-y-auto p-1">
            <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Nothing found.</Command.Empty>
            {merged.map((o) => {
              const on = selected.includes(o.value);
              return (
                <Command.Item
                  key={o.value}
                  value={o.value}
                  onSelect={() => toggle(o.value)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-sunk"
                >
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-accent bg-accent text-accent-ink" : "border-line")}>
                    {on && <Check className="h-3 w-3" aria-hidden />}
                  </span>
                  <span className="flex-1 truncate">{o.value}</span>
                  <span className="text-xs text-muted">{o.count}</span>
                </Command.Item>
              );
            })}
          </Command.List>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="w-full cursor-pointer border-t border-line px-3 py-2 text-left text-[13px] text-muted hover:text-ink">
              Clear selection
            </button>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
