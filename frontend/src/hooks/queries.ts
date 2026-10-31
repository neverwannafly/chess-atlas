import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchEvent, fetchEvents, fetchFilters, fetchStats, type EventQuery } from "@/lib/api";

const MIN = 60_000;

export function useEventsInfinite(query: EventQuery, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: ["events", "infinite", query],
    queryFn: ({ pageParam }) => fetchEvents({ ...query, page: pageParam, pageSize: query.pageSize ?? 30 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.pageCount ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 2 * MIN,
  });
}

export function useEventsPage(query: EventQuery, enabled = true) {
  return useQuery({
    queryKey: ["events", "page", query],
    queryFn: () => fetchEvents(query),
    placeholderData: keepPreviousData,
    staleTime: 2 * MIN,
    enabled,
  });
}

export const useEvent = (code: string, enabled = true) =>
  useQuery({
    queryKey: ["event", code],
    queryFn: () => fetchEvent(code),
    staleTime: 5 * MIN,
    enabled: enabled && !!code,
    retry: (n, e) => (e as { status?: number }).status !== 404 && n < 2,
  });

export const useFacets = () => useQuery({ queryKey: ["filters"], queryFn: fetchFilters, staleTime: 10 * MIN });
export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: fetchStats, staleTime: 10 * MIN });

/** "More tournaments" for an event page: upcoming ones in the same state, and others overlapping the same week. */
export function useRelatedEvents(e: { eventCode: string; state: string | null; startDate: string } | undefined, today: string) {
  const from = e ? (e.startDate > today ? e.startDate : today) : today;
  const weekEnd = new Date(`${from}T00:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const to = weekEnd.toISOString().slice(0, 10);
  const sameState = useQuery({
    queryKey: ["events", "related", "state", e?.state, today],
    queryFn: () => fetchEvents({ state: e?.state ? [e.state] : undefined, from: today, sort: "startDate", pageSize: 8 }),
    enabled: !!e?.state,
    staleTime: 5 * MIN,
  });
  const sameWeek = useQuery({
    queryKey: ["events", "related", "week", from, to],
    queryFn: () => fetchEvents({ from, to, sort: "startDate", pageSize: 24 }),
    enabled: !!e,
    staleTime: 5 * MIN,
  });
  return { sameState, sameWeek };
}

// ---------------------------------------------------------------- insights
import { fetchInsights } from "@/lib/api";

export const useInsights = () => useQuery({ queryKey: ["insights"], queryFn: fetchInsights, staleTime: 10 * MIN });

// ---------------------------------------------------------------- freshness
import { fetchHealth } from "@/lib/api";

/** When the AICF calendar was last scraped; feeds the source line on calendar pages. */
export const useHealth = () => useQuery({ queryKey: ["health"], queryFn: fetchHealth, staleTime: 5 * MIN });
