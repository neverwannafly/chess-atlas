export interface ChessEvent {
  id: number;
  eventCode: string;
  name: string;
  startDate: string;
  endDate: string;
  city: string | null;
  state: string | null;
  brochureUrl: string | null;

  summary: string | null;
  description: string | null;
  venueDetails: string | null;
  venueAddress: string | null;
  venueMapQuery: string | null;
  timeControlDetails: string | null;
  timeControlType: string | null;
  rounds: number | null;
  totalPrize: string | null;
  prizeBreakdown: string | null;
  entryFee: string | null;
  entryFeeBreakdown: string | null;
  ratingCategories: string | null;
  ageCategories: string | null;
  eligibility: string | null;
  registrationLink: string | null;
  registrationDeadline: string | null;
  organizer: string | null;
  arbiter: string | null;
  contact: string | null;
  accommodation: string | null;
  schedule: string | null;

  createdAt: string;
  updatedAt: string;
  pdfParsedAt: string | null;
}

export interface EventFilters {
  state?: string;
  city?: string;
  timeControlType?: string;
  startDateFrom?: string;
  startDateTo?: string;
  search?: string;
  status?: "upcoming" | "ongoing" | "past" | "all";
}

export interface FiltersData {
  states: string[];
  cities: string[];
  timeControls: string[];
}

export interface Stats {
  total: number;
  upcoming: number;
  ongoing: number;
  withPrize: number;
  parsed: number;
}
