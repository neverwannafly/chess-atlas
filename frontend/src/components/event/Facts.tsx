import type { Fact } from "@/lib/eventFacts";
import { cn } from "@/lib/utils";

export function FactValue({ fact, className }: { fact: Fact; className?: string }) {
  return (
    <span className={cn(fact.tone === "warn" && "text-warn", fact.tone === "muted" && "text-muted", className)} title={fact.title}>
      {fact.value}
      {fact.code && <span className={cn("font-mono text-[0.9em] tracking-tight", fact.value && "ml-1.5")}>{fact.code}</span>}
    </span>
  );
}

/** One cell of the spec strip: label / value / note. */
export function FactCell({ label, fact, className }: { label: string; fact: Fact; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-label text-muted">{label}</dt>
      <dd className="mt-1 truncate text-ui font-medium leading-tight text-fg">
        <FactValue fact={fact} />
      </dd>
      {fact.note && <dd className={cn("mt-0.5 truncate text-small", fact.tone === "warn" ? "text-warn" : "text-muted")}>{fact.note}</dd>}
    </div>
  );
}

/** Stacked definition list used in the drawer and the event sidebar. */
export function FactRows({ rows, className }: { rows: { label: string; fact: Fact; icon?: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          {r.icon && <span className="mt-0.5 text-subtle [&_svg]:h-4 [&_svg]:w-4" aria-hidden>{r.icon}</span>}
          <dt className="w-24 shrink-0 text-small text-muted">{r.label}</dt>
          <dd className="min-w-0 flex-1 text-right">
            <FactValue fact={r.fact} className="block text-ui font-medium" />
            {r.fact.note && <span className={cn("block text-small", r.fact.tone === "warn" ? "text-warn" : "text-muted")}>{r.fact.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
