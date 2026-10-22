import { AlertTriangle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeletons({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="status" aria-label="Loading tournaments">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border border-line bg-surface p-4">
          <Skeleton className="h-16 w-14 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ suggestions, onClear }: { suggestions: { label: string; onClick: () => void }[]; onClear: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <SearchX className="mx-auto h-8 w-8 text-muted" aria-hidden />
      <h2 className="mt-3 text-xl font-semibold">No tournaments match</h2>
      <p className="mx-auto mt-1 max-w-md text-muted">Try loosening a filter or two. Here are some quick ways to widen the search.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {suggestions.map((s) => (
          <Button key={s.label} variant="outline" size="sm" onClick={s.onClick}>{s.label}</Button>
        ))}
        <Button size="sm" onClick={onClear}>Clear all filters</Button>
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-live/40 bg-live-soft px-6 py-10 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-live" aria-hidden />
      <h2 className="mt-3 text-xl font-semibold">Couldn't load the data</h2>
      <p className="mt-1 text-muted">{message ?? "Something went wrong."}</p>
      <Button className="mt-5" onClick={onRetry}>Try again</Button>
    </div>
  );
}
