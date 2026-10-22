import { useState } from "react";
import { CalendarPlus, Check, ExternalLink, FileText, Link2, Mail, MapPin, MessageCircle, Phone, Share2 } from "lucide-react";
import type { BrochureExtraction, EventDetail, EventSummary } from "@/types/event";
import { Button } from "@/components/ui/button";
import { calendarUrl } from "@/lib/api";
import { digitsToWhatsApp, formatInrFull, formatMoney, formatWeekday, telHref, todayIST } from "@/lib/format";
import { cn, mapsOpenUrl } from "@/lib/utils";
import { groupCategoryPrizes, groupSchedule, venueQuery } from "@/lib/eventDetail";

/* ───────────── prizes ───────────── */


/** Main standings as a ladder: each place gets a bar proportional to its amount. */
export function PrizeLadder({ places, limit }: { places: BrochureExtraction["prizes"]["places"]; limit?: number }) {
  const [all, setAll] = useState(false);
  const max = Math.max(1, ...places.map((p) => p.amountInr ?? 0));
  const shown = limit && !all ? places.slice(0, limit) : places;
  return (
    <div>
      <ol className="space-y-1">
        {shown.map((p, i) => (
          <li key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 py-1 text-ui">
            <span className="truncate text-muted" title={p.label}>{p.label}</span>
            <span className="relative h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className={cn("absolute inset-y-0 left-0 rounded-full", i === 0 ? "bg-accent" : "bg-border-strong")} style={{ width: `${((p.amountInr ?? 0) / max) * 100}%` }} />
            </span>
            <span className="text-right font-medium">
              {p.amountInr != null ? <span title={formatInrFull(p.amountInr)}>{formatMoney(p.amountInr)}</span> : <span className="text-muted">—</span>}
              {p.extra && <span className="ml-1.5 text-small font-normal text-muted">+ {p.extra}</span>}
            </span>
          </li>
        ))}
      </ol>
      {limit && places.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 text-small font-medium text-accent hover:underline">
          {all ? "Show fewer places" : `Show all ${places.length} places`}
        </button>
      )}
    </div>
  );
}


