import { z } from "zod";
import type { BrochureExtraction } from "../types/event.js";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const date = z.string().regex(dateRe, "expected YYYY-MM-DD").nullable();
const str = z.string().nullable();
const inr = z.number().int().min(0).nullable();

export const brochureExtractionSchema = z.object({
  summary: str,
  tagline: str,
  venue: z.object({
    name: str,
    address: str,
    city: str,
    state: str,
    pincode: str,
    mapQuery: str,
  }),
  timeControl: z.object({
    type: z.enum(["Classical", "Rapid", "Blitz", "Mixed"]).nullable(),
    baseMinutes: z.number().min(0).nullable(),
    incrementSeconds: z.number().min(0).nullable(),
    raw: str,
  }),
  rounds: z.number().int().min(1).nullable(),
  fideRated: z.boolean().nullable(),
  format: str,
  prizes: z.object({
    totalInr: inr,
    places: z.array(z.object({ label: z.string(), amountInr: inr, extra: str })),
    categoryPrizes: z.array(z.object({ category: z.string(), label: z.string(), amountInr: inr })),
    notes: str,
  }),
  entryFees: z.array(z.object({ category: z.string(), amountInr: inr })),
  categories: z.object({ rating: z.array(z.string()), age: z.array(z.string()) }),
  eligibility: str,
  registration: z.object({ link: str, deadline: date, notes: str }),
  organizer: str,
  chiefArbiter: str,
  contacts: z.array(z.object({ name: str, role: str, phone: str, email: str })),
  accommodation: str,
  schedule: z.array(z.object({ date, time: str, item: z.string() })),
});

// Compile-time check that the schema matches the shared contract type.
type _Check = z.infer<typeof brochureExtractionSchema> extends BrochureExtraction
  ? BrochureExtraction extends z.infer<typeof brochureExtractionSchema>
    ? true
    : never
  : never;
export const _schemaMatchesContract: _Check = true;

export type ParsedExtraction = z.infer<typeof brochureExtractionSchema>;

export const TAGLINE_MAX = 120;

/** Parse "₹4,50,000", "Rs. 1,00,000/-", "4.5 lakh", "1.2 crore", "50k" → integer INR. Returns null if not parseable. */
export function parseInr(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  const s = v.toLowerCase().replace(/,/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lakh|l|thousand|k)?\b/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const unit = m[2];
  if (unit) {
    if (/^(crore|cr)/.test(unit)) n *= 1e7;
    else if (/^(lakh|lac|l$)/.test(unit)) n *= 1e5;
    else if (unit === "thousand" || unit === "k") n *= 1e3;
  }
  return Math.round(n);
}

const cleanStr = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s || /^(null|n\/a|na|none|not specified|not mentioned)$/i.test(s)) return null;
  return s;
};
const cleanMultiline = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").split("\n").map((l) => l.trim()).join("\n").trim();
  return s || null;
};
const cleanList = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(cleanStr).filter((x): x is string => !!x))] : [];

