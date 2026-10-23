import db from "./database.js";
import { addDays, todayIST } from "../lib/dates.js";
import type {
  BrochureExtraction, InsightBand, InsightEvent, InsightFormat, Insights, InsightsScope, TimeControlType,
} from "../types/event.js";

// One pass over the events table (≈ a few hundred rows) builds everything; the result is cached
// in memory and rebuilt when the table changes (row count / latest updatedAt), the IST day rolls
// over, or the TTL lapses.

const TTL_MS = 10 * 60_000;
const FORMATS: InsightFormat[] = ["Classical", "Rapid", "Blitz", "Mixed", "Unknown"];

interface Row {
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string | null;
  state: string | null;
  timeControlType: TimeControlType | null;
  rounds: number | null;
  totalPrizeInr: number | null;
  entryFeeMinInr: number | null;
  registrationDeadline: string | null;
  extractionJson: string | null;
}

interface Parsed extends Row {
  x: BrochureExtraction | null;
  /** What a regular adult entrant pays (see standardFee). */
  fee: number | null;
  /**
   * Prize pool counted for aggregates. Festivals list each section (Category A/B/C, Rapid, Blitz) as its
   * own event quoting the festival's combined purse; only the first section carries it here.
   */
  purse: number | null;
}

const FEE_SKIP = /late|foreign|nri|overseas|accommodation|lodging|food|\bgm|\bim\b|wgm|wim|titled|fide official|arbiter|donation|deposit|team|per (?:day|night)/i;
const FEE_GENERAL = /general|open|ordinary|regular|standard|all players|entry fee|rated players|normal|others|registration/i;

/**
 * The fee a regular adult player pays. `entryFeeMinInr` is the cheapest line in the brochure,
 * which is often ₹0 (free entry for titled players), so it misrepresents what most people pay.
 */
function standardFee(x: BrochureExtraction | null, fallback: number | null): number | null {
  const lines = (x?.entryFees ?? []).filter((f) => typeof f.amountInr === "number" && f.amountInr > 0 && f.amountInr < 100_000 && !FEE_SKIP.test(f.category ?? ""));
  const general = lines.find((f) => FEE_GENERAL.test(f.category ?? ""));
  if (general) return general.amountInr!;
  const m = median(lines.map((f) => f.amountInr!));
  if (m != null) return m;
  return fallback && fallback > 0 ? fallback : null;
}

const ev = (r: Parsed): InsightEvent => ({
  eventCode: r.eventCode,
  name: r.name,
  startDate: r.startDate,
  endDate: r.endDate,
  city: r.city,
  state: r.state,
  timeControlType: r.timeControlType,
  totalPrizeInr: r.totalPrizeInr,
  entryFeeMinInr: r.entryFeeMinInr,
  registrationDeadline: r.registrationDeadline,
  entryFeeInr: r.fee,
});

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function bands(values: number[], edges: { label: string; min: number; max: number | null }[]): InsightBand[] {
  return edges.map((e) => ({ ...e, count: values.filter((v) => v >= e.min && (e.max == null || v < e.max)).length }));
}

const PRIZE_EDGES = [
  { label: "< ₹50K", min: 0, max: 50_000 },
  { label: "₹50K–1L", min: 50_000, max: 100_000 },
  { label: "₹1–2L", min: 100_000, max: 200_000 },
  { label: "₹2–5L", min: 200_000, max: 500_000 },
  { label: "₹5–10L", min: 500_000, max: 1_000_000 },
  { label: "₹10–25L", min: 1_000_000, max: 2_500_000 },
  { label: "₹25L+", min: 2_500_000, max: null },
];
const FEE_EDGES = [
  { label: "< ₹500", min: 1, max: 500 },
  { label: "₹500–999", min: 500, max: 1000 },
  { label: "₹1,000–1,499", min: 1000, max: 1500 },
  { label: "₹1,500–1,999", min: 1500, max: 2000 },
  { label: "₹2,000–2,999", min: 2000, max: 3000 },
  { label: "₹3,000–4,999", min: 3000, max: 5000 },
  { label: "₹5,000+", min: 5000, max: null },
];
const LEAD_EDGES = [
  { label: "Same day", min: 0, max: 1 },
  { label: "1 day", min: 1, max: 2 },
  { label: "2 days", min: 2, max: 3 },
  { label: "3 days", min: 3, max: 4 },
  { label: "4–7 days", min: 4, max: 8 },
  { label: "1–2 weeks", min: 8, max: 15 },
  { label: "2 weeks+", min: 15, max: null },
];

