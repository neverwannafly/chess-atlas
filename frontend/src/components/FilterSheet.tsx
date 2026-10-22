import { Chip } from "@/components/Chip";
import { MultiSelect } from "@/components/MultiSelect";
import { Button } from "@/components/ui/button";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useFacets } from "@/hooks/queries";
import {
  activePreset, DEFAULT_STATUS, FEE_STEPS, hasActiveFilters, presetRange, PRIZE_STEPS, STATUSES, TIME_CONTROLS, type Filters,
} from "@/lib/filters";
import { formatInr, pluralize } from "@/lib/format";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const dateCls = "h-9 rounded-sm border border-border-strong bg-surface px-2.5 text-ui text-fg";

function Group({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="border-t border-border px-5 py-5 first:border-t-0 sm:px-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-3 flex items-baseline justify-between" aria-hidden>
        <span className="text-ui font-semibold">{title}</span>
        {hint && <span className="text-small text-muted">{hint}</span>}
      </div>
      {children}
    </fieldset>
  );
}

function toggleStatusValue(f: Filters, s: string): string[] {
  const shown = f.status.length ? f.status : DEFAULT_STATUS;
  const next = shown.includes(s) ? shown.filter((x) => x !== s) : [...shown, s];
  const ordered = STATUSES.filter((x) => next.includes(x));
  const isDefault = ordered.length === 2 && ordered[0] === "upcoming" && ordered[1] === "ongoing";
  return isDefault || !ordered.length ? [] : ordered;
}

export function FilterSheet({ open, onOpenChange, filters: f, update, clear, count }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: Filters;
  update: (p: Partial<Filters>) => void;
  clear: () => void;
  count?: number;
}) {
  const { data: facets } = useFacets();
  const preset = activePreset(f);
  const shownStatus = f.status.length ? f.status : DEFAULT_STATUS;
  const setPreset = (p: "weekend" | "30days" | "custom") => {
    if (preset === p) return update({ from: undefined, to: undefined });
    if (p === "custom") return update({ from: f.from ?? presetRange("30days")[0], to: f.to ?? presetRange("30days")[1] });
    const [from, to] = presetRange(p);
    update({ from, to });
  };
  const toggleTc = (t: string) => update({ timeControl: f.timeControl.includes(t) ? f.timeControl.filter((x) => x !== t) : [...f.timeControl, t] });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width="md:w-[440px]">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-6 md:py-4">
          <div>
            <SheetTitle className="text-[17px] font-semibold tracking-h3">Filters</SheetTitle>
            <SheetDescription className="text-small text-muted">Changes apply as you make them.</SheetDescription>
          </div>
          <SheetCloseButton />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Group title="Dates">
            <div className="flex flex-wrap gap-2">
              <Chip pressed={preset === "weekend"} onClick={() => setPreset("weekend")}>This weekend</Chip>
              <Chip pressed={preset === "30days"} onClick={() => setPreset("30days")}>Next 30 days</Chip>
              <Chip pressed={preset === "custom"} onClick={() => setPreset("custom")}>Custom range</Chip>
            </div>
            {preset === "custom" && (
              <div className="mt-3 flex items-center gap-2">
                <input aria-label="From date" type="date" className={dateCls} value={f.from ?? ""} max={f.to} onChange={(e) => update({ from: e.target.value || undefined })} />
                <span className="text-muted" aria-hidden>to</span>
                <input aria-label="To date" type="date" className={dateCls} value={f.to ?? ""} min={f.from} onChange={(e) => update({ to: e.target.value || undefined })} />
              </div>
            )}
          </Group>

          <Group title="Time control">
            <div className="flex flex-wrap gap-2">
              {TIME_CONTROLS.map((t) => <Chip key={t} pressed={f.timeControl.includes(t)} onClick={() => toggleTc(t)}>{t}</Chip>)}
            </div>
          </Group>

          <Group title="Rating and registration">
            <div className="flex flex-wrap gap-2">
              <Chip pressed={f.fide} onClick={() => update({ fide: !f.fide })}>FIDE rated</Chip>
              <Chip pressed={f.regOpen} onClick={() => update({ regOpen: !f.regOpen })}>Registration open</Chip>
            </div>
          </Group>

          <Group title="State" hint={f.state.length ? `${f.state.length} chosen` : undefined}>
            <MultiSelect label="State" options={facets?.states ?? []} selected={f.state} onChange={(state) => update({ state })} />
          </Group>

          <Group title="City" hint={f.city.length ? `${f.city.length} chosen` : undefined}>
            <MultiSelect label="City" options={facets?.cities ?? []} selected={f.city} onChange={(city) => update({ city })} />
          </Group>

          <Group title="Prize fund">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Minimum prize fund">
              {PRIZE_STEPS.map((n) => (
                <Chip key={n} pressed={(f.minPrize ?? 0) === n} onClick={() => update({ minPrize: n || undefined })}>{n ? `${formatInr(n)}+` : "Any"}</Chip>
              ))}
            </div>
          </Group>

          <Group title="Entry fee" hint="lowest category fee">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Maximum entry fee">
              {[0, ...FEE_STEPS.filter(Boolean)].map((n) => (
                <Chip key={n} pressed={(f.maxFee ?? 0) === n} onClick={() => update({ maxFee: n || undefined })}>{n ? `Up to ${formatInr(n)}` : "Any"}</Chip>
              ))}
            </div>
          </Group>

          <Group title="Status">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => <Chip key={s} pressed={shownStatus.includes(s)} onClick={() => update({ status: toggleStatusValue(f, s) })}>{cap(s)}</Chip>)}
            </div>
          </Group>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
          <Button variant="ghost" onClick={clear} disabled={!hasActiveFilters(f)}>Clear all</Button>
          <Button onClick={() => onOpenChange(false)}>{count != null ? `Show ${pluralize(count, "tournament")}` : "Show results"}</Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
