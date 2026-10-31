import type { EventDetail, EventSummary, FacetCount, Paginated, Stats } from "@/types/event";

export interface EventQuery {
  q?: string;
  status?: string[];
  state?: string[];
  city?: string[];
  timeControl?: string[];
  from?: string;
  to?: string;
  minPrize?: number;
  maxFee?: number;
  fideRated?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface FilterFacets {
  states: FacetCount[];
  cities: FacetCount[];
  timeControls: FacetCount[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toSearchParams(q: EventQuery): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string | number | boolean | undefined | string[]) => {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
    p.set(k, Array.isArray(v) ? v.join(",") : String(v));
  };
  set("q", q.q?.trim());
  set("status", q.status);
  set("state", q.state);
  set("city", q.city);
  set("timeControl", q.timeControl);
  set("from", q.from);
  set("to", q.to);
  set("minPrize", q.minPrize);
  set("maxFee", q.maxFee);
  set("fideRated", q.fideRated);
  set("sort", q.sort);
  set("page", q.page);
  set("pageSize", q.pageSize);
  return p;
}

const MOCK = import.meta.env.VITE_MOCK === "1";

export async function get<T>(path: string, params?: URLSearchParams): Promise<T> {
  const url = params && params.size ? `${path}?${params}` : path;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (!res.ok) {
    let msg = res.statusText || "Request failed";
    try {
      msg = (await res.json()).error?.message ?? msg;
    } catch { /* not json */ }
    throw new ApiError(res.status, msg);
  }
  return res.json();
}

export async function fetchEvents(q: EventQuery): Promise<Paginated<EventSummary>> {
  if (MOCK) return (await import("@/mocks/handlers")).mockEvents(q);
  return get("/api/events", toSearchParams(q));
}

export async function fetchEvent(code: string): Promise<EventDetail> {
  if (MOCK) return (await import("@/mocks/handlers")).mockEvent(code);
  return (await get<{ data: EventDetail }>(`/api/events/${encodeURIComponent(code)}`)).data;
}

export async function fetchFilters(): Promise<FilterFacets> {
  if (MOCK) return (await import("@/mocks/handlers")).mockFilters();
  return (await get<{ data: FilterFacets }>("/api/meta/filters")).data;
}

export async function fetchStats(): Promise<Stats> {
  if (MOCK) return (await import("@/mocks/handlers")).mockStats();
  return (await get<{ data: Stats }>("/api/meta/stats")).data;
}

export const calendarUrl = (code: string) => `/api/events/${encodeURIComponent(code)}/calendar.ics`;

// ---------------------------------------------------------------- insights
import type { Insights } from "@/types/event";

export async function fetchInsights(): Promise<Insights> {
  return (await get<{ data: Insights }>("/api/meta/insights")).data;
}

// ---------------------------------------------------------------- privacy
export interface DeletionRequestInput {
  name: string;
  fideId?: string;
  chessResultsTournamentId?: string;
  chessResultsStartNo?: number;
  contactEmail: string;
  note?: string;
  confirm: true;
}

export async function submitDeletionRequest(body: DeletionRequestInput): Promise<{ id: string | number }> {
  let res: Response;
  try {
    res = await fetch("/api/privacy/deletion-requests", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  if (!res.ok) {
    let msg = "";
    try {
      const j = await res.json();
      msg = typeof j.error === "string" ? j.error : j.error?.message ?? j.message ?? "";
    } catch { /* not json */ }
    throw new ApiError(res.status, msg);
  }
  const j = await res.json();
  return { id: j.data.id };
}

// ---------------------------------------------------------------- freshness
export interface Health { status: string; events: number; lastScrapeAt: string | null; version: string }

export async function fetchHealth(): Promise<Health> {
  if (MOCK) return { status: "ok", events: 0, lastScrapeAt: new Date().toISOString(), version: "mock" };
  return (await get<{ data: Health }>("/api/health")).data;
}
