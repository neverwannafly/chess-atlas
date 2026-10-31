import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SearchField } from "@/components/ui/SearchField";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import { PageHead, TitleBadge } from "@/components/cr/common";
import { useCrStatus, useDebounced, usePlayerSearch } from "@/hooks/crQueries";
import { EmptyNote, SourceLine, SOURCES } from "@/components/Trust";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { playerName, shell } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

export default function PlayersPage() {
  useDocumentMeta("Players", "Find Indian chess players: FIDE ratings and tournament history from chess-results.com.");
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const q = useDebounced(text.trim(), 300);
  const input = useRef<HTMLInputElement>(null);
  const { data, isFetching, isError, error, refetch, isPlaceholderData } = usePlayerSearch(q);
  const mirror = useCrStatus();

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    setParams((p) => { const n = new URLSearchParams(p); if (q) n.set("q", q); else n.delete("q"); return n; }, { replace: true });
  }, [q, setParams]);

  const ready = q.length >= 2;
  const rows = ready ? data ?? [] : [];

  return (
    <div className={shell}>
      <PageHead title="Players">Search anyone who has played in a mirrored Indian tournament. Profiles show FIDE ratings over time and every event on record.</PageHead>
      <SearchField ref={input} id="player-search" value={text} onChange={setText} size="lg" className="mt-6 max-w-xl" placeholder="Name or FIDE ID" label="Search players" shortcut={false} />
      <SourceLine sources={[SOURCES.chessResults, SOURCES.fide]} refreshedAt={mirror.data ? mirror.data.lastRefreshedAt : undefined} verb="mirror refreshed" className="mt-3" />
      <p className="mt-4 text-small text-subtle" aria-live="polite">
        {!ready ? "Type at least 2 characters." : isFetching && !data ? "Searching…" : `${rows.length === 25 ? "First 25" : rows.length} ${rows.length === 1 ? "match" : "matches"}`}
      </p>

      <div className="mt-6 max-w-3xl">
        {ready && isError ? (
          <ErrorState title="Couldn't search players" message={(error as Error).message} onRetry={() => refetch()} />
        ) : ready && !data && isFetching ? (
          <div className="space-y-2" role="status" aria-label="Searching players">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : ready && rows.length === 0 ? (
          <EmptyNote title={`No players match “${q}”`}>Try the surname only, or a FIDE id. Players appear once they have played in a mirrored Indian tournament.</EmptyNote>
        ) : rows.length > 0 ? (
          <ul className={cn("divide-y divide-border/70 overflow-hidden rounded-md border border-border bg-surface shadow-e1 transition-opacity", isPlaceholderData && "opacity-60")}>
            {rows.map((p) => (
              <li key={p.id}>
                <Link to={`/players/${p.id}`} className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/70">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <TitleBadge title={p.title} />
                      <span className="truncate font-medium text-fg">{playerName(p.name)}</span>
                    </p>
                    <p className="mt-0.5 text-small text-muted">
                      {p.fed}
                      <span className="px-1.5 text-subtle" aria-hidden>·</span>
                      {p.fideId ? <span className="font-mono text-[12px]">FIDE {p.fideId}</span> : <span className="text-subtle">No FIDE ID</span>}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
