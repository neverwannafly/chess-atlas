import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function NotFoundPage({ what = "page" }: { what?: string }) {
  useDocumentMeta(`${what[0].toUpperCase() + what.slice(1)} not found`);
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border-2 border-ink/20 sm:max-w-md" aria-hidden>
        {["4", "0", "4"].map((c, i) => (
          <span key={i} className={`flex aspect-square items-center justify-center font-display text-7xl font-extrabold ${i === 1 ? "sq-light" : "sq-dark"}`}>{c}</span>
        ))}
      </div>
      <h1 className="mt-8 text-4xl font-extrabold sm:text-5xl">This {what} has left the board</h1>
      <p className="mt-3 max-w-md text-muted">The link may be old, or the tournament was removed from the AICF calendar.</p>
      <Button asChild size="lg" className="mt-6"><Link to="/">Browse tournaments</Link></Button>
    </div>
  );
}
