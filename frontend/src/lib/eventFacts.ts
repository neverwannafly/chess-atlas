import type { EventDetail, EventSummary } from "@/types/event";
import {
  daysBetween, deadlineDays, formatDateRange, formatDayMonth, formatInr, formatMoney, formatMoneyRange, formatWeekdayShort, relativeStart, todayIST,
} from "@/lib/format";

export type Tone = "live" | "soon" | "future" | "past";

export interface Fact {
  value: string;
  note?: string;
  title?: string;
  tone?: "warn" | "muted" | "accent";
  /** Notation shown in mono after the value, e.g. "25+10". */
  code?: string;
}

export interface EventFacts {
  status: { label: string; tone: Tone };
  when: Fact;
  timeControl?: Fact;
  prize?: Fact;
  fee?: Fact;
  registration?: Fact;
  fide: boolean | null;
  /** Free entry categories, e.g. "GMs, IMs, WGMs, WIMs" */
  freeFor: string[];
  hasDetails: boolean;
}

/** "25+10" from base minutes and increment seconds. */
export function tcShort(base: number | null | undefined, inc: number | null | undefined): string | null {
  if (base == null) return null;
  return `${base}+${inc ?? 0}`;
}

function shortFormat(f: string) {
  if (/swiss/i.test(f)) return "Swiss";
  if (/round.?robin/i.test(f)) return "Round robin";
  if (/knock/i.test(f)) return "Knockout";
  return f.length > 18 ? f.slice(0, 17) + "…" : f;
}

function weekdays(start: string, end: string) {
  return start === end ? formatWeekdayShort(start) : `${formatWeekdayShort(start)}–${formatWeekdayShort(end)}`;
}

