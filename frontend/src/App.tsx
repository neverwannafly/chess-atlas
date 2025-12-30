import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Filters } from "@/components/Filters";
import { EventsTable } from "@/components/EventsTable";
import { EventDetail } from "@/components/EventDetail";
import { useEvents, useStats } from "@/hooks/useEvents";
import type { ChessEvent, EventFilters } from "@/types/event";

const queryClient = new QueryClient();

function EventsPage() {
  const [filters, setFilters] = useState<EventFilters>({ status: "upcoming" });
  const [selectedEvent, setSelectedEvent] = useState<ChessEvent | null>(null);
  const { data, isLoading } = useEvents(filters);
  const { data: stats } = useStats();

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex-1 flex flex-col min-h-0 px-4 pb-3">
        <Filters filters={filters} onChange={setFilters} />

        {/* Stats */}
        <div className="flex items-center justify-between py-2 text-xs text-muted-foreground shrink-0">
          <span>
            <span className="font-semibold text-foreground">{data?.count ?? 0}</span> tournaments
          </span>
          {stats && (
            <span>
              {stats.upcoming} upcoming · {stats.ongoing} live · {stats.total} total
            </span>
          )}
        </div>

        {/* Table - fills remaining space */}
        <EventsTable
          events={data?.data ?? []}
          isLoading={isLoading}
          onEventClick={setSelectedEvent}
        />
      </div>

      <EventDetail
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EventsPage />
    </QueryClientProvider>
  );
}
