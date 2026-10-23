import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, BedDouble, Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import type { BrochureExtraction, EventDetail } from "@/types/event";
import { Button } from "@/components/ui/button";
import { EASE, Reveal } from "@/components/event-page/motion";
import { groupSchedule, registrationOf, splitPhones, venueQuery } from "@/lib/eventDetail";
import { daysBetween, digitsToWhatsApp, formatDayMonth, formatInrFull, formatWeekday, formatWeekdayShort, telHref, todayIST } from "@/lib/format";
import { useSeen } from "@/hooks/useInView";
import { cn, mapsEmbedUrl, mapsOpenUrl } from "@/lib/utils";

export function Section({ id, title, meta, children, className }: { id: string; title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("scroll-mt-[calc(var(--toolbar-h)+84px)] border-t border-border py-12 first:border-t-0 first:pt-2 sm:py-14", className)}>
      <Reveal>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id={`${id}-h`} className="text-h2 font-semibold tracking-h2">{title}</h2>
          {meta && <span className="text-small text-muted">{meta}</span>}
        </div>
      </Reveal>
      <Reveal delay={0.05}>{children}</Reveal>
    </section>
  );
}

/* ───────────── entry ───────────── */

export function EntryBody({ e, d }: { e: EventDetail; d: BrochureExtraction }) {
  const reg = registrationOf(e);
  const paid = d.entryFees.map((f) => f.amountInr).filter((x): x is number => x != null && x > 0);
  const low = paid.length ? Math.min(...paid) : null;
  const lowIdx = d.entryFees.findIndex((f) => f.amountInr === low);
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_260px]">
      {d.entryFees.length > 0 ? (
        <table className="w-full self-start text-ui">
          <caption className="sr-only">Entry fees by category</caption>
          <thead>
            <tr className="border-b border-border text-label uppercase tracking-[0.08em] text-muted">
              <th scope="col" className="pb-2 text-left font-medium">Category</th>
              <th scope="col" className="pb-2 text-right font-medium">Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {d.entryFees.map((f, i) => (
              <tr key={i}>
                <th scope="row" className="py-3 pr-4 text-left font-normal">{f.category}</th>
                <td className="whitespace-nowrap py-3 text-right font-medium tabular-nums">
                  {f.amountInr == null ? <span className="text-muted">See brochure</span>
                    : f.amountInr === 0 ? <span className="text-accent">Free</span>
                    : <span className="inline-flex items-center gap-2">{i === lowIdx && paid.length > 1 && <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-label font-medium text-muted">Lowest</span>}{formatInrFull(f.amountInr)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-body text-muted">The brochure doesn't list entry fees. Check with the organiser before you pay.</p>
      )}
      <aside className="self-start rounded-md border border-border bg-surface p-4">
        <p className="text-label font-medium uppercase tracking-[0.08em] text-muted">Registration</p>
        <p className={cn("mt-2 text-[17px] font-semibold tracking-h3", reg.daysLeft != null && reg.daysLeft <= 7 && "text-warn")}>
          {reg.closed ? "Closed" : reg.deadline ? `Closes ${formatWeekdayShort(reg.deadline)} ${formatDayMonth(reg.deadline)}` : "Deadline not listed"}
        </p>
        {reg.daysLeft != null && <p className="text-small text-muted">{reg.daysLeft === 0 ? "Today is the last day" : reg.daysLeft === 1 ? "Tomorrow is the last day" : `${reg.daysLeft} days left`}</p>}
        {reg.open && reg.link && (
          <Button asChild className="mt-4 w-full"><a href={reg.link} target="_blank" rel="noopener noreferrer">Register<ArrowUpRight aria-hidden /></a></Button>
        )}
      </aside>
      {d.registration.notes && (
        <div className="md:col-span-2">
          <h3 className="mb-1.5 text-ui font-semibold">How to register</h3>
          <p className="max-w-[72ch] text-body leading-relaxed text-muted">{d.registration.notes}</p>
        </div>
      )}
    </div>
  );
}

/* ───────────── schedule ───────────── */

const isRound = (s: string) => /\bround\s*\d+|\br\s?\d+\b/i.test(s);
const roundNo = (s: string) => /\bround\s*(\d+)/i.exec(s)?.[1] ?? null;

export function ScheduleBody({ e, items }: { e: EventDetail; items: BrochureExtraction["schedule"] }) {
  const reduce = useReducedMotion();
  const today = todayIST();
  const groups = groupSchedule(items);
  const [all, setAll] = useState(items.length <= 18);
  let count = 0;
  const shown = all ? groups : groups.filter((g) => (count += g.rows.length) - g.rows.length < 10);
  return (
    <div>
      <ol className="relative">
        {shown.map((g, gi) => {
          const isToday = g.date === today;
          const done = !!g.date && g.date < today;
          const dayN = g.date ? daysBetween(e.startDate, g.date) + 1 : null;
          return (
            <motion.li
              key={g.date ?? `tba-${gi}`}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px 0px -6% 0px" }}
              transition={{ duration: 0.5, ease: EASE }}
              className={cn("relative grid gap-x-6 pb-8 pl-7 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)]", done && "opacity-60")}
            >
              {/* rail */}
              <span className={cn("absolute -bottom-1 left-[5px] top-4 w-px bg-border", gi === shown.length - 1 && "hidden")} aria-hidden />
              <span className={cn("absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full border-2 bg-bg", isToday ? "border-accent" : "border-border-strong")} aria-hidden>
                {isToday && <span className="pulse-dot absolute inset-[2px] rounded-full bg-accent" />}
              </span>
              <div className="mb-2 sm:mb-0">
                <p className="font-mono text-label uppercase tracking-[0.08em] text-muted">{dayN == null ? "Date" : dayN < 1 ? "Before play" : dayN <= 60 ? `Day ${dayN}` : "After"}{isToday && <span className="ml-2 text-accent">Today</span>}</p>
                <h3 className="mt-0.5 text-ui font-semibold">{g.date ? formatWeekday(g.date) : "To be announced"}</h3>
              </div>
              <ul className="divide-y divide-border rounded-md border border-border bg-surface">
                {g.rows.map((r, j) => {
                  const round = isRound(r.item);
                  const n = roundNo(r.item);
                  return (
                    <li key={j} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 text-ui">
                      <span className="font-mono text-small text-muted">{r.time ?? "—"}</span>
                      <span className={cn("min-w-0", round ? "font-medium text-fg" : "text-muted")}>{r.item}</span>
                      {n && <span className="grid h-6 min-w-6 place-items-center rounded-sm bg-surface-2 px-1.5 font-mono text-label text-muted" aria-hidden>R{n}</span>}
                    </li>
                  );
                })}
              </ul>
            </motion.li>
          );
        })}
      </ol>
      {!all && (
        <button type="button" onClick={() => setAll(true)} className="mt-4 ml-7 inline-flex h-9 items-center rounded-sm text-small font-medium text-accent hover:underline">
          Show the full schedule ({items.length} items)
        </button>
      )}
    </div>
  );
}

/* ───────────── venue ───────────── */

export function VenueBody({ e, d }: { e: EventDetail; d: BrochureExtraction | null }) {
  const q = venueQuery(e, d);
  const [ref, seen] = useSeen<HTMLDivElement>("200px");
  const name = d?.venue.name ?? e.venueName;
  const loc = [e.city ?? d?.venue.city, e.state ?? d?.venue.state].filter(Boolean).join(", ");
  return (
    <div className="space-y-8">
      {q && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-e1 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
            <div>
              <p className="text-label font-medium uppercase tracking-[0.08em] text-muted">Venue</p>
              <p className="mt-2 text-[19px] font-semibold leading-snug tracking-h3">{name ?? loc}</p>
              {d?.venue.address && <p className="mt-1 text-body text-muted">{d.venue.address}</p>}
              {name ? <p className="text-body text-muted">{loc}{d?.venue.pincode ? ` ${d.venue.pincode}` : ""}</p> : <p className="mt-1 text-small text-muted">The exact venue isn't listed yet. The map shows the city.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary"><a href={mapsOpenUrl(q)} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden />Open in Maps</a></Button>
              <Button asChild variant="ghost"><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden />Directions</a></Button>
            </div>
          </div>
          <div ref={ref} className="relative h-56 border-t border-border bg-surface-2 md:h-auto md:min-h-72 md:border-l md:border-t-0">
            {/* dotted placeholder until the map loads */}
            <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:14px_14px]" aria-hidden />
            <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-fg shadow-e2" aria-hidden><MapPin className="h-4 w-4" /></span>
            {seen && (
              <iframe
                title={`Map of ${name ?? loc}`}
                src={mapsEmbedUrl(q)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 h-full w-full dark:[filter:invert(0.9)_hue-rotate(180deg)_saturate(0.7)_brightness(0.95)]"
              />
            )}
          </div>
        </div>
      )}
      {d?.accommodation && (
        <div className="flex gap-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted" aria-hidden><BedDouble className="h-4 w-4" /></span>
          <div>
            <h3 className="text-ui font-semibold">Where to stay</h3>
            <p className="mt-1 max-w-[72ch] text-body leading-relaxed text-muted">{d.accommodation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── eligibility ───────────── */

function Chips({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2.5 text-label font-medium uppercase tracking-[0.08em] text-muted">{title}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((c) => (
          <li key={c} className="inline-flex h-8 items-center rounded-sm border border-border bg-surface px-3 text-ui">{c}</li>
        ))}
      </ul>
    </div>
  );
}

export function EligibilityBody({ d }: { d: BrochureExtraction }) {
  return (
    <div className="space-y-7">
      {d.categories.rating.length > 0 && <Chips title="Rating groups" items={d.categories.rating} />}
      {d.categories.age.length > 0 && <Chips title="Age groups" items={d.categories.age} />}
      {d.eligibility && (
        <div className="rounded-md border-l-2 border-accent bg-surface-2/60 px-4 py-3">
          <h3 className="text-ui font-semibold">Who can play</h3>
          <p className="mt-1 max-w-[72ch] text-body leading-relaxed text-muted">{d.eligibility}</p>
        </div>
      )}
    </div>
  );
}

/* ───────────── contacts ───────────── */

const pill = "inline-flex h-9 items-center gap-1.5 rounded-sm border border-border bg-surface px-2.5 text-small font-medium text-fg transition-colors hover:border-border-strong hover:bg-surface-2";

export function ContactsBody({ d }: { d: BrochureExtraction }) {
  const [all, setAll] = useState(false);
  // Brochures repeat people; collapse exact duplicates.
  const seen = new Set<string>();
  const contacts = d.contacts.filter((c) => {
    const k = `${c.name}|${c.phone}|${c.email}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const LIMIT = 6;
  const shown = all ? contacts : contacts.slice(0, LIMIT);
  return (
    <div className="space-y-8">
      {(d.organizer || d.chiefArbiter) && (
        <dl className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {d.organizer && <div className="bg-surface p-4"><dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">Organiser</dt><dd className="mt-1.5 text-body font-medium">{d.organizer}</dd></div>}
          {d.chiefArbiter && <div className="bg-surface p-4"><dt className="text-label font-medium uppercase tracking-[0.08em] text-muted">Chief arbiter</dt><dd className="mt-1.5 text-body font-medium">{d.chiefArbiter}</dd></div>}
        </dl>
      )}
      {contacts.length > 0 && (
        <div>
          <ul className="divide-y divide-border border-y border-border">
            {shown.map((c, i) => {
              const phones = c.phone ? splitPhones(c.phone) : [];
              const who = c.name ?? "the organiser";
              return (
                <li key={i} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-ui font-medium">{c.name ?? "Organiser"}</p>
                    {c.role && <p className="truncate text-small text-muted">{c.role}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:justify-end">
                    {phones.map((ph) => {
                      const wa = digitsToWhatsApp(ph);
                      return (
                        <span key={ph} className="contents">
                          <a className={pill} href={telHref(ph)} aria-label={`Call ${who} on ${ph}`}><Phone className="h-3.5 w-3.5 text-muted" aria-hidden /><span className="font-mono text-[12.5px]">{ph.replace(/^\+91[-\s]?/, "")}</span></a>
                          {wa && <a className={pill} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${who}`}><MessageCircle className="h-3.5 w-3.5 text-muted" aria-hidden /><span className="max-sm:sr-only">WhatsApp</span></a>}
                        </span>
                      );
                    })}
                    {c.email && <a className={cn(pill, "max-w-full")} href={`mailto:${c.email}`} aria-label={`Email ${who}`}><Mail className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden /><span className="truncate">{c.email}</span></a>}
                  </div>
                </li>
              );
            })}
          </ul>
          {contacts.length > LIMIT && (
            <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="mt-3 inline-flex h-9 items-center rounded-sm text-small font-medium text-accent hover:underline">
              {all ? "Show fewer contacts" : `Show all ${contacts.length} contacts`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