export function deriveFacts(e: EventSummary, detail?: EventDetail | null, today = todayIST()): EventFacts {
  const d = detail?.details ?? null;
  const days = daysBetween(e.startDate, e.endDate) + 1;
  const status = relativeStart(e.startDate, e.endDate, today);
  const facts: EventFacts = {
    status,
    when: { value: formatDateRange(e.startDate, e.endDate), note: `${days} ${days === 1 ? "day" : "days"} · ${weekdays(e.startDate, e.endDate)}` },
    fide: d?.fideRated ?? e.fideRated,
    freeFor: [],
    hasDetails: e.extractionStatus === "done",
  };

  const type = d?.timeControl.type ?? e.timeControlType;
  const short = tcShort(d?.timeControl.baseMinutes, d?.timeControl.incrementSeconds);
  const rounds = d?.rounds ?? e.rounds;
  const roundsText = rounds ? `${rounds} ${rounds === 1 ? "round" : "rounds"}` : null;
  const tcNote = [roundsText, d?.format ? shortFormat(d.format) : null].filter(Boolean).join(" · ") || undefined;
  if (type || short) facts.timeControl = { value: type ?? "", code: short ?? undefined, note: tcNote, title: d?.timeControl.raw ?? undefined };
  else if (tcNote) facts.timeControl = { value: tcNote };

  const total = d?.prizes.totalInr ?? e.totalPrizeInr;
  const first = d?.prizes.places.find((p) => p.amountInr != null && p.amountInr > 0)?.amountInr ?? null;
  if (total != null && total > 0) {
    facts.prize = { value: formatMoney(total), note: first ? `1st ${formatMoney(first)}` : undefined, title: `₹${total.toLocaleString("en-IN")}` };
  } else if (first) {
    facts.prize = { value: `1st ${formatMoney(first)}`, note: "total not listed" };
  }

  const fees = d?.entryFees.filter((f): f is { category: string; amountInr: number } => f.amountInr != null) ?? [];
  if (fees.length) {
    const paid = fees.filter((f) => f.amountInr > 0).map((f) => f.amountInr);
    facts.freeFor = fees.filter((f) => f.amountInr === 0).map((f) => f.category);
    if (!paid.length) facts.fee = { value: "Free", note: "no entry fee" };
    else {
      const range = formatMoneyRange(Math.min(...paid), Math.max(...paid));
      facts.fee = {
        value: range,
        note: facts.freeFor.length ? "Free for some" : paid.length > 1 ? `${paid.length} categories` : undefined,
        title: facts.freeFor.length ? `Free for ${facts.freeFor.join("; ")}` : undefined,
      };
    }
  } else if (e.entryFeeMinInr != null) {
    facts.fee = e.entryFeeMinInr === 0 ? { value: "Free for some" } : { value: `From ${formatMoney(e.entryFeeMinInr)}` };
  }

  const deadline = d?.registration.deadline ?? e.registrationDeadline;
  if (deadline && status.tone !== "past" && deadline <= e.endDate) {
    const n = deadlineDays(deadline, today);
    if (n == null) facts.registration = { value: "Closed", note: `on ${formatDayMonth(deadline)}`, tone: "muted" };
    else
      facts.registration = {
        value: `Closes ${formatDayMonth(deadline)}`,
        note: n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`,
        tone: n <= 3 ? "warn" : undefined,
      };
  }
  return facts;
}

/** Registration still open (or not announced) and the event hasn't started. */
export function registrationOpen(e: EventSummary, today = todayIST()) {
  if (e.startDate <= today && e.endDate >= today) return e.registrationDeadline ? e.registrationDeadline >= today : false;
  if (e.endDate < today) return false;
  return !e.registrationDeadline || e.registrationDeadline >= today;
}

const ACRONYMS = new Set(["FIDE", "AICF", "SBI", "GIC", "LBHM", "SSS", "CPPF", "RUAS", "MVIT", "BRDCA", "SCC", "DPSS", "GM", "IM", "WGM", "WIM", "FM", "CM", "UP", "MP", "TN", "NE", "ICF", "CBSE", "II", "III", "IV", "VI", "VII", "SF", "MCA", "DCA", "KDCA", "PCA", "NIT", "IIT", "AICFB", "RERA", "T-RERA"]);
const SMALL = new Set(["of", "and", "the", "for", "in", "at", "on", "by", "to", "a"]);

/** Brochure titles often arrive in ALL CAPS; set them in title case, keeping acronyms and ordinals. */
export function displayName(name: string): string {
  const clean = name.replace(/^[\s.,·–-]+/, "").replace(/\s+/g, " ").trim();
  const letters = clean.replace(/[^A-Za-z]/g, "");
  const upper = clean.replace(/[^A-Z]/g, "").length;
  if (!letters.length || upper / letters.length < 0.7) return clean;
  return clean
    .split(" ")
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z0-9-]/g, "");
      if (ACRONYMS.has(bare.toUpperCase()) && bare === bare.toUpperCase()) return w;
      if (/^\d+(ST|ND|RD|TH)$/i.test(bare)) return w.toLowerCase();
      if (/^U-?\d+$/i.test(bare)) return w.toUpperCase();
      const lower = w.toLowerCase();
      if (i > 0 && SMALL.has(bare.toLowerCase())) return lower;
      return lower.replace(/(^|[-(/&.])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
    })
    .join(" ");
}

export function placeLine(e: Pick<EventSummary, "city" | "state" | "venueName">): string {
  const loc = [e.city, e.state].filter(Boolean).join(", ");
  return [e.venueName, loc].filter(Boolean).join(" · ") || "Venue to be announced";
}

/* ───────────────────────── listing row facts ───────────────────────── */

export interface RowFacts {
  format: string | null;
  /** "90+30" */
  tc: string | null;
  rounds: number | null;
  fide: boolean | null;
  prize: string | null;
  prizeTitle?: string;
  prizeNote: string | null;
  fee: string | null;
  feeNote: string | null;
  reg: { label: string; tone: "warn" | "muted" | "ok" | "default" } | null;
  live: boolean;
  past: boolean;
  /** "Day 3 of 6" for ongoing multi-day events. */
  dayOf: string | null;
}

/** The compact facts a listing row shows; detail (when loaded) refines time control and fees. */
export function rowFacts(e: EventSummary, detail?: EventDetail | null, today = todayIST()): RowFacts {
  const d = detail?.details ?? null;
  const live = e.startDate <= today && e.endDate >= today;
  const past = e.endDate < today;
  const total = d?.prizes.totalInr ?? e.totalPrizeInr;
  const first = d?.prizes.places.find((p) => p.amountInr != null && p.amountInr > 0)?.amountInr ?? null;

  const fees = d?.entryFees.map((f) => f.amountInr).filter((n): n is number => n != null) ?? [];
  const paid = fees.filter((n) => n > 0);
  let fee: string | null = null;
  let feeNote: string | null = null;
  if (fees.length) {
    fee = paid.length ? formatMoney(Math.min(...paid)) : "Free";
    feeNote = paid.length && paid.length < fees.length ? "free for some" : paid.length > 1 ? `${new Set(paid).size} tiers` : null;
  } else if (e.entryFeeMinInr != null) {
    fee = e.entryFeeMinInr === 0 ? "Free" : formatMoney(e.entryFeeMinInr);
    feeNote = e.entryFeeMinInr === 0 && e.extractionStatus === "done" ? "for some" : null;
  }

  let reg: RowFacts["reg"] = null;
  const deadline = d?.registration.deadline ?? e.registrationDeadline;
  if (!past && deadline && deadline <= e.endDate) {
    const n = deadlineDays(deadline, today);
    if (n == null) reg = { label: "Closed", tone: "muted" };
    else if (n === 0) reg = { label: "Closes today", tone: "warn" };
    else if (n === 1) reg = { label: "Closes tomorrow", tone: "warn" };
    else if (n <= 7) reg = { label: `Closes in ${n} days`, tone: "warn" };
    else reg = { label: `Open until ${formatDayMonth(deadline)}`, tone: "default" };
  } else if (past) reg = null;

  const span = daysBetween(e.startDate, e.endDate) + 1;
  return {
    format: d?.timeControl.type ?? e.timeControlType,
    tc: tcShort(d?.timeControl.baseMinutes, d?.timeControl.incrementSeconds),
    rounds: d?.rounds ?? e.rounds,
    fide: d?.fideRated ?? e.fideRated,
    prize: total != null && total > 0 ? formatInr(total) : first ? `1st ${formatInr(first)}` : null,
    prizeTitle: total ? `₹${total.toLocaleString("en-IN")}` : undefined,
    prizeNote: total && first ? `1st ${formatInr(first)}` : null,
    fee,
    feeNote,
    reg,
    live,
    past,
    dayOf: live && span > 1 ? `Day ${daysBetween(e.startDate, today) + 1} of ${span}` : null,
  };
}

/** Public URL for an event: the slug, or the numeric eventCode when a payload has no slug. */
export const eventPath = (e: { slug?: string | null; eventCode: string }) => `/events/${encodeURIComponent(e.slug || e.eventCode)}`;
