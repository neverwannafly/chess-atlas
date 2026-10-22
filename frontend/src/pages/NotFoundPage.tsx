import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

/** A 4×4 board corner with a lone king and knight. */
export default function NotFoundPage({ what = "page" }: { what?: string }) {
  useDocumentMeta(`${what[0].toUpperCase() + what.slice(1)} not found`);
  return (
    <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] lg:px-8 lg:py-28">
      <div>
        <p className="font-mono text-small text-muted">404</p>
        <h1 className="mt-3 text-[30px] font-semibold leading-tight tracking-h1 sm:text-h1">This {what} isn't on the board</h1>
        <p className="mt-3 max-w-[48ch] text-body-lg text-muted">
          The link may be out of date, or the tournament was taken off the AICF calendar. Every current event is in the main list.
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          <Button asChild size="lg"><Link to="/">Browse tournaments</Link></Button>
          <Button asChild size="lg" variant="secondary"><Link to="/stats">See insights</Link></Button>
        </div>
      </div>
      <div className="hidden grid-cols-4 overflow-hidden rounded-lg border border-border shadow-e2 md:grid" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => {
          const dark = (Math.floor(i / 4) + i) % 2 === 1;
          return (
            <span key={i} className="relative flex h-16 w-16 items-center justify-center" style={{ background: dark ? "var(--board-dark)" : "var(--board-light)" }}>
              {i === 5 && <img src="/pieces/cburnett/wK.svg" alt="" className="h-14 w-14" />}
              {i === 10 && <img src="/pieces/cburnett/bN.svg" alt="" className="h-14 w-14" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}
