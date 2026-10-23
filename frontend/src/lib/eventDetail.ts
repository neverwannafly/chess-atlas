import type { BrochureExtraction, EventDetail, EventSummary } from "@/types/event";
import { addDays, daysBetween, formatDayMonth, formatInrFull, pluralize, todayIST } from "@/lib/format";
import { tcShort } from "@/lib/eventFacts";

type Prizes = BrochureExtraction["prizes"];
type CategoryPrize = Prizes["categoryPrizes"][number];

export function hasPrizes(p: Prizes) {
  return (p.totalInr != null && p.totalInr > 0) || p.places.length > 0 || p.categoryPrizes.length > 0;
}

export function groupCategoryPrizes(list: CategoryPrize[]) {
  const groups: { category: string; items: { label: string; amountInr: number | null }[]; total: number }[] = [];
  for (const c of list) {
    let g = groups.find((x) => x.category === c.category);
    if (!g) groups.push((g = { category: c.category, items: [], total: 0 }));
    g.items.push({ label: c.label, amountInr: c.amountInr });
    g.total += c.amountInr ?? 0;
  }
  return groups;
}

export type CategoryGroup = ReturnType<typeof groupCategoryPrizes>[number];

/**
 * Festivals list several events' category prizes together ("Rapid - U-11 (Boys)").
 * Split them into one tab per event, keeping the brochure's order.
 */
export function categoryPrizeSections(list: CategoryPrize[]): { name: string; groups: CategoryGroup[]; total: number; count: number }[] {
  const sections: { name: string; items: CategoryPrize[] }[] = [];
  for (const c of list) {
    const m = /^(Classical|Rapid|Blitz|Standard|Open|Main|Women|Junior|Senior|Below \d+)\s+[-–:]\s+(.+)$/i.exec(c.category);
    const name = m ? m[1][0].toUpperCase() + m[1].slice(1) : "";
    const category = m ? (/^main$/i.test(m[2]) ? "Main standings" : m[2]) : c.category;
    let s = sections.find((x) => x.name === name);
    if (!s) sections.push((s = { name, items: [] }));
    s.items.push({ ...c, category });
  }
  return sections.map((s) => {
    const groups = groupCategoryPrizes(s.items);
    return { name: s.name, groups, total: groups.reduce((a, g) => a + g.total, 0), count: s.items.length };
  });
}

export function groupSchedule(items: BrochureExtraction["schedule"]) {
  const groups: { date: string | null; rows: BrochureExtraction["schedule"] }[] = [];
  for (const it of items) {
    const g = groups.find((x) => x.date === it.date);
    if (g) g.rows.push(it);
    else groups.push({ date: it.date, rows: [it] });
  }
  return groups;
}

export function venueQuery(e: Pick<EventSummary, "city" | "state" | "venueName">, d: BrochureExtraction | null) {
  return d?.venue.mapQuery ?? ([d?.venue.name ?? e.venueName, d?.venue.address, e.city, e.state].filter(Boolean).join(", ") || null);
}

/** "9.51 lakh", "1.2 crore", or null below a lakh. */
export function lakhs(n: number | null | undefined): string | null {
  if (n == null || n < 1e5) return null;
  const trim = (x: number) => String(Math.round(x * 100) / 100);
  return n >= 1e7 ? `${trim(n / 1e7)} crore` : `${trim(n / 1e5)} lakh`;
}

export const inr = (n: number) => formatInrFull(n);

export function shortFormat(f: string | null | undefined): string | null {
  if (!f) return null;
  if (/swiss/i.test(f)) return "Swiss";
  if (/round.?robin/i.test(f)) return "Round robin";
  if (/knock/i.test(f)) return "Knockout";
  return f.length > 20 ? f.slice(0, 19) + "…" : f;
}

/** Pieces of the format line: "Classical · 90+30 · 9 rounds · Swiss". */
export function formatParts(e: EventSummary, d: BrochureExtraction | null) {
  const type = d?.timeControl.type ?? e.timeControlType ?? null;
  const tc = tcShort(d?.timeControl.baseMinutes, d?.timeControl.incrementSeconds);
  const rounds = d?.rounds ?? e.rounds ?? null;
  return {
    type,
    tc,
    rounds,
    system: shortFormat(d?.format),
    raw: d?.timeControl.raw ?? null,
  };
}

export type Phase = "upcoming" | "ongoing" | "past";

export function phaseOf(e: Pick<EventSummary, "startDate" | "endDate">, today = todayIST()): Phase {
  if (e.endDate < today) return "past";
  if (e.startDate <= today) return "ongoing";
  return "upcoming";
}

