import { useParams } from "react-router-dom";
import type { EventDetail, EventSummary } from "@/types/event";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/States";
import NotFoundPage from "@/pages/NotFoundPage";
import { EventHeader } from "@/components/event-page/Header";
import { KeyFacts } from "@/components/event-page/KeyFacts";
import { PrizesBody } from "@/components/event-page/Prizes";
import { ContactsBody, EligibilityBody, EntryBody, ScheduleBody, Section, VenueBody } from "@/components/event-page/Sections";
import { CondensedBar, SectionNav } from "@/components/event-page/Chrome";
import { MoreTournaments } from "@/components/event-page/More";
import { SparseNotice } from "@/components/event-page/Sparse";
import { Reveal } from "@/components/event-page/motion";
import { useCachedSummary, useScrolledPast, useScrollSpy } from "@/components/event-page/hooks";
import { useEvent } from "@/hooks/queries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError } from "@/lib/api";
import { displayName } from "@/lib/eventFacts";
import { formatParts, isRich, prizeMeta, sectionsFor } from "@/lib/eventDetail";
import { formatDate, formatDateRange, location, pluralize } from "@/lib/format";

function preview(s: EventSummary): EventDetail {
  return { ...s, details: null, extractedAt: null, extractionModel: null, aicfUrl: "https://aicf.in/all-events/", createdAt: "", updatedAt: "" };
}

function describe(e: EventDetail) {
  const d = e.details;
  const lead = d?.tagline ?? d?.summary?.split(/\n+/)[0];
  if (lead) return lead;
  return `${displayName(e.name)}: ${formatDateRange(e.startDate, e.endDate, true)} in ${location(e)}. Dates, prizes, entry fees and registration.`;
}

function Overview({ e }: { e: EventDetail }) {
  const d = e.details;
  const paras = d?.summary?.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) ?? [];
  const f = formatParts(e, d);
  const facts: [string, string][] = [];
  if (f.raw) facts.push(["Time control", f.raw]);
  else if (f.tc) facts.push(["Time control", `${f.tc}${f.type ? ` (${f.type})` : ""}`]);
  if (f.rounds) facts.push(["Rounds", pluralize(f.rounds, "round")]);
  if (d?.format) facts.push(["Pairing", d.format]);
  if (d?.organizer) facts.push(["Organiser", d.organizer]);
  const rich = isRich(e);
  return (
    <div className="space-y-8">
      {paras.length > 0 ? (
        <div className="max-w-[68ch] space-y-4 text-body leading-[1.7] sm:text-body-lg">
          {paras.map((p, i) => <p key={i} className={i === 0 ? "text-fg" : "text-muted"}>{p}</p>)}
        </div>
      ) : null}
      {!rich && <SparseNotice e={e} />}
      {facts.length > 0 && (
        <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3.5">
              <dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">{k}</dt>
              <dd className="mt-1 text-ui">{v}</dd>
            </div>
          ))}
          {facts.length % 2 === 1 && <div className="hidden bg-surface sm:block" aria-hidden />}
        </dl>
      )}
    </div>
  );
}

function BodySkeleton() {
  return (
    <div className="mt-10 space-y-10" role="status" aria-label="Loading tournament details">
      <Skeleton className="h-[92px] w-full rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full max-w-[68ch]" />
        <Skeleton className="h-4 w-11/12 max-w-[64ch]" />
        <Skeleton className="h-4 w-3/4 max-w-[52ch]" />
      </div>
    </div>
  );
}

const Container = ({ children }: { children: React.ReactNode }) => <article className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">{children}</article>;