/** Category-prize kinds, matched against a prize's category + label text. Order = display order. */
const CATEGORY_KINDS: { key: string; label: string; re: RegExp }[] = [
  { key: "unrated", label: "Best unrated", re: /un-?rated/i },
  { key: "rating", label: "Rating bands", re: /\b(1[0-9]|2[0-4])\d\d\b|\b(below|upto|up to)\s*1[0-9]\d\d|rating/i },
  { key: "age", label: "Age groups (U-7 … U-19)", re: /\bu\s*[-–]?\s*\d{1,2}\b|\bunder\s*[-–]?\s*\d{1,2}\b|\bbelow\s+\d{1,2}\s*(yrs?|years)?\b|junior|kids?\b|cadet|\bage\b/i },
  { key: "women", label: "Women & girls", re: /women|woman|girl|female|lad(y|ies)/i },
  { key: "veteran", label: "Veterans", re: /veteran|senior|sr\.?\s*citizen|\b(50|55|60|65)\s*\+|above\s*(50|55|60|65)/i },
  { key: "para", label: "Specially-abled", re: /special|physical|challeng|disab|differently|visual|blind|hearing|deaf|ortho/i },
  { key: "local", label: "Local / district players", re: /local|district|\bdist\b|resident|school|college|club|academy|institut|corporat|city player|state player|best .{2,24} player/i },
];

