import { useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type { CrPage, CrTournament } from "@/types/chessresults";
import {
  fetchCrRound, fetchCrStatus, fetchCrTournament, fetchCrTournaments, fetchPlayer, searchPlayers, type CrQuery,
} from "@/lib/chessresults";

const MIN = 60_000;
const notFound = (n: number, e: unknown) => (e as { status?: number }).status !== 404 && n < 2;

/** Ongoing tournaments, refetched every minute (also in background tabs so the page is fresh on return). */
export const useLiveTournaments = () =>
  useQuery({
    queryKey: ["cr", "list", { status: "ongoing", fed: "IND", pageSize: 100 }],
    queryFn: () => fetchCrTournaments({ status: "ongoing", fed: "IND", pageSize: 100 }),
    refetchInterval: MIN,
    staleTime: 30_000,
  });

export function useCrTournaments(query: CrQuery) {
  return useInfiniteQuery({
    queryKey: ["cr", "infinite", query],
    queryFn: ({ pageParam }) => fetchCrTournaments({ ...query, page: pageParam, pageSize: query.pageSize ?? 50 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.pageCount ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: MIN,
  });
}

/** Counts per status tab (pageSize 1: only meta.total is used). */
export function useCrCount(status: CrQuery["status"], q: string) {
  return useQuery({
    queryKey: ["cr", "count", status ?? "all", q],
    queryFn: () => fetchCrTournaments({ status, fed: "IND", q, pageSize: 1 }),
    select: (r) => r.meta.total,
    staleTime: MIN,
    placeholderData: keepPreviousData,
  });
}

export const useCrTournament = (id: string, live: boolean) =>
  useQuery({
    queryKey: ["cr", "tournament", id],
    queryFn: () => fetchCrTournament(id),
    staleTime: 30_000,
    refetchInterval: live ? MIN : false,
    retry: notFound,
  });

export const useCrRound = (id: string, round: number | null, live: boolean) =>
  useQuery({
    queryKey: ["cr", "round", id, round],
    queryFn: () => fetchCrRound(id, round!),
    enabled: round != null,
    staleTime: 30_000,
    refetchInterval: live ? MIN : false,
    placeholderData: keepPreviousData,
  });

export const useCrStatus = () => useQuery({ queryKey: ["cr", "status"], queryFn: fetchCrStatus, staleTime: MIN });

export const usePlayerSearch = (q: string) =>
  useQuery({
    queryKey: ["players", "search", q],
    queryFn: () => searchPlayers(q),
    enabled: q.trim().length >= 2,
    staleTime: 5 * MIN,
    placeholderData: keepPreviousData,
  });

export const usePlayer = (id: string) =>
  useQuery({ queryKey: ["players", id], queryFn: () => fetchPlayer(id), staleTime: 5 * MIN, retry: notFound });

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Re-render every `ms` so relative times ("3 minutes ago") stay honest. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * The detail payload replaces the scheduled round count with the per-round array, so the total
 * ("Round 5 of 9") comes from any list response already in the cache.
 */
export function useListedRounds(id: string): number | null {
  const qc = useQueryClient();
  for (const [, d] of qc.getQueriesData<CrPage<CrTournament> | InfiniteData<CrPage<CrTournament>>>({ queryKey: ["cr"] })) {
    if (!d || typeof d !== "object") continue;
    const pages = "pages" in d ? d.pages : "data" in d && Array.isArray(d.data) ? [d] : [];
    for (const pg of pages) {
      const hit = pg.data.find((t) => t.id === id);
      if (hit?.rounds != null) return hit.rounds;
    }
  }
  return null;
}
