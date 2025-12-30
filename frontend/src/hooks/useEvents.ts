import { useQuery } from "@tanstack/react-query";
import type { ChessEvent, EventFilters, FiltersData, Stats } from "@/types/event";

const API_BASE = "/api";

async function fetchEvents(filters: EventFilters): Promise<{ data: ChessEvent[]; count: number }> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const res = await fetch(`${API_BASE}/events?${params}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

async function fetchEvent(eventCode: string): Promise<ChessEvent> {
  const res = await fetch(`${API_BASE}/events/${eventCode}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  const json = await res.json();
  return json.data;
}

async function fetchFilters(): Promise<FiltersData> {
  const res = await fetch(`${API_BASE}/events/filters`);
  if (!res.ok) throw new Error("Failed to fetch filters");
  const json = await res.json();
  return json.data;
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/events/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  const json = await res.json();
  return json.data;
}

export function useEvents(filters: EventFilters) {
  return useQuery({
    queryKey: ["events", filters],
    queryFn: () => fetchEvents(filters),
    staleTime: 1000 * 60 * 5,
  });
}

export function useEvent(eventCode: string | undefined) {
  return useQuery({
    queryKey: ["event", eventCode],
    queryFn: () => fetchEvent(eventCode!),
    enabled: !!eventCode,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFilters() {
  return useQuery({
    queryKey: ["filters"],
    queryFn: fetchFilters,
    staleTime: 1000 * 60 * 30,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 5,
  });
}