function timeControlLabel(x: BrochureExtraction | null): { base: number; inc: number } | null {
  const b = x?.timeControl?.baseMinutes;
  const i = x?.timeControl?.incrementSeconds;
  if (typeof b !== "number" || b <= 0 || b > 300) return null;
  return { base: b, inc: typeof i === "number" && i >= 0 && i <= 120 ? i : 0 };
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function buildScope(rows: Parsed[]): InsightsScope {
  const prizes = rows.map((r) => r.purse).filter((n): n is number => typeof n === "number" && n > 0);
  const fees = rows.map((r) => r.fee).filter((n): n is number => typeof n === "number" && n > 0);
  const extracted = rows.filter((r) => r.x);

  // formats
  const formats = FORMATS.map((format) => {
    const fr = rows.filter((r) => (r.timeControlType ?? "Unknown") === format);
    return {
      format,
      count: fr.length,
      medianRounds: median(fr.map((r) => r.rounds).filter((n): n is number => typeof n === "number" && n > 0)),
      medianPrizeInr: median(fr.map((r) => r.purse).filter((n): n is number => typeof n === "number" && n > 0)),
    };
  }).filter((f) => f.count > 0);

  // time controls
  const tc = new Map<string, { label: string; baseMinutes: number; incrementSeconds: number; fmt: Map<string, number>; count: number }>();
  for (const r of rows) {
    const t = timeControlLabel(r.x);
    if (!t) continue;
    const label = `${t.base}+${t.inc}`;
    const e = tc.get(label) ?? { label, baseMinutes: t.base, incrementSeconds: t.inc, fmt: new Map(), count: 0 };
    e.count++;
    if (r.timeControlType) e.fmt.set(r.timeControlType, (e.fmt.get(r.timeControlType) ?? 0) + 1);
    tc.set(label, e);
  }
  const timeControls = [...tc.values()]
    .sort((a, b) => b.count - a.count || a.baseMinutes - b.baseMinutes)
    .slice(0, 10)
    .map(({ fmt, ...t }) => {
      // "Mixed" events carry several TCs; attribute the TC to the base-time format instead.
      const top = [...fmt.entries()].filter(([k]) => k !== "Mixed").sort((a, b) => b[1] - a[1])[0]?.[0] as TimeControlType | undefined;
      const inferred: TimeControlType = t.baseMinutes >= 60 ? "Classical" : t.baseMinutes > 10 || (t.baseMinutes === 10 && t.incrementSeconds > 0) ? "Rapid" : "Blitz";
      return { ...t, format: top ?? inferred };
    });

  // geography
  const st = new Map<string, { count: number; prizeInr: number }>();
  const ct = new Map<string, { city: string; state: string | null; count: number }>();
  for (const r of rows) {
    if (r.state) {
      const e = st.get(r.state) ?? { count: 0, prizeInr: 0 };
      e.count++;
      e.prizeInr += r.purse ?? 0;
      st.set(r.state, e);
    }
    if (r.city) {
      const k = `${r.city}|${r.state ?? ""}`;
      const e = ct.get(k) ?? { city: r.city, state: r.state, count: 0 };
      e.count++;
      ct.set(k, e);
    }
  }
  const byState = [...st.entries()].map(([state, v]) => ({ state, ...v })).sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
  const topCities = [...ct.values()].sort((a, b) => b.count - a.count || a.city.localeCompare(b.city)).slice(0, 10);

  // money leaders
  const topPrizes = rows
    .filter((r) => (r.purse ?? 0) > 0)
    .sort((a, b) => b.purse! - a.purse! || a.startDate.localeCompare(b.startDate))
    .slice(0, 10)
    .map(ev);
  const bestValue = rows
    .filter((r) => (r.purse ?? 0) > 0 && (r.fee ?? 0) >= 100)
    .map((r) => ({ ...ev(r), ratio: Math.round(r.purse! / r.fee!) }))
    .sort((a, b) => b.ratio - a.ratio || a.startDate.localeCompare(b.startDate))
    .slice(0, 8);

  // rhythm
  const weekdays = [0, 0, 0, 0, 0, 0, 0];
  const dur = new Map<string, number>();
  const leads: number[] = [];
  for (const r of rows) {
    const dow = new Date(`${r.startDate}T00:00:00Z`).getUTCDay(); // 0 = Sun
    weekdays[(dow + 6) % 7]++;
    const d = Math.max(1, dayDiff(r.startDate, r.endDate) + 1);
    const k = d >= 7 ? "7+" : String(d);
    dur.set(k, (dur.get(k) ?? 0) + 1);
    if (r.registrationDeadline) {
      const lead = dayDiff(r.registrationDeadline, r.startDate);
      if (lead >= 0 && lead <= 120) leads.push(lead);
    }
  }
  const durations = ["1", "2", "3", "4", "5", "6", "7+"].map((label) => ({ label, count: dur.get(label) ?? 0 }));

  // category prizes + prize depth
  const kindHits = new Map<string, number>();
  const prizeCounts: number[] = [];
  for (const r of extracted) {
    const cp = r.x!.prizes?.categoryPrizes ?? [];
    const places = r.x!.prizes?.places ?? [];
    if (cp.length || places.length) prizeCounts.push(cp.length + places.length);
    const texts = cp.map((p) => `${p.category ?? ""} ${p.label ?? ""}`);
    texts.push(...(r.x!.categories?.age ?? []).map((a) => `age ${a}`));
    for (const k of CATEGORY_KINDS) if (texts.some((t) => k.re.test(t))) kindHits.set(k.key, (kindHits.get(k.key) ?? 0) + 1);
  }
  const categoryPrizes = CATEGORY_KINDS.map((k) => {
    const events = kindHits.get(k.key) ?? 0;
    return { key: k.key, label: k.label, events, share: extracted.length ? events / extracted.length : 0 };
  }).sort((a, b) => b.events - a.events);

  return {
    total: rows.length,
    withDetails: extracted.length,
    prizePoolInr: prizes.reduce((a, b) => a + b, 0),
    prizeKnown: prizes.length,
    medianPrizeInr: median(prizes),
    medianEntryFeeInr: median(fees),
    avgPrizesPerEvent: prizeCounts.length ? Math.round(prizeCounts.reduce((a, b) => a + b, 0) / prizeCounts.length) : null,
    states: st.size,
    cities: ct.size,
    formats,
    timeControls,
    byState,
    topCities,
    prizeBands: bands(prizes, PRIZE_EDGES),
    feeBands: bands(fees, FEE_EDGES),
    topPrizes,
    bestValue,
    weekdays,
    durations,
    leadBands: bands(leads, LEAD_EDGES),
    medianLeadDays: median(leads),
    categoryPrizes,
  };
}

export function computeInsights(today = todayIST()): Insights {
  const raw = db
    .prepare(
      `SELECT eventCode, name, startDate, endDate, city, state, timeControlType, rounds, totalPrizeInr, entryFeeMinInr,
              registrationDeadline, extractionJson
       FROM events ORDER BY startDate ASC, eventCode ASC`,
    )
    .all() as Row[];
  const rows: Parsed[] = raw.map((r) => {
    let x: BrochureExtraction | null = null;
    if (r.extractionJson) {
      try {
        x = JSON.parse(r.extractionJson) as BrochureExtraction;
      } catch {
        x = null;
      }
    }
    return { ...r, extractionJson: null, x, fee: standardFee(x, r.entryFeeMinInr), purse: r.totalPrizeInr };
  });
  // Same state + same purse starting within 14 days of an earlier section → festival sibling.
  const seenPurse = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.purse) continue;
    const k = `${r.state ?? ""}|${r.purse}`;
    const starts = seenPurse.get(k) ?? [];
    if (starts.some((d) => Math.abs(dayDiff(d, r.startDate)) <= 14)) r.purse = null;
    else starts.push(r.startDate);
    seenPurse.set(k, starts);
  }

  // months: first → last start month on record
  const monthMap = new Map<string, Insights["months"][number]>();
  if (rows.length) {
    const first = rows[0].startDate.slice(0, 7);
    const last = rows[rows.length - 1].startDate.slice(0, 7);
    let [y, m] = first.split("-").map(Number);
    for (let i = 0; i < 60; i++) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      monthMap.set(key, { month: key, total: 0, prizeInr: 0, byFormat: { Classical: 0, Rapid: 0, Blitz: 0, Mixed: 0, Unknown: 0 } });
      if (key >= last) break;
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }
  const dayMap = new Map<string, { inPlay: number; starting: number }>();
  for (const r of rows) {
    const mo = monthMap.get(r.startDate.slice(0, 7));
    if (mo) {
      mo.total++;
      mo.prizeInr += r.purse ?? 0;
      mo.byFormat[r.timeControlType ?? "Unknown"]++;
    }
    const len = Math.min(dayDiff(r.startDate, r.endDate), 45);
    for (let i = 0; i <= len; i++) {
      const d = addDays(r.startDate, i);
      const e = dayMap.get(d) ?? { inPlay: 0, starting: 0 };
      e.inPlay++;
      if (i === 0) e.starting++;
      dayMap.set(d, e);
    }
  }

  const live = rows.filter((r) => r.endDate >= today);
  const weekEnd = addDays(today, 6);
  const startingWeek = live.filter((r) => r.startDate >= today && r.startDate <= weekEnd);
  const biggest = [...startingWeek].filter((r) => (r.totalPrizeInr ?? 0) > 0).sort((a, b) => b.totalPrizeInr! - a.totalPrizeInr!)[0];

  return {
    generatedAt: new Date().toISOString(),
    today,
    months: [...monthMap.values()],
    days: [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
    thisWeek: {
      from: today,
      to: weekEnd,
      starting: startingWeek.length,
      ongoing: live.filter((r) => r.startDate <= today).length,
      closingSoon: live.filter((r) => r.registrationDeadline && r.registrationDeadline >= today && r.registrationDeadline <= weekEnd).length,
      biggest: biggest ? ev(biggest) : null,
      next: live.filter((r) => r.startDate >= today).slice(0, 5).map(ev),
    },
    upcoming: buildScope(live),
    all: buildScope(rows),
  };
}

let cache: { key: string; at: number; value: Insights } | null = null;

/** Cached insights; rebuilt when events change, the IST date changes, or after the TTL. */
export function getInsights(): Insights {
  const today = todayIST();
  const sig = db.prepare("SELECT COUNT(*) AS c, MAX(updatedAt) AS u FROM events").get() as { c: number; u: string | null };
  const key = `${today}|${sig.c}|${sig.u ?? ""}`;
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = computeInsights(today);
  cache = { key, at: Date.now(), value };
  return value;
}

/** Drop the cached insights (call after bulk writes). */
export function invalidateInsights(): void {
  cache = null;
}
