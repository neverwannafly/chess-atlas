import { ArrowUpRight, FileClock, FileQuestion, FileSearch, FileText } from "lucide-react";
import type { EventDetail } from "@/types/event";
import { Button } from "@/components/ui/button";
import { daysBetween } from "@/lib/format";
import { longRange } from "@/lib/eventDetail";

function copy(e: EventDetail) {
  switch (e.extractionStatus) {
    case "no_brochure":
      return {
        Icon: FileQuestion,
        title: "Brochure not published yet",
        body: "The organisers haven't uploaded a brochure to the AICF calendar. Below is what the federation lists today. Prizes, entry fees, the round schedule and contacts will appear here as soon as the brochure is out.",
        upcoming: true,
      };
    case "pending":
      return {
        Icon: FileClock,
        title: "Reading the brochure",
        body: "The brochure is published and we're summarising it now. Until it's done, the PDF has every detail.",
        upcoming: true,
      };
    case "failed":
      return {
        Icon: FileSearch,
        title: "This brochure needs a human read",
        body: "We couldn't pull structured details from it, which usually means a scanned image or an unusual layout. The PDF itself has the full prize list, fees and schedule.",
        upcoming: false,
      };
    default:
      return {
        Icon: FileText,
        title: "The brochure is light on details",
        body: "We read it, but it doesn't spell out the prize fund, fees or a schedule. The PDF or the organiser will have the rest.",
        upcoming: false,
      };
  }
}

/** Shown in place of the brochure sections when we have little beyond the AICF listing. */
export function SparseNotice({ e }: { e: EventDetail }) {
  const c = copy(e);
  const days = daysBetween(e.startDate, e.endDate) + 1;
  const rows: [string, string][] = [
    ["Dates", `${longRange(e.startDate, e.endDate)} · ${days} ${days === 1 ? "day" : "days"}`],
    ["Location", [e.city, e.state].filter(Boolean).join(", ") || "To be announced"],
    ["AICF event code", e.eventCode],
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-e1">
      <div className="flex gap-4 p-5 sm:p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-muted" aria-hidden>
          <c.Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold tracking-h3">{c.title}</h3>
          <p className="mt-1.5 max-w-[62ch] text-body leading-relaxed text-muted">{c.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {e.brochureUrl && <Button asChild><a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText aria-hidden />Open brochure</a></Button>}
            <Button asChild variant="secondary"><a href={e.aicfUrl} target="_blank" rel="noopener noreferrer">AICF calendar<ArrowUpRight aria-hidden /></a></Button>
          </div>
        </div>
      </div>
      <dl className="grid border-t border-border bg-surface-2/50 sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="border-border px-5 py-3.5 max-sm:border-b max-sm:last:border-b-0 sm:border-r sm:last:border-r-0 sm:px-6">
            <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{k}</dt>
            <dd className="mt-1 truncate text-ui font-medium">{k === "AICF event code" ? <span className="font-mono">{v}</span> : v}</dd>
          </div>
        ))}
      </dl>
      {c.upcoming && (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          <p className="text-small text-muted">Coming to this page</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {["Prize fund and places", "Entry fees", "Round schedule", "Venue and map", "Organiser contacts"].map((t) => (
              <li key={t} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-dashed border-border-strong px-2.5 text-small text-muted">
                <span className="h-1 w-1 rounded-full bg-subtle" aria-hidden />{t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