/** Countdown copy for the date card: "Starts in 12 days", "Day 2 of 5", "Ended 3 days ago". */
export function countdown(e: Pick<EventSummary, "startDate" | "endDate">, today = todayIST()): string {
  const total = daysBetween(e.startDate, e.endDate) + 1;
  const p = phaseOf(e, today);
  if (p === "ongoing") return total === 1 ? "Today" : `Day ${daysBetween(e.startDate, today) + 1} of ${total}`;
  if (p === "past") {
    const n = daysBetween(e.endDate, today);
    return n === 1 ? "Ended yesterday" : n < 60 ? `Ended ${n} days ago` : "Ended";
  }
  const n = daysBetween(today, e.startDate);
  if (n === 1) return "Starts tomorrow";
  if (n < 60) return `Starts in ${n} days`;
  return `Starts in ${Math.round(n / 30)} months`;
}

export function eventDays(start: string, end: string): string[] {
  const n = Math.min(daysBetween(start, end), 30);
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export interface Registration {
  link: string | null;
  deadline: string | null;
  /** days until the deadline (0 = today), null when unknown or passed */
  daysLeft: number | null;
  closed: boolean;
  /** whether a Register button should show */
  open: boolean;
}

export function registrationOf(e: EventDetail, today = todayIST()): Registration {
  const d = e.details;
  const deadline = d?.registration.deadline ?? e.registrationDeadline ?? null;
  // Deadlines after the event ends are extraction noise; ignore them.
  const dl = deadline && deadline <= e.endDate ? deadline : null;
  const past = phaseOf(e, today) === "past";
  const closed = past || (!!dl && dl < today);
  const daysLeft = dl && !closed ? daysBetween(today, dl) : null;
  return { link: d?.registration.link ?? null, deadline: dl, daysLeft, closed, open: !!d?.registration.link && !closed };
}

export const splitPhones = (p: string) =>
  p.split(/\s*(?:[/,;]|\bor\b)\s*/).map((x) => x.trim()).filter((x) => x.replace(/\D/g, "").length >= 8);

export function sectionsFor(e: EventDetail) {
  const d = e.details;
  const s: { id: string; title: string }[] = [{ id: "overview", title: "Overview" }];
  if (d && hasPrizes(d.prizes)) s.push({ id: "prizes", title: "Prizes" });
  if (d && (d.entryFees.length || d.registration.notes || d.registration.deadline)) s.push({ id: "entry", title: "Entry fees" });
  if (d && d.schedule.length) s.push({ id: "schedule", title: "Schedule" });
  if (venueQuery(e, d) || d?.accommodation) s.push({ id: "venue", title: "Venue" });
  if (d && (d.categories.rating.length || d.categories.age.length || d.eligibility)) s.push({ id: "eligibility", title: "Eligibility" });
  if (d && (d.organizer || d.chiefArbiter || d.contacts.length)) s.push({ id: "contacts", title: "Contacts" });
  s.push({ id: "more", title: "More tournaments" });
  return s;
}

/** True when the brochure gave us something beyond the AICF listing. */
export function isRich(e: EventDetail) {
  const d = e.details;
  if (!d) return false;
  return !!(d.summary || hasPrizes(d.prizes) || d.entryFees.length || d.schedule.length || d.contacts.length || d.venue.name);
}

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));

/** "Fri 25 – Wed 30 Dec 2026" */
export function longRange(start: string, end: string) {
  const wd = (d: string) => fmt(d, { weekday: "short" });
  const day = (d: string) => Number(d.slice(8));
  const my = (d: string) => fmt(d, { month: "short", year: "numeric" });
  if (start === end) return `${wd(start)} ${day(start)} ${my(start)}`;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${wd(start)} ${day(start)} – ${wd(end)} ${day(end)} ${my(end)}`;
  if (start.slice(0, 4) === end.slice(0, 4)) return `${wd(start)} ${formatDayMonth(start)} – ${wd(end)} ${formatDayMonth(end)} ${end.slice(0, 4)}`;
  return `${wd(start)} ${formatDayMonth(start)} ${start.slice(0, 4)} – ${wd(end)} ${formatDayMonth(end)} ${end.slice(0, 4)}`;
}

export const prizeMeta = (p: Prizes) =>
  [p.places.length ? pluralize(p.places.length, "place") : null, p.categoryPrizes.length ? pluralize(p.categoryPrizes.length, "category prize") : null].filter(Boolean).join(" · ");
