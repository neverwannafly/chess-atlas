import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function NotFoundPage({ what = "page" }: { what?: string }) {
  useDocumentMeta(`${what[0].toUpperCase() + what.slice(1)} not found`);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-7xl font-semibold text-accent" aria-hidden>404</p>
      <h1 className="mt-4 text-3xl font-semibold">This {what} has left the board</h1>
      <p className="mt-2 text-muted">The link may be old, or the tournament was removed from the AICF calendar.</p>
      <Button asChild className="mt-6"><Link to="/">Browse tournaments</Link></Button>
    </div>
  );
}
