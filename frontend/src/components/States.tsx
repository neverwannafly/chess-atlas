import { AlertTriangle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventRowSkeleton } from "@/components/event/EventRow";

export function RowSkeletons({ n = 5 }: { n?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading tournaments">
      {Array.from({ length: n }, (_, i) => <EventRowSkeleton key={i} />)}
    </div>
  );
}

export function EmptyState({ suggestions, onClear }: { suggestions: { label: string; onClick: () => void }[]; onClear: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-border-strong px-6 py-14 text-center">
      <SearchX className="mx-auto h-6 w-6 text-subtle" aria-hidden />
      <h2 className="mt-3 text-[17px] font-semibold tracking-h3">No tournaments match these filters</h2>
      <p className="mx-auto mt-1 max-w-md text-body text-muted">Loosen one of them to see more. These widen the search the most:</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => <Button key={s.label} variant="secondary" size="sm" onClick={s.onClick}>{s.label}</Button>)}
        <Button size="sm" onClick={onClear}>Clear all filters</Button>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <AlertTriangle className="mx-auto h-6 w-6 text-danger" aria-hidden />
      <h2 className="mt-3 text-[17px] font-semibold">Couldn't load tournaments</h2>
      <p className="mt-1 text-body text-muted">{message ?? "The server didn't respond."}</p>
      <Button className="mt-5" variant="secondary" onClick={onRetry}>Try again</Button>
    </div>
  );
}
