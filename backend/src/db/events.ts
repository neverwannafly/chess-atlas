import db from "./database.js";
import { parsePlace } from "../lib/place.js";
import { addDays, todayIST } from "../lib/dates.js";
import type {
  BrochureExtraction, EventDetail, EventStatus, EventSummary, ExtractionStatus, FacetCount,
  QueueItem, ScrapedEvent, Stats, TimeControlType,
} from "../types/event.js";

export const AICF_URL = "https://aicf.in/all-events/";
export const MAX_ATTEMPTS = 3;
const RETRY_AFTER_HOURS = 24;

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------- meta

export function getMeta(key: string): string | null {
  const r = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return r?.value ?? null;
}
export function setMeta(key: string, value: string): void {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

// ---------------------------------------------------------------- rows

interface EventRow {
  id: number;
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
  place: string | null;
  city: string | null;
  state: string | null;
  brochureUrl: string | null;
  extractionStatus: ExtractionStatus;
  extractionAttempts: number;
  extractionError: string | null;
  extractionJson: string | null;
  extractionModel: string | null;
  sourceHash: string | null;
  extractedAt: string | null;
  brochureUrlAtExtraction: string | null;
  lastAttemptAt: string | null;
  timeControlType: TimeControlType | null;
  rounds: number | null;
  fideRated: number | null;
  totalPrizeInr: number | null;
  entryFeeMinInr: number | null;
  registrationDeadline: string | null;
  venueName: string | null;
  tagline: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
}

export function statusOf(startDate: string, endDate: string, today = todayIST()): EventStatus {
  if (startDate > today) return "upcoming";
  if (endDate < today) return "past";
  return "ongoing";
}

export const SUMMARY_COLUMNS = `eventCode, name, startDate, endDate, city, state, brochureUrl, extractionStatus, tagline,
  timeControlType, rounds, fideRated, totalPrizeInr, entryFeeMinInr, registrationDeadline, venueName`;

export function toSummary(r: Partial<EventRow> & Pick<EventRow, "eventCode" | "name" | "startDate" | "endDate">, today = todayIST()): EventSummary {
  return {
    eventCode: r.eventCode,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    city: r.city ?? null,
    state: r.state ?? null,
    status: statusOf(r.startDate, r.endDate, today),
    brochureUrl: r.brochureUrl ?? null,
    extractionStatus: r.extractionStatus ?? "pending",
    tagline: r.tagline ?? null,
    timeControlType: r.timeControlType ?? null,
    rounds: r.rounds ?? null,
    fideRated: r.fideRated == null ? null : r.fideRated === 1,
    totalPrizeInr: r.totalPrizeInr ?? null,
    entryFeeMinInr: r.entryFeeMinInr ?? null,
    registrationDeadline: r.registrationDeadline ?? null,
    venueName: r.venueName ?? null,
  };
}

function toDetail(r: EventRow): EventDetail {
  let details: BrochureExtraction | null = null;
  if (r.extractionJson) {
    try {
      details = JSON.parse(r.extractionJson) as BrochureExtraction;
    } catch {
      details = null;
    }
  }
  return {
    ...toSummary(r),
    details,
    extractedAt: r.extractedAt,
    extractionModel: r.extractionModel,
    aicfUrl: AICF_URL,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export function getEventRow(eventCode: string): EventRow | undefined {
  return db.prepare("SELECT * FROM events WHERE eventCode = ?").get(eventCode) as EventRow | undefined;
}

export function getEventDetail(eventCode: string): EventDetail | null {
  const r = getEventRow(eventCode);
  return r ? toDetail(r) : null;
}

// ---------------------------------------------------------------- FTS

export function syncFts(id: number): void {
  const r = db.prepare("SELECT name, city, state, venueName, extractionJson FROM events WHERE id = ?").get(id) as
    | { name: string; city: string | null; state: string | null; venueName: string | null; extractionJson: string | null }
    | undefined;
  db.prepare("DELETE FROM events_fts WHERE rowid = ?").run(id);
  if (!r) return;
  let organizer = "";
  if (r.extractionJson) {
    try {
      organizer = (JSON.parse(r.extractionJson) as BrochureExtraction).organizer ?? "";
    } catch {
      /* ignore */
    }
  }
  db.prepare("INSERT INTO events_fts (rowid, name, city, state, venue, organizer) VALUES (?, ?, ?, ?, ?, ?)").run(
    id, r.name, r.city ?? "", r.state ?? "", r.venueName ?? "", organizer,
  );
}

// ---------------------------------------------------------------- scrape upsert

export interface UpsertResult {
  isNew: boolean;
  changed: boolean;
}

export function upsertScrapedEvent(e: ScrapedEvent): UpsertResult {
  const { city, state } = parsePlace(e.place);
  const now = nowIso();
  const run = db.transaction((): UpsertResult => {
    const ex = getEventRow(e.eventCode);
    if (!ex) {
      const info = db
        .prepare(
          `INSERT INTO events (eventCode, name, startDate, endDate, place, city, state, brochureUrl, extractionStatus, createdAt, updatedAt, lastSeenAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(e.eventCode, e.name, e.startDate, e.endDate, e.place, city, state, e.brochureUrl, e.brochureUrl ? "pending" : "no_brochure", now, now, now);
      syncFts(Number(info.lastInsertRowid));
      return { isNew: true, changed: true };
    }

    // A missing brochure on a later scrape never wipes a known one.
    const brochureUrl = e.brochureUrl ?? ex.brochureUrl;
    const brochureChanged = brochureUrl !== ex.brochureUrl;
    const changed =
      ex.name !== e.name || ex.startDate !== e.startDate || ex.endDate !== e.endDate || ex.place !== e.place ||
      ex.city !== city || ex.state !== state || brochureChanged;

    let status = ex.extractionStatus;
    let attempts = ex.extractionAttempts;
    let error = ex.extractionError;
    if (brochureUrl && (brochureChanged || ex.extractionStatus === "no_brochure")) {
      if (ex.extractionStatus === "done" && !brochureChanged) {
        /* unchanged */
      } else {
        status = "pending";
        attempts = 0;
        error = null;
      }
    }
    if (!brochureUrl) status = "no_brochure";

    if (!changed && status === ex.extractionStatus) {
      db.prepare("UPDATE events SET lastSeenAt = ? WHERE id = ?").run(now, ex.id);
      return { isNew: false, changed: false };
    }
    db.prepare(
      `UPDATE events SET name = ?, startDate = ?, endDate = ?, place = ?, city = ?, state = ?, brochureUrl = ?,
         extractionStatus = ?, extractionAttempts = ?, extractionError = ?, updatedAt = ?, lastSeenAt = ? WHERE id = ?`,
    ).run(e.name, e.startDate, e.endDate, e.place, city, state, brochureUrl, status, attempts, error, now, now, ex.id);
    syncFts(ex.id);
    return { isNew: false, changed: true };
  });
  return run();
}

// ---------------------------------------------------------------- extraction

export function saveExtraction(
  eventCode: string,
  extraction: BrochureExtraction,
  model: string,
  sourceHash: string,
): EventDetail | null {
  const ex = getEventRow(eventCode);
  if (!ex) return null;
  const fees = (extraction.entryFees ?? []).map((f) => f.amountInr).filter((n): n is number => typeof n === "number" && n >= 0);
  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `UPDATE events SET extractionStatus = 'done', extractionError = NULL, extractionJson = ?, extractionModel = ?,
         sourceHash = ?, extractedAt = ?, brochureUrlAtExtraction = ?, lastAttemptAt = ?,
         timeControlType = ?, rounds = ?, fideRated = ?, totalPrizeInr = ?, entryFeeMinInr = ?,
         registrationDeadline = ?, venueName = ?, tagline = ?, updatedAt = ?
       WHERE id = ?`,
    ).run(
      JSON.stringify(extraction), model, sourceHash, now, ex.brochureUrl, now,
      extraction.timeControl?.type ?? null,
      extraction.rounds ?? null,
      extraction.fideRated == null ? null : extraction.fideRated ? 1 : 0,
      extraction.prizes?.totalInr ?? null,
      fees.length ? Math.min(...fees) : null,
      extraction.registration?.deadline ?? null,
      extraction.venue?.name ?? null,
      extraction.tagline ?? null,
      now, ex.id,
    );
    syncFts(ex.id);
  })();
  return getEventDetail(eventCode);
}

export function saveExtractionFailure(eventCode: string, error: string): boolean {
  const ex = getEventRow(eventCode);
  if (!ex) return false;
  const now = nowIso();
  // A previously good extraction stays visible: only record the attempt.
  const status = ex.extractionStatus === "done" ? "done" : "failed";
  db.prepare(
    "UPDATE events SET extractionStatus = ?, extractionAttempts = extractionAttempts + 1, extractionError = ?, lastAttemptAt = ?, updatedAt = ? WHERE id = ?",
  ).run(status, error.slice(0, 2000), now, now, ex.id);
  return true;
}

export function getExtractionQueue(limit: number, force: boolean): QueueItem[] {
  const today = todayIST();
  const cutoff = new Date(Date.now() - RETRY_AFTER_HOURS * 3600_000).toISOString();
  const where = force
    ? "brochureUrl IS NOT NULL"
    : `brochureUrl IS NOT NULL AND (extractionStatus = 'pending'
         OR (extractionStatus = 'failed' AND extractionAttempts < ${MAX_ATTEMPTS} AND (lastAttemptAt IS NULL OR lastAttemptAt <= @cutoff)))`;
  const rows = db
    .prepare(
      `SELECT eventCode, name, brochureUrl, startDate, extractionAttempts FROM events WHERE ${where}
       ORDER BY (endDate < @today) ASC,
                CASE WHEN endDate >= @today THEN startDate END ASC,
                startDate DESC
       LIMIT @limit`,
    )
    .all({ today, cutoff, limit }) as { eventCode: string; name: string; brochureUrl: string; startDate: string; extractionAttempts: number }[];
  return rows.map((r) => ({ eventCode: r.eventCode, name: r.name, brochureUrl: r.brochureUrl, startDate: r.startDate, attempts: r.extractionAttempts }));
}

// ---------------------------------------------------------------- listing

export interface ListFilters {
  q?: string;
  status: string[]; // upcoming|ongoing|past ; empty = all
  state: string[];
  city: string[];
  timeControl: string[];
  from?: string;
  to?: string;
  minPrize?: number;
  maxFee?: number;
  fideRated?: boolean;
  sort: string;
  page: number;
  pageSize: number;
}

/** Turn arbitrary user text into a safe FTS5 prefix query, or null if nothing searchable. */
export function toFtsQuery(q: string | undefined): string | null {
  if (!q) return null;
  const tokens = q.normalize("NFKC").match(/[\p{L}\p{N}]+/gu)?.slice(0, 8);
  if (!tokens?.length) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

const SORTS: Record<string, string> = {
  startDate: "startDate ASC, eventCode ASC",
  "-startDate": "startDate DESC, eventCode ASC",
  prize: "(totalPrizeInr IS NULL), totalPrizeInr ASC, startDate ASC",
  "-prize": "(totalPrizeInr IS NULL), totalPrizeInr DESC, startDate ASC",
  fee: "(entryFeeMinInr IS NULL), entryFeeMinInr ASC, startDate ASC",
  name: "name COLLATE NOCASE ASC, eventCode ASC",
};

export function listEvents(f: ListFilters): { rows: EventSummary[]; total: number } {
  const today = todayIST();
  const where: string[] = [];
  const params: Record<string, string | number> = { today };

  if (f.status.length) {
    const parts: string[] = [];
    if (f.status.includes("upcoming")) parts.push("startDate > @today");
    if (f.status.includes("ongoing")) parts.push("(startDate <= @today AND endDate >= @today)");
    if (f.status.includes("past")) parts.push("endDate < @today");
    where.push(`(${parts.join(" OR ")})`);
  }
  const inList = (col: string, key: string, vals: string[]) => {
    if (!vals.length) return;
    const names = vals.map((v, i) => {
      params[`${key}${i}`] = v;
      return `@${key}${i}`;
    });
    where.push(`${col} IN (${names.join(",")})`);
  };
  inList("state", "st", f.state);
  inList("city", "ci", f.city);
  inList("timeControlType", "tc", f.timeControl);
  if (f.from) { where.push("endDate >= @from"); params.from = f.from; }
  if (f.to) { where.push("startDate <= @to"); params.to = f.to; }
  if (f.minPrize != null) { where.push("totalPrizeInr >= @minPrize"); params.minPrize = f.minPrize; }
  if (f.maxFee != null) { where.push("entryFeeMinInr <= @maxFee"); params.maxFee = f.maxFee; }
  if (f.fideRated != null) { where.push("fideRated = @fide"); params.fide = f.fideRated ? 1 : 0; }
  const fts = toFtsQuery(f.q);
  if (fts) {
    where.push("id IN (SELECT rowid FROM events_fts WHERE events_fts MATCH @fts)");
    params.fts = fts;
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM events ${w}`).get(params) as { c: number }).c;
  const rows = db
    .prepare(`SELECT ${SUMMARY_COLUMNS} FROM events ${w} ORDER BY ${SORTS[f.sort] ?? SORTS.startDate} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: f.pageSize, offset: (f.page - 1) * f.pageSize }) as EventRow[];
  return { rows: rows.map((r) => toSummary(r, today)), total };
}

// ---------------------------------------------------------------- facets & stats

function facet(col: string, today: string): FacetCount[] {
  return db
    .prepare(
      `SELECT ${col} AS value, COUNT(*) AS count FROM events
       WHERE endDate >= ? AND ${col} IS NOT NULL AND ${col} != ''
       GROUP BY ${col} ORDER BY count DESC, value ASC`,
    )
    .all(today) as FacetCount[];
}

export function getFacets() {
  const today = todayIST();
  return { states: facet("state", today), cities: facet("city", today), timeControls: facet("timeControlType", today) };
}

export function getStats(): Stats {
  const today = todayIST();
  const one = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { c: number }).c;
  const weekEnd = addDays(today, 6);
  const [y, m] = today.split("-").map(Number);
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const counts = new Map(
    (db
      .prepare("SELECT substr(startDate,1,7) AS month, COUNT(*) AS count FROM events WHERE startDate >= ? GROUP BY month")
      .all(`${months[0]}-01`) as { month: string; count: number }[]).map((r) => [r.month, r.count]),
  );
  return {
    total: one("SELECT COUNT(*) AS c FROM events"),
    upcoming: one("SELECT COUNT(*) AS c FROM events WHERE startDate > ?", today),
    ongoing: one("SELECT COUNT(*) AS c FROM events WHERE startDate <= ? AND endDate >= ?", today, today),
    startingThisWeek: one("SELECT COUNT(*) AS c FROM events WHERE startDate >= ? AND startDate <= ?", today, weekEnd),
    upcomingPrizePoolInr: one("SELECT COALESCE(SUM(totalPrizeInr),0) AS c FROM events WHERE endDate >= ?", today),
    extracted: one("SELECT COUNT(*) AS c FROM events WHERE extractionStatus = 'done'"),
    byMonth: months.map((month) => ({ month, count: counts.get(month) ?? 0 })),
    byState: facet("state", today),
    byTimeControl: facet("timeControlType", today),
  };
}

export function countEvents(): number {
  return (db.prepare("SELECT COUNT(*) AS c FROM events").get() as { c: number }).c;
}
