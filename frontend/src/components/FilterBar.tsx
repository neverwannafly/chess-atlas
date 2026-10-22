import { useState } from "react";
import { CalendarDays, LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { Chip } from "@/components/Chip";
import { MultiSelect } from "@/components/MultiSelect";
import { useFacets } from "@/hooks/queries";
import {
  activePreset, DEFAULT_STATUS, FEE_STEPS, presetRange, PRIZE_STEPS, SORTS, STATUSES, TIME_CONTROLS,
  type Filters, type ViewMode,
} from "@/lib/filters";
import { formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  filters: Filters;
  update: (p: Partial<Filters>) => void;
}

const selectCls = "h-10 cursor-pointer rounded-md border border-line bg-surface px-2.5 text-sm";
const label = (s: string) => s[0].toUpperCase() + s.slice(1);

export function FilterBar({ filters: f, update }: Props) {
  const { data: facets } = useFacets();
  const [open, setOpen] = useState(false);
  const preset = activePreset(f);
  const shownStatus = f.status.length ? f.status : DEFAULT_STATUS;
  const advancedCount = [f.state.length, f.city.length, f.timeControl.length, f.from || f.to ? 1 : 0, f.minPrize ? 1 : 0, f.maxFee ? 1 : 0, f.fide ? 1 : 0].filter(Boolean).length;

  const toggleStatus = (s: string) => {
    const next = shownStatus.includes(s) ? shownStatus.filter((x) => x !== s) : [...shownStatus, s];
    const ordered = STATUSES.filter((x) => next.includes(x));
    const isDefault = ordered.length === 2 && ordered[0] === "upcoming" && ordered[1] === "ongoing";
    update({ status: isDefault || !ordered.length ? [] : ordered });
  };
  const toggleTc = (t: string) => update({ timeControl: f.timeControl.includes(t) ? f.timeControl.filter((x) => x !== t) : [...f.timeControl, t] });
  const setPreset = (p: "weekend" | "30days" | "custom") => {
    if (preset === p) return update({ from: undefined, to: undefined });
    if (p === "custom") return update({ from: f.from ?? presetRange("30days")[0], to: f.to ?? presetRange("30days")[1] });
    const [from, to] = presetRange(p);
    update({ from, to });
  };

  const views: { v: ViewMode; icon: typeof List; text: string }[] = [
    { v: "cards", icon: LayoutGrid, text: "Cards" },
    { v: "list", icon: List, text: "List" },
    { v: "calendar", icon: CalendarDays, text: "Calendar" },
  ];

  return (
    <section aria-label="Filters" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Status" className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Chip key={s} pressed={shownStatus.includes(s)} onClick={() => toggleStatus(s)}>{label(s)}</Chip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="more-filters"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm font-medium hover:bg-sunk lg:hidden"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
            {advancedCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-accent-ink">{advancedCount}</span>}
          </button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" className={selectCls} value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <div role="group" aria-label="View" className="flex rounded-md border border-line bg-surface p-0.5">
            {views.map(({ v, icon: Icon, text }) => (
              <button
                key={v}
                type="button"
                aria-pressed={f.view === v}
                aria-label={`${text} view`}
                title={`${text} view`}
                onClick={() => update({ view: v })}
                className={cn("flex h-9 w-9 cursor-pointer items-center justify-center rounded", f.view === v ? "bg-accent text-accent-ink" : "text-muted hover:bg-sunk")}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div id="more-filters" className={cn("space-y-3 rounded-xl border border-line bg-surface/60 p-3 lg:block", open ? "block" : "hidden")}>
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="State" options={facets?.states ?? []} selected={f.state} onChange={(state) => update({ state })} />
          <MultiSelect label="City" options={facets?.cities ?? []} selected={f.city} onChange={(city) => update({ city })} />
          <div role="group" aria-label="Time control" className="flex flex-wrap gap-1.5">
            {TIME_CONTROLS.map((t) => (
              <Chip key={t} pressed={f.timeControl.includes(t)} onClick={() => toggleTc(t)}>{t}</Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Dates" className="flex flex-wrap gap-1.5">
            <Chip pressed={preset === "weekend"} onClick={() => setPreset("weekend")}>This weekend</Chip>
            <Chip pressed={preset === "30days"} onClick={() => setPreset("30days")}>Next 30 days</Chip>
            <Chip pressed={preset === "custom"} onClick={() => setPreset("custom")}>Custom</Chip>
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-1.5 text-sm">
              <input aria-label="From date" type="date" className={selectCls} value={f.from ?? ""} max={f.to} onChange={(e) => update({ from: e.target.value || undefined })} />
              <span aria-hidden>–</span>
              <input aria-label="To date" type="date" className={selectCls} value={f.to ?? ""} min={f.from} onChange={(e) => update({ to: e.target.value || undefined })} />
            </div>
          )}
          <label className="sr-only" htmlFor="minPrize">Minimum prize</label>
          <select id="minPrize" className={selectCls} value={f.minPrize ?? 0} onChange={(e) => update({ minPrize: Number(e.target.value) || undefined })}>
            {PRIZE_STEPS.map((n) => <option key={n} value={n}>{n ? `Prize ${formatInr(n)}+` : "Any prize"}</option>)}
          </select>
          <label className="sr-only" htmlFor="maxFee">Maximum entry fee</label>
          <select id="maxFee" className={selectCls} value={f.maxFee ?? 0} onChange={(e) => update({ maxFee: Number(e.target.value) || undefined })}>
            {FEE_STEPS.map((n) => <option key={n} value={n}>{n ? `Fee up to ${formatInr(n)}` : "Any fee"}</option>)}
          </select>
          <Chip pressed={f.fide} onClick={() => update({ fide: !f.fide })}>FIDE rated</Chip>
        </div>
      </div>
    </section>
  );
}