export default function EventPage() {
  const { eventCode = "" } = useParams();
  const { data, isPending, isError, error, refetch } = useEvent(eventCode);
  const cached = useCachedSummary(eventCode);
  const e = data ?? (cached ? preview(cached) : undefined);
  const [actionsRef, scrolledPast] = useScrolledPast(64);
  const sections = data ? sectionsFor(data) : [];
  const active = useScrollSpy(sections.map((s) => s.id), 180);
  useDocumentMeta(e ? displayName(e.name) : undefined, e ? describe(e) : undefined);

  if (isError && !data) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="tournament" />;
    return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;
  }
  if (!e) {
    return (
      <Container>
        <div className="space-y-4 pt-8" role="status" aria-label="Loading tournament">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-8 h-6 w-48" />
          <Skeleton className="h-11 w-4/5 max-w-[26ch]" />
          <Skeleton className="h-5 w-1/2" />
        </div>
        <BodySkeleton />
      </Container>
    );
  }

  const name = displayName(e.name);
  const d = data?.details ?? null;

  return (
    <Container>
      <EventHeader e={e} name={name} tagline={d?.tagline ?? e.tagline} actionsRef={actionsRef} />
      {isPending || !data ? (
        <BodySkeleton />
      ) : (
        <>
          <Reveal className="mt-10 sm:mt-12" y={10}>
            <KeyFacts e={data} />
          </Reveal>
          <div className="mt-8 grid gap-14 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_200px] xl:gap-20">
            <div className="min-w-0">
              <Section id="overview" title="Overview">
                <Overview e={data} />
              </Section>
              {sections.some((s) => s.id === "prizes") && d && (
                <Section id="prizes" title="Prizes" meta={prizeMeta(d.prizes)}>
                  <PrizesBody prizes={d.prizes} />
                </Section>
              )}
              {sections.some((s) => s.id === "entry") && d && (
                <Section id="entry" title="Entry fees">
                  <EntryBody e={data} d={d} />
                </Section>
              )}
              {sections.some((s) => s.id === "schedule") && d && (
                <Section id="schedule" title="Schedule" meta={`${d.schedule.length} items`}>
                  <ScheduleBody e={data} items={d.schedule} />
                </Section>
              )}
              {sections.some((s) => s.id === "venue") && (
                <Section id="venue" title="Venue">
                  <VenueBody e={data} d={d} />
                </Section>
              )}
              {sections.some((s) => s.id === "eligibility") && d && (
                <Section id="eligibility" title="Eligibility and categories">
                  <EligibilityBody d={d} />
                </Section>
              )}
              {sections.some((s) => s.id === "contacts") && d && (
                <Section id="contacts" title="Organiser and contacts">
                  <ContactsBody d={d} />
                </Section>
              )}
              <Section id="more" title="More tournaments">
                <MoreTournaments e={data} />
              </Section>
              <p className="border-t border-border pt-6 text-small text-muted">
                {data.extractedAt
                  ? <>Summarised automatically from the official brochure on {formatDate(data.extractedAt.slice(0, 10))}. Always confirm details with the organiser before you travel.</>
                  : <>Listing from the All India Chess Federation calendar. Confirm details with the organiser before you travel.</>}
              </p>
            </div>
            <aside className="hidden lg:block" aria-label="Page navigation">
              <div className="sticky top-[calc(var(--toolbar-h)+96px)]">
                <SectionNav sections={sections} active={active} />
                <div className="mt-8 space-y-1.5 border-t border-border pt-5 text-small">
                  <p className="text-label font-medium uppercase tracking-[0.08em] text-muted">Sources</p>
                  {data.brochureUrl && <a href={data.brochureUrl} target="_blank" rel="noopener noreferrer" className="block text-muted hover:text-fg">Brochure PDF ↗</a>}
                  <a href={data.aicfUrl} target="_blank" rel="noopener noreferrer" className="block text-muted hover:text-fg">AICF calendar ↗</a>
                  <p className="font-mono text-label text-subtle">#{data.eventCode}</p>
                </div>
              </div>
            </aside>
          </div>
          {/* room for the mobile bottom action bar */}
          <div className="h-16 md:hidden" aria-hidden />
          <CondensedBar e={data} name={name} show={scrolledPast} />
        </>
      )}
    </Container>
  );
}
