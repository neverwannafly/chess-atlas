import { X } from "lucide-react";
import { activePreset, feeLabel, prizeLabel, type Filters } from "@/lib/filters";
import { formatDayMonth } from "@/lib/format";

function activeFilterPills(f: Filters, update: (p: Partial<Filters>) => void) {
  const pills: { key: string; text: string; remove: () => void }[] = [];
  if (f.q) pills.push({ key: "q", text: `“${f.q}”`, remove: () => update({ q: "" }) });
  for (const t of f.timeControl) pills.push({ key: `t${t}`, text: t, remove: () => update({ timeControl: f.timeControl.filter((x) => x !== t) }) });
  if (f.fide) pills.push({ key: "r", text: "FIDE rated", remove: () => update({ fide: false }) });
  if (f.regOpen) pills.push({ key: "o", text: "Registration open", remove: () => update({ regOpen: false }) });
  for (const s of f.state) pills.push({ key: `s${s}`, text: s, remove: () => update({ state: f.state.filter((x) => x !== s) }) });
  for (const c of f.city) pills.push({ key: `c${c}`, text: c, remove: () => update({ city: f.city.filter((x) => x !== c) }) });
  if (f.from || f.to) {
    const p = activePreset(f);
    const text = p === "weekend" ? "This weekend" : p === "30days" ? "Next 30 days" : `${f.from ? formatDayMonth(f.from) : "Any"} – ${f.to ? formatDayMonth(f.to) : "any"}`;
    pills.push({ key: "d", text, remove: () => update({ from: undefined, to: undefined }) });
  }
  if (f.minPrize) pills.push({ key: "p", text: prizeLabel(f.minPrize), remove: () => update({ minPrize: undefined }) });
  if (f.maxFee) pills.push({ key: "f", text: feeLabel(f.maxFee), remove: () => update({ maxFee: undefined }) });
  if (f.status.length) pills.push({ key: "st", text: f.status.map((s) => s[0].toUpperCase() + s.slice(1)).join(" + "), remove: () => update({ status: [] }) });
  return pills;
}

export function ActiveFilters({ f, update, clear }: { f: Filters; update: (p: Partial<Filters>) => void; clear: () => void }) {
  const pills = activeFilterPills(f, update);
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters" role="group">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={p.remove}
          aria-label={`Remove filter: ${p.text}`}
          className="group inline-flex h-7 items-center gap-1 rounded-sm border border-border bg-surface-2 pl-2.5 pr-1.5 text-small font-medium text-fg transition-colors hover:border-border-strong"
        >
          {p.text}
          <X className="h-3.5 w-3.5 text-muted group-hover:text-fg" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={clear} className="ml-1 h-7 rounded-sm px-1.5 text-small font-medium text-muted hover:text-fg">Clear all</button>
    </div>
  );
}
