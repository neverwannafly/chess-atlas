import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ExternalLink, FileText, MapPin } from "lucide-react";
import type { BrochureExtraction, EventDetail } from "@/types/event";
import { Badge, StatusBadge } from "@/components/Badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FactRows } from "@/components/event/Facts";
import {CategoryPrizes, ContactList, EventActions, FeeTable, PrizeLadder, ScheduleTimeline, ShareButton } from "@/components/event/DetailParts";
import { groupCategoryPrizes, hasPrizes, venueQuery } from "@/lib/eventDetail";
import { ErrorState } from "@/components/States";
import NotFoundPage from "@/pages/NotFoundPage";
import { useEvent } from "@/hooks/queries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError, calendarUrl } from "@/lib/api";
import { deriveFacts, displayName, type Fact } from "@/lib/eventFacts";
import { formatDate, formatDateRange, formatInrFull, location, pluralize } from "@/lib/format";
import { mapsEmbedUrl, mapsOpenUrl } from "@/lib/utils";

function Section({ id, title, aside, children }: { id: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="border-t border-border py-8 first:border-t-0 first:pt-0">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`${id}-h`} className="text-[19px] font-semibold tracking-h2">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Tags({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-small text-muted">{title}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((c) => <li key={c}><Badge tone="outline" className="h-7 px-2.5 text-ui">{c}</Badge></li>)}
      </ul>
    </div>
  );
}

function sectionsFor(e: EventDetail, d: BrochureExtraction | null) {
  const s: { id: string; title: string }[] = [];
  if (!d) return s;
  if (d.summary || d.tagline) s.push({ id: "about", title: "About" });
  if (hasPrizes(d.prizes)) s.push({ id: "prizes", title: "Prizes" });
  if (d.entryFees.length || d.registration.notes) s.push({ id: "fees", title: "Entry and registration" });
  if (d.categories.rating.length || d.categories.age.length || d.eligibility) s.push({ id: "eligibility", title: "Categories and eligibility" });
  if (d.schedule.length) s.push({ id: "schedule", title: "Schedule" });
  if (venueQuery(e, d)) s.push({ id: "venue", title: "Venue" });
  if (d.organizer || d.chiefArbiter || d.contacts.length) s.push({ id: "people", title: "Organiser and contacts" });
  if (d.accommodation) s.push({ id: "stay", title: "Accommodation" });
  return s;
}

function Main({ e, d }: { e: EventDetail; d: BrochureExtraction }) {
  const paras = d.summary?.split(/\n{2,}/).filter(Boolean) ?? [];
  const mapQ = venueQuery(e, d);
  const cats = groupCategoryPrizes(d.prizes.categoryPrizes);
  const prizeMeta = [d.prizes.places.length && pluralize(d.prizes.places.length, "place"), d.prizes.categoryPrizes.length && `${pluralize(d.prizes.categoryPrizes.length, "category prize")}`].filter(Boolean).join(", ");
  return (
    <>
      {(paras.length > 0 || d.tagline) && (
        <Section id="about" title="About">
          <div className="max-w-[68ch] space-y-3 text-body-lg leading-relaxed text-fg/90">
            {paras.length ? paras.map((p, i) => <p key={i}>{p}</p>) : <p>{d.tagline}</p>}
          </div>
        </Section>
      )}

      {hasPrizes(d.prizes) && (
        <Section id="prizes" title="Prizes" aside={prizeMeta ? <span className="text-small text-muted">{prizeMeta}</span> : undefined}>
          {d.prizes.totalInr != null && d.prizes.totalInr > 0 && (
            <p className="mb-6">
              <span className="block text-[34px] font-medium leading-none tracking-h1" title={formatInrFull(d.prizes.totalInr)}>{formatInrFull(d.prizes.totalInr)}</span>
              <span className="mt-1.5 block text-small text-muted">total prize fund</span>
            </p>
          )}
          {d.prizes.places.length > 0 && (
            <div className="max-w-xl">
              <h3 className="mb-2 text-small text-muted">Main standings</h3>
              <PrizeLadder places={d.prizes.places} limit={10} />
            </div>
          )}
          {cats.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-small text-muted">Category prizes, {pluralize(cats.length, "group")}</h3>
              <CategoryPrizes list={d.prizes.categoryPrizes} />
            </div>
          )}
          {d.prizes.notes && <p className="mt-5 max-w-[68ch] text-small text-muted">{d.prizes.notes}</p>}
        </Section>
      )}

      {(d.entryFees.length > 0 || d.registration.notes) && (
        <Section id="fees" title="Entry and registration">
          {d.entryFees.length > 0 && <div className="max-w-xl"><FeeTable fees={d.entryFees} /></div>}
          {d.registration.notes && <p className="mt-4 max-w-[68ch] text-body text-muted">{d.registration.notes}</p>}
        </Section>
      )}

      {(d.categories.rating.length > 0 || d.categories.age.length > 0 || d.eligibility) && (
        <Section id="eligibility" title="Categories and eligibility">
          <div className="space-y-5">
            {d.categories.rating.length > 0 && <Tags title="Rating categories" items={d.categories.rating} />}
            {d.categories.age.length > 0 && <Tags title="Age categories" items={d.categories.age} />}
            {d.eligibility && <p className="max-w-[68ch] text-body">{d.eligibility}</p>}
          </div>
        </Section>
      )}

      {d.schedule.length > 0 && (
        <Section id="schedule" title="Schedule">
          <ScheduleTimeline items={d.schedule} />
        </Section>
      )}

      {mapQ && (
        <Section id="venue" title="Venue">
          <p className="text-body font-medium">{d.venue.name ?? e.venueName ?? location(e)}</p>
          {d.venue.address && <p className="text-body text-muted">{d.venue.address}{d.venue.pincode ? ` ${d.venue.pincode}` : ""}</p>}
          <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface-2">
            <iframe title={`Map of ${d.venue.name ?? "the venue"}`} src={mapsEmbedUrl(mapQ)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-72 w-full" />
          </div>
          <Button asChild variant="secondary" className="mt-3">
            <a href={mapsOpenUrl(mapQ)} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden />Open in Google Maps</a>
          </Button>
        </Section>
      )}

      {(d.organizer || d.chiefArbiter || d.contacts.length > 0) && (
        <Section id="people" title="Organiser and contacts">
          {(d.organizer || d.chiefArbiter) && (
            <dl className="mb-5 grid gap-4 sm:grid-cols-2">
              {d.organizer && <div><dt className="text-small text-muted">Organiser</dt><dd className="text-body font-medium">{d.organizer}</dd></div>}
              {d.chiefArbiter && <div><dt className="text-small text-muted">Chief arbiter</dt><dd className="text-body font-medium">{d.chiefArbiter}</dd></div>}
            </dl>
          )}
          {d.contacts.length > 0 && <ContactList contacts={d.contacts} />}
        </Section>
      )}

      {d.accommodation && (
        <Section id="stay" title="Accommodation">
          <p className="max-w-[68ch] text-body">{d.accommodation}</p>
        </Section>
      )}
    </>
  );
}

function Pending({ e, empty }: { e: EventDetail; empty: boolean }) {
  const mapQ = [e.venueName, e.city, e.state].filter(Boolean).join(", ");
  return (
    <>
      <section className="rounded-md border border-border bg-surface p-6 sm:p-8" aria-labelledby="pending-h">
        <h2 id="pending-h" className="text-[19px] font-semibold tracking-h2">
          {empty ? "The brochure doesn't list prizes or fees" : e.extractionStatus === "no_brochure" ? "Brochure not published yet" : "Brochure details on the way"}
        </h2>
        <p className="mt-2 max-w-[60ch] text-body text-muted">
          {empty
            ? "We read the brochure but it doesn't spell out the prize fund, fees or schedule. The organiser or the AICF listing will have the rest."
            : e.extractionStatus === "no_brochure"
              ? "The organisers haven't uploaded a brochure to the AICF calendar. When they do, the prize fund, entry fees, schedule and contacts will appear on this page."
              : "The brochure is published and we're reading it. Until then, the PDF has everything."}
        </p>
        {!empty && (
        <ul className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-border text-small sm:grid-cols-3">
          {["Prize fund and places", "Entry fees by category", "Round schedule and contacts"].map((t) => (
            <li key={t} className="bg-surface-2 px-4 py-3 text-muted">{t}</li>
          ))}
        </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {e.brochureUrl && <Button asChild><a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText aria-hidden />Open brochure</a></Button>}
          <Button asChild variant="secondary"><a href={e.aicfUrl} target="_blank" rel="noopener noreferrer">AICF listing<ExternalLink aria-hidden /></a></Button>
        </div>
      </section>
      {mapQ && !empty && (
        <Section id="venue" title="Where">
          <p className="text-body font-medium">{location(e)}</p>
          {e.venueName && <p className="text-body text-muted">{e.venueName}</p>}
          <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface-2">
            <iframe title={`Map of ${location(e)}`} src={mapsEmbedUrl(mapQ)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="block h-64 w-full" />
          </div>
        </Section>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-4 py-10 sm:px-6 lg:px-8" role="status" aria-label="Loading tournament">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <div className="grid gap-10 pt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-80 w-full rounded-md" />
        <Skeleton className="h-80 w-full rounded-md" />
      </div>
    </div>
  );
}

export default function EventPage() {
  const { eventCode = "" } = useParams();
  const { data: e, isPending, isError, error, refetch } = useEvent(eventCode);
  const d = e?.details ?? null;
  useDocumentMeta(
    e ? displayName(e.name) : undefined,
    e ? (d?.tagline ?? d?.summary?.split("\n")[0] ?? `${e.name}, ${formatDateRange(e.startDate, e.endDate, true)}, ${location(e)}.`) : undefined
  );

  if (isPending) return <Loading />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="tournament" />;
    return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;
  }

  const f = deriveFacts(e, e);
  const sections = sectionsFor(e, d);
  const rich = !!d && sections.some((s) => s.id !== "venue" && s.id !== "about");
  const name = displayName(e.name);

  const rows: { label: string; fact: Fact }[] = [
    { label: "Dates", fact: { value: formatDateRange(e.startDate, e.endDate, true), note: f.when.note } },
    { label: "Where", fact: { value: location(e), note: d?.venue.name ?? e.venueName ?? undefined } },
  ];
  if (f.timeControl) rows.push({ label: "Time control", fact: f.timeControl });
  if (f.fide != null) rows.push({ label: "Rating", fact: { value: f.fide ? "FIDE rated" : "Not FIDE rated" } });
  if (f.prize) rows.push({ label: "Prize fund", fact: f.prize });
  if (f.fee) rows.push({ label: "Entry", fact: f.fee.title ? { ...f.fee, note: f.fee.title } : f.fee });
  if (f.registration) rows.push({ label: "Registration", fact: f.registration });

  return (
    <article className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 pt-6 text-small text-muted">
        <Link
          to="/"
          onClick={(ev) => { if (window.history.state?.idx > 0) { ev.preventDefault(); window.history.back(); } }}
          className="inline-flex items-center gap-1.5 rounded-sm hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />All tournaments
        </Link>
        {e.state && (
          <>
            <span className="text-subtle" aria-hidden>/</span>
            <Link to={`/?state=${encodeURIComponent(e.state)}`} className="rounded-sm hover:text-fg">{e.state}</Link>
          </>
        )}
      </nav>


      <div className="grid gap-x-14 gap-y-8 pt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <header className="border-b border-border pb-8 lg:col-start-1 lg:row-start-1">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <StatusBadge status={f.status} />
            {f.fide && <Badge tone="outline">FIDE rated</Badge>}
            {f.registration?.tone === "warn" && <Badge tone="warn">Registration closes {f.registration.note}</Badge>}
          </div>
          <h1 className="max-w-[24ch] text-[30px] font-semibold leading-[1.1] tracking-h1 sm:text-h1">{name}</h1>
          {d?.tagline && <p className="mt-3 max-w-[64ch] text-body-lg text-muted">{d.tagline}</p>}
          <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-ui">
            <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-subtle" aria-hidden />{formatDateRange(e.startDate, e.endDate, true)}</span>
            <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-subtle" aria-hidden />{location(e)}</span>
          </p>
        </header>
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Key facts and actions">
          <div className="space-y-5 lg:sticky lg:top-[calc(var(--toolbar-h)+24px)]">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-e1">
              <FactRows rows={rows} />
              <div className="mt-5 border-t border-border pt-5">
                <EventActions e={e} size="lg" full />
              </div>
              <div className="mt-2 flex gap-2 [&>*]:flex-1">
                <ShareButton title={name} />
                <Button asChild variant="secondary"><a href={e.aicfUrl} target="_blank" rel="noopener noreferrer">AICF<ExternalLink aria-hidden /></a></Button>
              </div>
            </div>
            {sections.length >= 3 && (
              <nav aria-label="On this page" className="hidden px-1 lg:block">
                <p className="mb-2 text-small text-muted">On this page</p>
                <ul className="space-y-0.5 border-l border-border">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-ui text-muted transition-colors hover:border-fg hover:text-fg">{s.title}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {d && rich ? <Main e={e} d={d} /> : d ? <><Pending e={e} empty /><div className="mt-8"><Main e={e} d={d} /></div></> : <Pending e={e} empty={false} />}
          {e.extractedAt && (
            <p className="mt-10 border-t border-border pt-5 text-small text-muted">
              Summarised from the official brochure on {formatDate(e.extractedAt.slice(0, 10))}. Always confirm details with the organiser.{" "}
              <a href={calendarUrl(e.eventCode)} download className="text-fg underline decoration-border-strong underline-offset-2">Add to calendar</a>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

