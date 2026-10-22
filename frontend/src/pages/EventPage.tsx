import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, CalendarPlus, Check, ExternalLink, FileText, Link2, Mail, MapPin, MessageCircle, Phone, Share2,
} from "lucide-react";
import type { BrochureExtraction, EventDetail } from "@/types/event";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DeadlineWarning, Pill, StartIndicator } from "@/components/EventBits";
import { ErrorState } from "@/components/States";
import NotFoundPage from "@/pages/NotFoundPage";
import { useEvent } from "@/hooks/queries";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError, calendarUrl } from "@/lib/api";
import {
  location, deadlineDays, deadlineLabel, digitsToWhatsApp, formatDate, formatDateRange, formatInr, formatInrFull, formatWeekday, telHref,
} from "@/lib/format";
import { mapsEmbedUrl, mapsOpenUrl } from "@/lib/utils";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20 border-t border-line pt-6">
      <h2 id={id} className="mb-4 text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const Money = ({ n }: { n: number | null }) => (n == null ? <span className="text-muted">—</span> : <span title={formatInrFull(n)}>{formatInr(n)}</span>);

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{children}</dd>
    </div>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if ("share" in navigator) {
      try { await navigator.share({ title, url }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copy this link", url); }
  };
  return (
    <Button variant="outline" onClick={share}>
      {copied ? <Check className="h-4 w-4" aria-hidden /> : "share" in navigator ? <Share2 className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </Button>
  );
}

function Schedule({ items }: { items: BrochureExtraction["schedule"] }) {
  const groups: { date: string | null; rows: typeof items }[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && g.date === it.date) g.rows.push(it);
    else groups.push({ date: it.date, rows: [it] });
  }
  return (
    <ol className="space-y-5">
      {groups.map((g, i) => (
        <li key={i} className="relative border-l-2 border-line pl-5">
          <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-accent bg-paper" aria-hidden />
          <h3 className="font-sans text-[15px] font-semibold">{g.date ? formatWeekday(g.date) : "Date to be announced"}</h3>
          <ul className="mt-1.5 space-y-1">
            {g.rows.map((r, j) => (
              <li key={j} className="flex gap-3 text-[15px]">
                <span className="w-14 shrink-0 text-muted">{r.time ?? ""}</span>
                <span>{r.item}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function Contacts({ contacts }: { contacts: BrochureExtraction["contacts"] }) {
  const linkCls = "inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-2.5 text-[13px] font-medium hover:bg-sunk";
  return (
    <ul className="space-y-4">
      {contacts.map((c, i) => {
        const wa = c.phone ? digitsToWhatsApp(c.phone) : null;
        return (
          <li key={i}>
            <p className="font-semibold">{c.name ?? "Organiser"}</p>
            {c.role && <p className="text-[13px] text-muted">{c.role}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {c.phone && <a className={linkCls} href={telHref(c.phone)}><Phone className="h-3.5 w-3.5" aria-hidden />{c.phone}</a>}
              {wa && <a className={linkCls} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" aria-hidden />WhatsApp</a>}
              {c.email && <a className={linkCls} href={`mailto:${c.email}`}><Mail className="h-3.5 w-3.5" aria-hidden />{c.email}</a>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Prizes({ p }: { p: BrochureExtraction["prizes"] }) {
  const th = "py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted";
  return (
    <div className="space-y-6">
      {p.totalInr != null && (
        <p className="font-display text-4xl font-semibold" title={formatInrFull(p.totalInr)}>
          {formatInr(p.totalInr)} <span className="font-sans text-base font-normal text-muted">total prize fund · {formatInrFull(p.totalInr)}</span>
        </p>
      )}
      {p.places.length > 0 && (
        <table className="w-full max-w-lg text-[15px]">
          <caption className="sr-only">Main prizes</caption>
          <thead><tr className="border-b border-line"><th scope="col" className={th}>Place</th><th scope="col" className={`${th} text-right`}>Prize</th></tr></thead>
          <tbody className="divide-y divide-line">
            {p.places.map((r, i) => (
              <tr key={i}>
                <th scope="row" className="py-2 text-left font-medium">{r.label}{r.extra && <span className="ml-2 text-[13px] font-normal text-muted">+ {r.extra}</span>}</th>
                <td className="py-2 text-right font-semibold"><Money n={r.amountInr} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {p.categoryPrizes.length > 0 && (
        <div>
          <h3 className="mb-2 font-sans text-[15px] font-semibold">Category prizes</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.categoryPrizes.map((r, i) => (
              <li key={i} className="flex justify-between rounded-lg bg-sunk px-3 py-2 text-[15px]">
                <span>{r.category} <span className="text-muted">· {r.label}</span></span>
                <span className="font-semibold"><Money n={r.amountInr} /></span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p.notes && <p className="text-[14px] text-muted">{p.notes}</p>}
    </div>
  );
}

function Details({ e, d }: { e: EventDetail; d: BrochureExtraction }) {
  const paras = d.summary?.split(/\n{2,}/).filter(Boolean) ?? [];
  const hasPrizes = d.prizes.totalInr != null || d.prizes.places.length > 0 || d.prizes.categoryPrizes.length > 0;
  const hasRating = d.categories.rating.length > 0, hasAge = d.categories.age.length > 0;
  const hasVenue = d.venue.name || d.venue.address || d.venue.mapQuery;
  const mapQ = d.venue.mapQuery ?? [d.venue.name, d.venue.address, e.city, e.state].filter(Boolean).join(", ");
  return (
    <>
      {paras.length > 0 && (
        <Section id="summary" title="About this tournament">
          <div className="max-w-prose space-y-3 text-[16px] leading-relaxed">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
        </Section>
      )}
      {hasPrizes && <Section id="prizes" title="Prizes"><Prizes p={d.prizes} /></Section>}
      {d.entryFees.length > 0 && (
        <Section id="fees" title="Entry fees">
          <table className="w-full max-w-lg text-[15px]">
            <caption className="sr-only">Entry fees</caption>
            <tbody className="divide-y divide-line border-y border-line">
              {d.entryFees.map((f, i) => (
                <tr key={i}><th scope="row" className="py-2 text-left font-medium">{f.category}</th><td className="py-2 text-right font-semibold"><Money n={f.amountInr} /></td></tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {(hasRating || hasAge) && (
        <Section id="categories" title="Categories">
          <div className="space-y-4">
            {hasRating && <div><h3 className="mb-2 font-sans text-[13px] font-semibold uppercase tracking-wider text-muted">Rating</h3><ul className="flex flex-wrap gap-1.5">{d.categories.rating.map((c) => <li key={c}><Pill>{c}</Pill></li>)}</ul></div>}
            {hasAge && <div><h3 className="mb-2 font-sans text-[13px] font-semibold uppercase tracking-wider text-muted">Age</h3><ul className="flex flex-wrap gap-1.5">{d.categories.age.map((c) => <li key={c}><Pill>{c}</Pill></li>)}</ul></div>}
          </div>
        </Section>
      )}
      {d.schedule.length > 0 && <Section id="schedule" title="Schedule"><Schedule items={d.schedule} /></Section>}
      {hasVenue && (
        <Section id="venue" title="Venue">
          <p className="font-semibold">{d.venue.name ?? location(e)}</p>
          {d.venue.address && <p className="text-muted">{d.venue.address}{d.venue.pincode ? ` — ${d.venue.pincode}` : ""}</p>}
          {mapQ && (
            <>
              <iframe
                title={`Map of ${d.venue.name ?? "venue"}`}
                src={mapsEmbedUrl(mapQ)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="mt-4 h-72 w-full rounded-xl border border-line bg-sunk"
              />
              <Button asChild variant="outline" className="mt-3">
                <a href={mapsOpenUrl(mapQ)} target="_blank" rel="noopener noreferrer"><MapPin className="h-4 w-4" aria-hidden />Open in Maps</a>
              </Button>
            </>
          )}
        </Section>
      )}
      {d.eligibility && <Section id="eligibility" title="Eligibility"><p className="max-w-prose">{d.eligibility}</p></Section>}
      {d.accommodation && <Section id="stay" title="Accommodation"><p className="max-w-prose">{d.accommodation}</p></Section>}
      {(d.organizer || d.chiefArbiter) && (
        <Section id="people" title="Organiser & arbiter">
          <dl className="grid gap-4 sm:grid-cols-2">
            {d.organizer && <div><dt className="text-[13px] text-muted">Organiser</dt><dd className="font-semibold">{d.organizer}</dd></div>}
            {d.chiefArbiter && <div><dt className="text-[13px] text-muted">Chief arbiter</dt><dd className="font-semibold">{d.chiefArbiter}</dd></div>}
          </dl>
        </Section>
      )}
    </>
  );
}

function Skeletons() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-10" role="status" aria-label="Loading tournament">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function EventPage() {
  const { eventCode = "" } = useParams();
  const { data: e, isPending, isError, error, refetch } = useEvent(eventCode);
  const d = e?.details ?? null;
  useDocumentMeta(
    e?.name,
    e ? (d?.tagline ?? d?.summary?.split("\n")[0] ?? `${e.name} — ${formatDateRange(e.startDate, e.endDate, true)}, ${location(e)}.`) : undefined
  );

  if (isPending) return <Skeletons />;
  if (isError) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage what="tournament" />;
    return <div className="mx-auto max-w-xl px-4 py-16"><ErrorState message={error.message} onRetry={() => refetch()} /></div>;
  }

  const done = e.extractionStatus === "done" && d;
  const dl = deadlineDays(d?.registration.deadline ?? e.registrationDeadline);
  const fees = d?.entryFees.map((f) => f.amountInr).filter((n): n is number => n != null) ?? [];
  const feeRange = fees.length ? (Math.min(...fees) === Math.max(...fees) ? formatInr(fees[0]) : `${formatInr(Math.min(...fees))} – ${formatInr(Math.max(...fees))}`) : e.entryFeeMinInr != null ? `from ${formatInr(e.entryFeeMinInr)}` : null;
  const tcText = d?.timeControl.raw ?? null;
  const regLink = d?.registration.link;

  return (
    <article className="mx-auto max-w-5xl px-4 pb-4 pt-6 sm:pt-8">
      <Link to="/" onClick={(ev) => { if (window.history.length > 1) { ev.preventDefault(); window.history.back(); } }} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All tournaments
      </Link>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <StartIndicator e={e} />
          {e.fideRated && <Pill tone="accent">FIDE rated</Pill>}
          {e.status !== "past" && <DeadlineWarning deadline={e.registrationDeadline} end={e.endDate} />}
        </div>
        <h1 className="mt-3 max-w-3xl text-balance text-3xl font-semibold leading-[1.1] sm:text-5xl">{e.name}</h1>
        {d?.tagline && <p className="mt-3 max-w-2xl text-lg text-muted">{d.tagline}</p>}
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[16px] font-medium">
          <span>{formatDateRange(e.startDate, e.endDate, true)}</span>
          <span className="inline-flex items-center gap-1.5 text-muted"><MapPin className="h-4 w-4" aria-hidden />{location(e)}</span>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {regLink && e.status !== "past" && (
            <Button asChild size="lg"><a href={regLink} target="_blank" rel="noopener noreferrer">Register<ExternalLink className="h-4 w-4" aria-hidden /></a></Button>
          )}
          <Button asChild variant="outline"><a href={calendarUrl(e.eventCode)} download><CalendarPlus className="h-4 w-4" aria-hidden />Add to calendar</a></Button>
          <ShareButton title={e.name} />
          {e.brochureUrl && <Button asChild variant="outline"><a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" aria-hidden />Brochure PDF</a></Button>}
          <Button asChild variant="ghost"><a href={e.aicfUrl} target="_blank" rel="noopener noreferrer">View on AICF<ExternalLink className="h-4 w-4" aria-hidden /></a></Button>
        </div>
      </header>

      {done && (
        <dl className="mt-8 grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0 [&>div]:border-line">
          <Fact label="Time control">{d.timeControl.type ?? "—"}{tcText && <span className="mt-0.5 block text-[13px] font-normal text-muted">{tcText}</span>}</Fact>
          <Fact label="Rounds">{e.rounds ?? "—"}{d.format && <span className="ml-1.5 text-[13px] font-normal text-muted">{d.format}</span>}</Fact>
          <Fact label="FIDE rated">{e.fideRated == null ? "—" : e.fideRated ? "Yes" : "No"}</Fact>
          <Fact label="Prize pool"><Money n={e.totalPrizeInr} /></Fact>
          <Fact label="Entry fee">{feeRange ?? "—"}</Fact>
        </dl>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-8">
          {done ? (
            <Details e={e} d={d} />
          ) : (
            <section className="rounded-xl border border-dashed border-line bg-surface/60 p-6 sm:p-8" aria-labelledby="pending">
              <h2 id="pending" className="text-2xl font-semibold">Details not yet extracted</h2>
              <p className="mt-2 max-w-prose text-muted">
                {e.brochureUrl
                  ? "We haven't finished reading this tournament's brochure yet, so prizes, fees and the schedule aren't shown here. The brochure has everything in the meantime."
                  : "The organisers haven't published a brochure for this event yet. Check back closer to the date, or see the official AICF listing."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {e.brochureUrl && <Button asChild><a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4" aria-hidden />Open brochure PDF</a></Button>}
                <Button asChild variant="outline"><a href={e.aicfUrl} target="_blank" rel="noopener noreferrer">AICF listing<ExternalLink className="h-4 w-4" aria-hidden /></a></Button>
              </div>
            </section>
          )}
        </div>

        {done && (
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start" aria-label="Registration and contacts">
            <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="reg">
              <h2 id="reg" className="text-xl font-semibold">Registration</h2>
              {d.registration.deadline ? (
                <p className="mt-2">
                  Closes <strong>{formatDate(d.registration.deadline)}</strong>
                  {dl != null && <span className={dl <= 7 ? "ml-1.5 font-semibold text-brass" : "ml-1.5 text-muted"}>({deadlineLabel(dl)})</span>}
                  {dl == null && <span className="ml-1.5 text-muted">(closed)</span>}
                </p>
              ) : <p className="mt-2 text-muted">No deadline announced.</p>}
              {d.registration.notes && <p className="mt-2 text-[14px] text-muted">{d.registration.notes}</p>}
              {regLink && <Button asChild className="mt-4 w-full"><a href={regLink} target="_blank" rel="noopener noreferrer">Register online<ExternalLink className="h-4 w-4" aria-hidden /></a></Button>}
            </section>
            {d.contacts.length > 0 && (
              <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="contacts">
                <h2 id="contacts" className="mb-3 text-xl font-semibold">Contacts</h2>
                <Contacts contacts={d.contacts} />
              </section>
            )}
          </aside>
        )}
      </div>

      {e.extractedAt && <p className="mt-12 text-[13px] text-muted">Details summarised from the official brochure by AI on {formatDate(e.extractedAt.slice(0, 10))}; always confirm with the organiser.</p>}
    </article>
  );
}
