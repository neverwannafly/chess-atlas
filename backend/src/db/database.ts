import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import type { ChessEvent, EventFilters, ParsedPdfData, ScrapedEvent } from "../types/event.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../data/chessatlas.db");

const db: InstanceType<typeof Database> = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventCode TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    city TEXT,
    state TEXT,
    brochureUrl TEXT,

    -- PDF-extracted fields
    summary TEXT,
    description TEXT,
    venueDetails TEXT,
    venueAddress TEXT,
    venueMapQuery TEXT,
    timeControlDetails TEXT,
    timeControlType TEXT,
    rounds INTEGER,
    totalPrize TEXT,
    prizeBreakdown TEXT,
    entryFee TEXT,
    entryFeeBreakdown TEXT,
    ratingCategories TEXT,
    ageCategories TEXT,
    eligibility TEXT,
    registrationLink TEXT,
    registrationDeadline TEXT,
    organizer TEXT,
    arbiter TEXT,
    contact TEXT,
    accommodation TEXT,
    schedule TEXT,

    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    pdfParsedAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(startDate);
  CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(endDate);
  CREATE INDEX IF NOT EXISTS idx_events_state ON events(state);
  CREATE INDEX IF NOT EXISTS idx_events_time_control ON events(timeControlType);
`);

export function upsertEvent(event: ScrapedEvent): { isNew: boolean; needsPdfParse: boolean } {
  const [city, state] = parsePlace(event.place);

  const existing = db
    .prepare("SELECT id, pdfParsedAt, brochureUrl FROM events WHERE eventCode = ?")
    .get(event.eventCode) as { id: number; pdfParsedAt: string | null; brochureUrl: string | null } | undefined;

  const stmt = db.prepare(`
    INSERT INTO events (eventCode, name, startDate, endDate, city, state, brochureUrl, updatedAt)
    VALUES (@eventCode, @name, @startDate, @endDate, @city, @state, @brochureUrl, datetime('now'))
    ON CONFLICT(eventCode) DO UPDATE SET
      name = @name,
      startDate = @startDate,
      endDate = @endDate,
      city = @city,
      state = @state,
      brochureUrl = @brochureUrl,
      updatedAt = datetime('now')
  `);

  stmt.run({
    eventCode: event.eventCode,
    name: event.name,
    startDate: parseDate(event.startDate),
    endDate: parseDate(event.endDate),
    city,
    state,
    brochureUrl: event.brochureUrl,
  });

  const isNew = !existing;
  const brochureChanged = Boolean(existing && existing.brochureUrl !== event.brochureUrl);
  const needsPdfParse = event.brochureUrl !== null && (!existing?.pdfParsedAt || brochureChanged);

  return { isNew, needsPdfParse };
}

export function updateEventWithPdfData(eventCode: string, pdfData: ParsedPdfData): void {
  const sanitized = Object.fromEntries(
    Object.entries(pdfData).map(([key, value]) => [
      key,
      value === null || value === undefined
        ? null
        : typeof value === "object"
          ? JSON.stringify(value)
          : value,
    ])
  ) as ParsedPdfData;

  const stmt = db.prepare(`
    UPDATE events SET
      summary = @summary,
      description = @description,
      venueDetails = @venueDetails,
      venueAddress = @venueAddress,
      venueMapQuery = @venueMapQuery,
      timeControlDetails = @timeControlDetails,
      timeControlType = @timeControlType,
      rounds = @rounds,
      totalPrize = @totalPrize,
      prizeBreakdown = @prizeBreakdown,
      entryFee = @entryFee,
      entryFeeBreakdown = @entryFeeBreakdown,
      ratingCategories = @ratingCategories,
      ageCategories = @ageCategories,
      eligibility = @eligibility,
      registrationLink = @registrationLink,
      registrationDeadline = @registrationDeadline,
      organizer = @organizer,
      arbiter = @arbiter,
      contact = @contact,
      accommodation = @accommodation,
      schedule = @schedule,
      pdfParsedAt = datetime('now'),
      updatedAt = datetime('now')
    WHERE eventCode = @eventCode
  `);

  stmt.run({ eventCode, ...sanitized });
}

export function getEvents(filters: EventFilters = {}): ChessEvent[] {
  let query = "SELECT * FROM events WHERE brochureUrl IS NOT NULL";
  const params: Record<string, string> = {};

  if (filters.status && filters.status !== "all") {
    const today = new Date().toISOString().split("T")[0];
    if (filters.status === "upcoming") {
      query += " AND startDate > @today";
      params.today = today;
    } else if (filters.status === "ongoing") {
      query += " AND startDate <= @today AND endDate >= @today";
      params.today = today;
    } else if (filters.status === "past") {
      query += " AND endDate < @today";
      params.today = today;
    }
  }

  if (filters.state) {
    query += " AND state = @state";
    params.state = filters.state;
  }

  if (filters.city) {
    query += " AND city = @city";
    params.city = filters.city;
  }

  if (filters.timeControlType) {
    query += " AND timeControlType = @timeControlType";
    params.timeControlType = filters.timeControlType;
  }

  if (filters.startDateFrom) {
    query += " AND startDate >= @startDateFrom";
    params.startDateFrom = filters.startDateFrom;
  }

  if (filters.startDateTo) {
    query += " AND startDate <= @startDateTo";
    params.startDateTo = filters.startDateTo;
  }

  if (filters.search) {
    query += " AND (name LIKE @search OR city LIKE @search OR state LIKE @search OR description LIKE @search OR organizer LIKE @search)";
    params.search = `%${filters.search}%`;
  }

  query += " ORDER BY startDate ASC";

  return db.prepare(query).all(params) as ChessEvent[];
}

export function getEventByCode(eventCode: string): ChessEvent | undefined {
  return db.prepare("SELECT * FROM events WHERE eventCode = ?").get(eventCode) as
    | ChessEvent
    | undefined;
}

export function getDistinctStates(): string[] {
  const rows = db
    .prepare("SELECT DISTINCT state FROM events WHERE state IS NOT NULL AND state != '' ORDER BY state")
    .all() as { state: string }[];
  return rows.map((r) => r.state);
}

export function getDistinctCities(): string[] {
  const rows = db
    .prepare("SELECT DISTINCT city FROM events WHERE city IS NOT NULL AND city != '' ORDER BY city")
    .all() as { city: string }[];
  return rows.map((r) => r.city);
}

export function getDistinctTimeControls(): string[] {
  const rows = db
    .prepare("SELECT DISTINCT timeControlType FROM events WHERE timeControlType IS NOT NULL ORDER BY timeControlType")
    .all() as { timeControlType: string }[];
  return rows.map((r) => r.timeControlType);
}

export function getStats() {
  const today = new Date().toISOString().split("T")[0];
  const total = (db.prepare("SELECT COUNT(*) as count FROM events WHERE brochureUrl IS NOT NULL").get() as { count: number }).count;
  const upcoming = (
    db.prepare("SELECT COUNT(*) as count FROM events WHERE brochureUrl IS NOT NULL AND startDate > ?").get(today) as { count: number }
  ).count;
  const ongoing = (
    db.prepare("SELECT COUNT(*) as count FROM events WHERE brochureUrl IS NOT NULL AND startDate <= ? AND endDate >= ?").get(today, today) as { count: number }
  ).count;
  const withPrize = (
    db.prepare("SELECT COUNT(*) as count FROM events WHERE brochureUrl IS NOT NULL AND totalPrize IS NOT NULL").get() as { count: number }
  ).count;
  const parsed = (
    db.prepare("SELECT COUNT(*) as count FROM events WHERE pdfParsedAt IS NOT NULL").get() as { count: number }
  ).count;
  return { total, upcoming, ongoing, withPrize, parsed };
}

function parseDate(dateStr: string): string {
  const [day, month, year] = dateStr.split("-");
  return `${year}-${month}-${day}`;
}

function parsePlace(place: string): [string | null, string | null] {
  const cleaned = place.replace(/\s+/g, " ").trim();
  const parts = cleaned.split(",").map((p) => p.trim());

  if (parts.length >= 2) {
    return [parts[0], parts[parts.length - 1]];
  }

  const knownStates = [
    "Karnataka", "Tamil Nadu", "Kerala", "Maharashtra", "Andhra Pradesh",
    "Telangana", "Gujarat", "Rajasthan", "Punjab", "Haryana", "UP",
    "MP", "West Bengal", "Odisha", "Bihar", "Jharkhand", "Assam",
    "Goa", "Delhi", "Uttarakhand", "Himachal Pradesh", "Arunachal Pradesh",
  ];

  for (const state of knownStates) {
    if (cleaned.toLowerCase().includes(state.toLowerCase())) {
      const city = cleaned.replace(new RegExp(state, "i"), "").replace(/,/g, "").trim();
      return [city || null, state];
    }
  }

  return [cleaned, null];
}

export default db;