function cleanDate(v: unknown): string | null {
  const s = cleanStr(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function clampTagline(s: string | null): string | null {
  if (!s || s.length <= TAGLINE_MAX) return s;
  const cut = s.slice(0, TAGLINE_MAX - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > 60 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "") + "…";
}

const obj = (v: unknown): Record<string, any> => (v && typeof v === "object" ? (v as Record<string, any>) : {});
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Post-process raw LLM output into a clean object. Result should then be validated with brochureExtractionSchema. */
export function normalizeExtraction(input: unknown): BrochureExtraction {
  const r = obj(input);
  const venue = obj(r.venue);
  const tc = obj(r.timeControl);
  const prizes = obj(r.prizes);
  const reg = obj(r.registration);
  const cats = obj(r.categories);

  const places = arr(prizes.places)
    .map((p) => ({ label: cleanStr(obj(p).label), amountInr: parseInr(obj(p).amountInr), extra: cleanStr(obj(p).extra) }))
    .filter((p): p is { label: string; amountInr: number | null; extra: string | null } => !!p.label);
  const categoryPrizes = arr(prizes.categoryPrizes)
    .map((p) => ({
      category: cleanStr(obj(p).category),
      label: cleanStr(obj(p).label) ?? "",
      amountInr: parseInr(obj(p).amountInr),
    }))
    .filter((p): p is { category: string; label: string; amountInr: number | null } => !!p.category);

  let totalInr = parseInr(prizes.totalInr);
  if (totalInr === null) {
    const all = [...places, ...categoryPrizes];
    if (all.length > 0 && all.every((p) => p.amountInr !== null)) {
      totalInr = all.reduce((a, p) => a + (p.amountInr as number), 0);
    }
  }

  const seenFee = new Set<string>();
  const entryFees = arr(r.entryFees)
    .map((f) => ({ category: cleanStr(obj(f).category), amountInr: parseInr(obj(f).amountInr) }))
    .filter((f): f is { category: string; amountInr: number | null } => {
      if (!f.category) return false;
      const k = `${f.category.toLowerCase()}|${f.amountInr}`;
      if (seenFee.has(k)) return false;
      seenFee.add(k);
      return true;
    });

  const seenContact = new Set<string>();
  const contacts = arr(r.contacts)
    .map((c) => {
      const o = obj(c);
      return { name: cleanStr(o.name), role: cleanStr(o.role), phone: cleanStr(o.phone), email: cleanStr(o.email)?.toLowerCase() ?? null };
    })
    .filter((c) => {
      if (!c.name && !c.phone && !c.email) return false;
      const k = `${(c.name ?? "").toLowerCase()}|${(c.phone ?? "").replace(/\D/g, "")}|${c.email ?? ""}`;
      if (seenContact.has(k)) return false;
      seenContact.add(k);
      return true;
    });

  const seenSched = new Set<string>();
  const schedule = arr(r.schedule)
    .map((s) => ({ date: cleanDate(obj(s).date), time: cleanStr(obj(s).time), item: cleanStr(obj(s).item) }))
    .filter((s): s is { date: string | null; time: string | null; item: string } => {
      if (!s.item) return false;
      const k = `${s.date}|${s.time}|${s.item.toLowerCase()}`;
      if (seenSched.has(k)) return false;
      seenSched.add(k);
      return true;
    })
    .map((s, i) => ({ s, i }))
    .sort((a, b) => {
      if (a.s.date !== b.s.date) return a.s.date === null ? 1 : b.s.date === null ? -1 : a.s.date < b.s.date ? -1 : 1;
      return a.i - b.i; // stable: keep brochure order within a day
    })
    .map(({ s }) => s);

  const num = (v: unknown): number | null => {
    if (typeof v === "string" && v.trim() !== "") v = Number(v);
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const roundsRaw = num(r.rounds);
  const tcType = cleanStr(tc.type);
  const typeNorm = tcType ? ["Classical", "Rapid", "Blitz", "Mixed"].find((t) => t.toLowerCase() === tcType.toLowerCase()) ?? null : null;
  const pin = cleanStr(venue.pincode)?.replace(/\D/g, "") ?? null;

  let link = cleanStr(reg.link);
  if (link && !/^https?:\/\//i.test(link) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(link)) link = "https://" + link;

  return {
    summary: cleanMultiline(r.summary),
    tagline: clampTagline(cleanStr(r.tagline)),
    venue: {
      name: cleanStr(venue.name),
      address: cleanStr(venue.address),
      city: cleanStr(venue.city),
      state: cleanStr(venue.state),
      pincode: pin && pin.length === 6 ? pin : null,
      mapQuery: cleanStr(venue.mapQuery),
    },
    timeControl: {
      // a type with no supporting numbers or text is a guess: drop it
      type: (num(tc.baseMinutes) === null && !cleanStr(tc.raw) ? null : typeNorm) as BrochureExtraction["timeControl"]["type"],
      baseMinutes: num(tc.baseMinutes),
      incrementSeconds: num(tc.incrementSeconds),
      raw: cleanStr(tc.raw),
    },
    rounds: roundsRaw !== null && roundsRaw >= 1 ? Math.round(roundsRaw) : null,
    fideRated: typeof r.fideRated === "boolean" ? r.fideRated : null,
    format: cleanStr(r.format),
    prizes: { totalInr, places, categoryPrizes, notes: cleanStr(prizes.notes) },
    entryFees,
    categories: { rating: cleanList(cats.rating), age: cleanList(cats.age) },
    eligibility: cleanMultiline(r.eligibility),
    registration: { link, deadline: cleanDate(reg.deadline), notes: cleanStr(reg.notes) },
    organizer: cleanStr(r.organizer),
    chiefArbiter: cleanStr(r.chiefArbiter),
    contacts,
    accommodation: cleanMultiline(r.accommodation),
    schedule,
  };
}
