// Shared contract — keep identical to frontend/src/types/event.ts. See docs/CONTRACT.md.

export type EventStatus = "upcoming" | "ongoing" | "past";
export type TimeControlType = "Classical" | "Rapid" | "Blitz" | "Mixed";
export type ExtractionStatus = "pending" | "done" | "failed" | "no_brochure";

/** Structured data pulled from a tournament brochure PDF by the extraction worker. */
export interface BrochureExtraction {
  /** 2–3 short paragraphs written for a player deciding whether to attend. */
  summary: string | null;
  /** One line, ≤ 120 chars. */
  tagline: string | null;
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    /** Google Maps search query that finds the venue. */
    mapQuery: string | null;
  };
  timeControl: {
    type: TimeControlType | null;
    baseMinutes: number | null;
    incrementSeconds: number | null;
    /** As written in the brochure, e.g. "90 min + 30 sec from move 1". */
    raw: string | null;
  };
  rounds: number | null;
  fideRated: boolean | null;
  /** e.g. "Swiss", "Round robin". */
  format: string | null;
  prizes: {
    totalInr: number | null;
    /** Main standings prizes in order. */
    places: { label: string; amountInr: number | null; extra: string | null }[];
    /** Category / special prizes (Best Woman, U-1600, Best Veteran…). */
    categoryPrizes: { category: string; label: string; amountInr: number | null }[];
    notes: string | null;
  };
  entryFees: { category: string; amountInr: number | null }[];
  categories: { rating: string[]; age: string[] };
  eligibility: string | null;
  registration: {
    link: string | null;
    /** YYYY-MM-DD */
    deadline: string | null;
    notes: string | null;
  };
  organizer: string | null;
  chiefArbiter: string | null;
  contacts: { name: string | null; role: string | null; phone: string | null; email: string | null }[];
  accommodation: string | null;
  schedule: { date: string | null; time: string | null; item: string }[];
}

/** Row shape for list views. */
export interface EventSummary {
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string | null;
  state: string | null;
  status: EventStatus;
  brochureUrl: string | null;
  extractionStatus: ExtractionStatus;
  tagline: string | null;
  timeControlType: TimeControlType | null;
  rounds: number | null;
  fideRated: boolean | null;
  totalPrizeInr: number | null;
  entryFeeMinInr: number | null;
  registrationDeadline: string | null;
  venueName: string | null;
}

export interface EventDetail extends EventSummary {
  details: BrochureExtraction | null;
  extractedAt: string | null;
  extractionModel: string | null;
  aicfUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface Stats {
  total: number;
  upcoming: number;
  ongoing: number;
  startingThisWeek: number;
  upcomingPrizePoolInr: number;
  extracted: number;
  byMonth: { month: string; count: number }[]; // next 12 months, "YYYY-MM"
  byState: FacetCount[];
  byTimeControl: FacetCount[];
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}

export interface QueueSibling {
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface QueueItem {
  eventCode: string;
  name: string;
  brochureUrl: string;
  startDate: string;
  endDate?: string;
  attempts: number;
  /** Other events listed with the same brochure URL (festival sections). */
  siblings?: QueueSibling[];
}

export interface ExtractionSubmission {
  extraction: BrochureExtraction;
  model: string;
  /** sha256 of the downloaded PDF bytes. */
  sourceHash: string;
}

export interface ScrapedEvent {
  eventCode: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  place: string;
  brochureUrl: string | null;
}

// ---------------------------------------------------------------- insights (GET /api/meta/insights)

export type InsightFormat = TimeControlType | "Unknown";

/** A tournament referenced from an insight (links to /events/:eventCode). */
export interface InsightEvent {
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string | null;
  state: string | null;
  timeControlType: TimeControlType | null;
  totalPrizeInr: number | null;
  entryFeeMinInr: number | null;
  registrationDeadline: string | null;
  /** What a regular adult entrant pays, from the brochure's fee table (titled-player waivers and late fees ignored). */
  entryFeeInr: number | null;
}

export interface InsightBand {
  label: string;
  /** Inclusive lower bound (₹ or days). */
  min: number;
  /** Exclusive upper bound; null = open-ended. */
  max: number | null;
  count: number;
}

/** Aggregates over one slice of events ("upcoming" = not yet finished, "all" = everything on record). */
export interface InsightsScope {
  total: number;
  /** Events with extracted brochure data. */
  withDetails: number;
  prizePoolInr: number;
  /** Events with a known prize pool. */
  prizeKnown: number;
  medianPrizeInr: number | null;
  /** Median standard entry fee (see InsightEvent.entryFeeInr). */
  medianEntryFeeInr: number | null;
  /** Mean count of listed prizes (place + category) per extracted event. */
  avgPrizesPerEvent: number | null;
  states: number;
  cities: number;
  formats: { format: InsightFormat; count: number; medianRounds: number | null; medianPrizeInr: number | null }[];
  /** Most common time controls, e.g. "90+30". */
  timeControls: { label: string; baseMinutes: number; incrementSeconds: number; format: TimeControlType | null; count: number }[];
  byState: { state: string; count: number; prizeInr: number }[];
  topCities: { city: string; state: string | null; count: number }[];
  prizeBands: InsightBand[];
  feeBands: InsightBand[];
  topPrizes: InsightEvent[];
  /** Highest prize pool per rupee of standard entry fee (fee ≥ ₹100). */
  bestValue: (InsightEvent & { ratio: number })[];
  /** Start-day counts, Monday first (index 0 = Mon … 6 = Sun). */
  weekdays: number[];
  /** Length in days: "1", "2", … "7+". */
  durations: { label: string; count: number }[];
  /** Days between registration deadline and start. */
  leadBands: InsightBand[];
  medianLeadDays: number | null;
  /** Share of extracted events that list each kind of category prize. */
  categoryPrizes: { key: string; label: string; events: number; share: number }[];
}

export interface Insights {
  generatedAt: string;
  /** YYYY-MM-DD, Asia/Kolkata. */
  today: string;
  /** Every month from the first to the last event on record, by start month. */
  months: { month: string; total: number; prizeInr: number; byFormat: Record<InsightFormat, number> }[];
  /** Days with at least one tournament in play. */
  days: { date: string; inPlay: number; starting: number }[];
  thisWeek: {
    from: string;
    to: string;
    starting: number;
    ongoing: number;
    /** Registration deadlines falling in the next 7 days. */
    closingSoon: number;
    biggest: InsightEvent | null;
    next: InsightEvent[];
  };
  upcoming: InsightsScope;
  all: InsightsScope;
}
