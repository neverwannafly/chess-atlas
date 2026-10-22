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
