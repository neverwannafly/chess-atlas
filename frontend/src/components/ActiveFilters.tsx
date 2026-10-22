import { X } from "lucide-react";
import { activePreset, feeLabel, prizeLabel, type Filters } from "@/lib/filters";
import { formatDate } from "@/lib/format";

export function ActiveFilters({ f, update, clear }: { f: Filters; update: (p: Partial<Filters>) => void; clear: () => void }) {
  const pills: { key: string; text: string; remove: () => void }[] = [];
  if (f.q) pills.push({ key: "q", text: `“${f.q}”`, remove: () => update({ q: "" }) });
  for (const s of f.state) pills.push({ key: `s${s}`, text: s, remove: () => update({ state: f.state.filter((x) => x !== s) }) });
  for (const c of f.city) pills.push({ key: `c${c}`, text: c, remove: () => update({ city: f.city.filter((x) => x !== c) }) });
  for (const t of f.timeControl) pills.push({ key: `t${t}`, text: t, remove: () => update({ timeControl: f.timeControl.filter((x) => x !== t) }) });
  if (f.from || f.to) {
    const p = activePreset(f);
    const text = p === "weekend" ? "This weekend" : p === "30days" ? "Next 30 days" : `${f.from ? formatDate(f.from) : "…"} → ${f.to ? formatDate(f.to) : "…"}`;
    pills.push({ key: "d", text, remove: () => update({ from: undefined, to: undefined }) });
  }
  if (f.minPrize) pills.push({ key: "p", text: prizeLabel(f.minPrize), remove: () => update({ minPrize: undefined }) });
  if (f.maxFee) pills.push({ key: "f", text: feeLabel(f.maxFee), remove: () => update({ maxFee: undefined }) });
  if (f.fide) pills.push({ key: "r", text: "FIDE rated", remove: () => update({ fide: false }) });
  if (f.status.length) pills.push({ key: "st", text: f.status.join(" + "), remove: () => update({ status: [] }) });
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters" role="group">
      {pills.map((p) => (
        <button key={p.key} type="button" onClick={p.remove} aria-label={`Remove filter ${p.text}`} className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-2 text-[13px] font-medium capitalize text-accent hover:opacity-80">
          {p.text} <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
      <button type="button" onClick={clear} className="ml-1 cursor-pointer text-[13px] font-medium text-muted underline underline-offset-4 hover:text-ink">Clear all</button>
    </div>
  );
}
