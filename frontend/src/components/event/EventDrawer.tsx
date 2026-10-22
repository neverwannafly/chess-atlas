import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import type { EventSummary } from "@/types/event";
import { Badge, StatusBadge } from "@/components/Badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetCloseButton, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { FactRows } from "@/components/event/Facts";
import {ContactList, EventActions, FeeTable, PrizeLadder, ScheduleTimeline } from "@/components/event/DetailParts";
import { groupCategoryPrizes, hasPrizes, venueQuery } from "@/lib/eventDetail";
import { useEvent } from "@/hooks/queries";
import { deriveFacts, displayName } from "@/lib/eventFacts";
import { formatInrFull, formatMoney } from "@/lib/format";
import { mapsOpenUrl } from "@/lib/utils";

function Block({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-ui font-semibold">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EventDrawer({ code, summary, onClose }: { code: string | undefined; summary?: EventSummary; onClose: () => void }) {
  return (
    <Sheet open={!!code} onOpenChange={(o) => { if (!o) onClose(); }}>
      {code && (
        <SheetContent aria-describedby={undefined}>
          <DrawerBody code={code} summary={summary} />
        </SheetContent>
      )}
    </Sheet>
  );
}

function DrawerBody({ code, summary }: { code: string; summary?: EventSummary }) {
  const { data, isPending, isError } = useEvent(code);
  const e: EventSummary | undefined = data ?? summary;
  const d = data?.details ?? null;

  if (!e) {
    return (
      <div className="p-6">
        <SheetTitle className="sr-only">Loading tournament</SheetTitle>
        {isError ? <p className="text-muted">This tournament could not be loaded.</p> : <div className="space-y-3"><div className="skeleton h-6 w-3/4 rounded-sm" /><div className="skeleton h-4 w-1/2 rounded-sm" /><div className="skeleton h-40 w-full rounded-md" /></div>}
      </div>
    );
  }

  const f = deriveFacts(e, data);
  const name = displayName(e.name);
  const loc = [e.city, e.state].filter(Boolean).join(", ");
  const para = d?.summary?.split(/\n{2,}/).filter(Boolean)[0];
  const mapQ = venueQuery(e, d);
  const catGroups = d ? groupCategoryPrizes(d.prizes.categoryPrizes) : [];
  const rows = [
    { label: "When", fact: f.when },
    f.timeControl && { label: "Time control", fact: f.timeControl },
    f.prize && { label: "Prize fund", fact: f.prize },
    f.fee && { label: "Entry", fact: f.fee.title ? { ...f.fee, note: f.fee.title } : f.fee },
    f.registration && { label: "Registration", fact: f.registration },
    d?.chiefArbiter && { label: "Chief arbiter", fact: { value: d.chiefArbiter } },
  ].filter(Boolean) as { label: string; fact: import("@/lib/eventFacts").Fact }[];

  return (
    <>
      <header className="flex items-start gap-3 border-b border-border px-5 pb-4 pt-3 sm:px-6 md:pt-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <StatusBadge status={f.status} />
            {f.fide && <Badge tone="outline">FIDE rated</Badge>}
          </div>
          <SheetTitle className="text-[19px] font-semibold leading-snug tracking-h2">{name}</SheetTitle>
          <SheetDescription className="mt-1 text-small text-muted">
            {[e.venueName, loc].filter(Boolean).join(", ") || "Venue to be announced"}
          </SheetDescription>
        </div>
        <SheetCloseButton className="-mr-2 -mt-1" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="px-5 py-4 sm:px-6">
          <EventActions e={{ ...e, details: d }} />
        </div>

        <section className="border-t border-border px-5 py-5 sm:px-6" aria-label="Key facts">
          <FactRows rows={rows} />
        </section>

        {isPending && !data && (
          <div className="space-y-3 border-t border-border px-6 py-5" aria-hidden>
            <div className="skeleton h-4 w-1/3 rounded-sm" />
            <div className="skeleton h-16 w-full rounded-sm" />
          </div>
        )}

        {(d?.tagline || para) && (
          <Block title="About">
            {para ? <p className="text-body leading-relaxed text-fg/90">{para}</p> : <p className="text-body">{d?.tagline}</p>}
          </Block>
        )}

        {d && hasPrizes(d.prizes) && (
          <Block
            title="Prizes"
            aside={d.prizes.totalInr ? <span className="text-ui font-medium" title={formatInrFull(d.prizes.totalInr)}>{formatMoney(d.prizes.totalInr)} total</span> : undefined}
          >
            {d.prizes.places.length > 0 && <PrizeLadder places={d.prizes.places} limit={5} />}
            {catGroups.length > 0 && (
              <p className="mt-3 text-small text-muted">
                Plus {d.prizes.categoryPrizes.length} category {d.prizes.categoryPrizes.length === 1 ? "prize" : "prizes"} across {catGroups.length} {catGroups.length === 1 ? "group" : "groups"}: {catGroups.slice(0, 4).map((g) => g.category).join(", ")}{catGroups.length > 4 ? "…" : ""}
              </p>
            )}
          </Block>
        )}

        {d && d.entryFees.length > 0 && (
          <Block title="Entry fees">
            <FeeTable fees={d.entryFees} />
          </Block>
        )}

        {d && d.schedule.length > 0 && (
          <Block title="Schedule">
            <ScheduleTimeline items={d.schedule} limit={6} />
          </Block>
        )}

        {mapQ && (
          <Block title="Venue">
            <p className="text-ui font-medium">{d?.venue.name ?? e.venueName ?? loc}</p>
            {d?.venue.address && <p className="text-small text-muted">{d.venue.address}{d.venue.pincode ? ` ${d.venue.pincode}` : ""}</p>}
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <a href={mapsOpenUrl(mapQ)} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden />Open in Google Maps</a>
            </Button>
          </Block>
        )}

        {d && d.contacts.length > 0 && (
          <Block title="Contacts">
            <ContactList contacts={d.contacts.slice(0, 4)} compact />
            {d.contacts.length > 4 && <p className="mt-2 text-small text-muted">{d.contacts.length - 4} more on the full page.</p>}
          </Block>
        )}

        {!f.hasDetails && (
          <Block title="Details">
            <p className="text-body text-muted">
              {e.extractionStatus === "no_brochure"
                ? "The organisers haven't published a brochure yet. Prizes, fees and the schedule will appear here once they do."
                : "The brochure is published but we haven't finished reading it. Open the brochure for prizes and fees."}
            </p>
          </Block>
        )}
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
        <span className="font-mono text-label text-subtle">#{e.eventCode}</span>
        <Button asChild variant="secondary">
          <Link to={`/events/${e.eventCode}`}>Full details<ArrowRight aria-hidden /></Link>
        </Button>
      </footer>
    </>
  );
}
