import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "@/lib/api";
import type { EventSummary } from "@/types/event";

const PAGE = 200;
const MAX_PAGES = 10;

/**
 * The whole live catalogue (upcoming + ongoing, optionally past) in one cached array. It's a few
 * hundred rows, so loading it once lets every filter, count and sort run instantly on the client.
 */
export function useCatalog(includePast: boolean) {
  return useQuery({
    queryKey: ["catalog", includePast],
    queryFn: async (): Promise<EventSummary[]> => {
      const status = includePast ? ["upcoming", "ongoing", "past"] : ["upcoming", "ongoing"];
      const first = await fetchEvents({ status, sort: "startDate", page: 1, pageSize: PAGE });
      const pages = Math.min(first.meta.pageCount, MAX_PAGES);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchEvents({ status, sort: "startDate", page: i + 2, pageSize: PAGE }))
      );
      return [first, ...rest].flatMap((p) => p.data);
    },
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}
