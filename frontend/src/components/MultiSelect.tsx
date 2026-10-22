import { Command } from "cmdk";
import { Check, Search } from "lucide-react";
import type { FacetCount } from "@/types/event";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  options: FacetCount[];
  selected: string[];
  onChange: (v: string[]) => void;
}

/** Inline, searchable checklist (used inside the filter sheet). */
export function MultiSelect({ label, options, selected, onChange }: Props) {
  // values from a shared URL that aren't in the current facets should still be listed
  const merged = [...options, ...selected.filter((s) => !options.some((o) => o.value === s)).map((value) => ({ value, count: 0 }))];
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Command label={label} className="overflow-hidden rounded-md border border-border-strong bg-surface" filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
        <Command.Input placeholder={`Search ${label.toLowerCase()}`} className="h-9 w-full bg-transparent text-ui outline-none placeholder:text-subtle" />
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="shrink-0 text-small text-muted hover:text-fg">Clear</button>
        )}
      </div>
      <Command.List className="max-h-48 overflow-y-auto overscroll-contain p-1">
        <Command.Empty className="px-3 py-4 text-center text-small text-muted">No matches.</Command.Empty>
        {merged.map((o) => {
          const on = selected.includes(o.value);
          return (
            <Command.Item
              key={o.value}
              value={o.value}
              onSelect={() => toggle(o.value)}
              className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-ui data-[selected=true]:bg-surface-2"
            >
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border", on ? "border-accent bg-accent text-accent-fg" : "border-border-strong")} aria-hidden>
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="flex-1 truncate">{o.value}{on && <span className="sr-only"> (chosen)</span>}</span>
              {o.count > 0 && <span className="text-small text-muted">{o.count}</span>}
            </Command.Item>
          );
        })}
      </Command.List>
    </Command>
  );
}