export function CategoryPrizes({ list, limit = 6 }: { list: BrochureExtraction["prizes"]["categoryPrizes"]; limit?: number }) {
  const [all, setAll] = useState(false);
  const groups = groupCategoryPrizes(list);
  const shown = all ? groups : groups.slice(0, limit);
  return (
    <div>
      <ul className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
        {shown.map((g) => (
          <li key={g.category} className="bg-surface p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h4 className="min-w-0 text-ui font-medium">{g.category}</h4>
              {g.total > 0 && <span className="shrink-0 text-small text-muted">{formatMoney(g.total)}</span>}
            </div>
            <ul className="mt-2 space-y-0.5 text-small">
              {g.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="truncate text-muted">{it.label}</span>
                  <span className="shrink-0 font-medium">{it.amountInr != null ? formatMoney(it.amountInr) : "Trophy"}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {shown.length % 2 === 1 && <li className="hidden bg-surface sm:block" aria-hidden />}
      </ul>
      {groups.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-small font-medium text-accent hover:underline">
          {all ? "Show fewer categories" : `Show all ${groups.length} prize categories`}
        </button>
      )}
    </div>
  );
}

/* ───────────── fees ───────────── */

export function FeeTable({ fees }: { fees: BrochureExtraction["entryFees"] }) {
  return (
    <table className="w-full text-ui">
      <caption className="sr-only">Entry fees by category</caption>
      <tbody className="divide-y divide-border">
        {fees.map((f, i) => (
          <tr key={i}>
            <th scope="row" className="py-2.5 pr-4 text-left font-normal text-fg">{f.category}</th>
            <td className="whitespace-nowrap py-2.5 text-right font-medium">
              {f.amountInr == null ? <span className="text-muted">See brochure</span> : f.amountInr === 0 ? <span className="text-accent">Free</span> : <span title={formatInrFull(f.amountInr)}>{formatInrFull(f.amountInr)}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────────── schedule ───────────── */


export function ScheduleTimeline({ items, limit }: { items: BrochureExtraction["schedule"]; limit?: number }) {
  const [all, setAll] = useState(false);
  const shownItems = limit && !all ? items.slice(0, limit) : items;
  const groups = groupSchedule(shownItems);
  return (
    <div>
      <ol className="relative space-y-5 border-l border-border pl-5">
        {groups.map((g, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-border-strong bg-surface ring-4 ring-surface" aria-hidden />
            <h4 className="text-ui font-medium">{g.date ? formatWeekday(g.date) : "Date to be announced"}</h4>
            <ul className="mt-1.5 space-y-1">
              {g.rows.map((r, j) => (
                <li key={j} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 text-ui">
                  <span className="text-muted">{r.time ?? ""}</span>
                  <span className={cn(/^round\s*\d+/i.test(r.item) && "font-medium")}>{r.item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {limit && items.length > limit && (
        <button type="button" onClick={() => setAll(!all)} className="mt-3 text-small font-medium text-accent hover:underline">
          {all ? "Show less" : `Show full schedule (${items.length} items)`}
        </button>
      )}
    </div>
  );
}

/* ───────────── contacts ───────────── */

const splitPhones = (p: string) => p.split(/\s*(?:[/,;]|\bor\b)\s*/).map((x) => x.trim()).filter((x) => x.replace(/\D/g, "").length >= 8);

export function ContactList({ contacts, compact }: { contacts: BrochureExtraction["contacts"]; compact?: boolean }) {
  const link = "inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-strong bg-surface px-2.5 text-small font-medium text-fg transition-colors hover:bg-surface-2";
  return (
    <ul className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
      {contacts.map((c, i) => {
        const phones = c.phone ? splitPhones(c.phone) : [];
        return (
          <li key={i} className="rounded-md border border-border p-3.5">
            <p className="text-ui font-medium">{c.name ?? "Organiser"}</p>
            {c.role && <p className="text-small text-muted">{c.role}</p>}
            {(phones.length > 0 || c.email) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {phones.map((ph) => {
                  const wa = digitsToWhatsApp(ph);
                  return (
                    <span key={ph} className="contents">
                      <a className={link} href={telHref(ph)} aria-label={`Call ${c.name ?? "organiser"} on ${ph}`}><Phone className="h-3.5 w-3.5 text-muted" aria-hidden />{ph}</a>
                      {wa && <a className={link} href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${c.name ?? "organiser"}`}><MessageCircle className="h-3.5 w-3.5 text-muted" aria-hidden />WhatsApp</a>}
                    </span>
                  );
                })}
                {c.email && <a className={cn(link, "max-w-full")} href={`mailto:${c.email}`}><Mail className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden /><span className="truncate">{c.email}</span></a>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ───────────── venue ───────────── */


/* ───────────── actions ───────────── */

export function ShareButton({ title, url, className }: { title: string; url?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const href = url ?? window.location.href;
    if ("share" in navigator) {
      try { await navigator.share({ title, url: href }); return; } catch (err) { if ((err as Error).name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt("Copy this link", href); }
  };
  return (
    <Button variant="secondary" onClick={share} className={className}>
      {copied ? <Check aria-hidden /> : "share" in navigator ? <Share2 aria-hidden /> : <Link2 aria-hidden />}
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </Button>
  );
}

export function EventActions({ e, size = "md", full, className, children }: { e: EventSummary & Partial<Pick<EventDetail, "details">>; size?: "md" | "lg"; full?: boolean; className?: string; children?: React.ReactNode }) {
  const reg = e.details?.registration.link;
  const deadline = e.details?.registration.deadline ?? e.registrationDeadline;
  // Hide "Register" once the event is over or the published deadline has passed.
  const live = e.status !== "past" && !(deadline && deadline < todayIST());
  const mapQ = venueQuery(e, e.details ?? null);
  return (
    <div className={cn("flex flex-wrap gap-2", full && "[&>*]:flex-1", className)}>
      {reg && live && (
        <Button asChild size={size} className={cn(full && "basis-full")}>
          <a href={reg} target="_blank" rel="noopener noreferrer">Register<ExternalLink aria-hidden /></a>
        </Button>
      )}
      {e.brochureUrl && (
        <Button asChild size={size} variant={reg && live ? "secondary" : "primary"} className={cn(full && !(reg && live) && "basis-full")}>
          <a href={e.brochureUrl} target="_blank" rel="noopener noreferrer"><FileText aria-hidden />Brochure</a>
        </Button>
      )}
      <Button asChild size={size} variant="secondary">
        <a href={calendarUrl(e.eventCode)} download><CalendarPlus aria-hidden />Add to calendar</a>
      </Button>
      {mapQ && !full && (
        <Button asChild size={size} variant="secondary">
          <a href={mapsOpenUrl(mapQ)} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden />Map</a>
        </Button>
      )}
      {children}
    </div>
  );
}
