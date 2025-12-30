import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { MapPin, Trophy, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRange, getEventStatus, daysUntil, getGoogleMapsUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ChessEvent } from "@/types/event";

interface EventsTableProps {
  events: ChessEvent[];
  isLoading: boolean;
  onEventClick: (event: ChessEvent) => void;
}

export function EventsTable({ events, isLoading, onEventClick }: EventsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "startDate", desc: false }]);

  const columns = useMemo<ColumnDef<ChessEvent>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <SortableHeader column={column} title="Tournament" />
        ),
        size: 200,
        maxSize: 200,
        cell: ({ row }) => {
          const event = row.original;
          const status = getEventStatus(event.startDate, event.endDate);
          const days = daysUntil(event.startDate);
          return (
            <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
              <StatusDot status={status} days={days} />
              <span className="font-medium truncate" title={event.name}>
                {event.name}
              </span>
            </div>
          );
        },
      },
      {
        id: "startDate",
        accessorKey: "startDate",
        header: ({ column }) => (
          <SortableHeader column={column} title="Dates" />
        ),
        size: 110,
        maxSize: 120,
        cell: ({ row }) => (
          <span className="text-muted-foreground whitespace-nowrap text-xs">
            {formatDateRange(row.original.startDate, row.original.endDate)}
          </span>
        ),
      },
      {
        id: "location",
        accessorFn: (row) => `${row.city || ""} ${row.state || ""}`,
        header: ({ column }) => (
          <SortableHeader column={column} title="Location" />
        ),
        size: 120,
        maxSize: 140,
        cell: ({ row }) => {
          const event = row.original;
          const mapsUrl = getGoogleMapsUrl(event.venueMapQuery || `${event.city}, ${event.state}, India`);
          const location = [event.city, event.state].filter(Boolean).join(", ");
          
          if (mapsUrl && location) {
            return (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
              >
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
              </a>
            );
          }
          return <span className="text-xs text-muted-foreground truncate">{location || "—"}</span>;
        },
      },
      {
        id: "timeControl",
        accessorKey: "timeControlType",
        header: ({ column }) => (
          <SortableHeader column={column} title="Format" />
        ),
        size: 100,
        maxSize: 120,
        cell: ({ row }) => {
          const event = row.original;
          const details = event.timeControlDetails;
          const type = event.timeControlType;
          
          if (!type && !details) return <span className="text-muted-foreground">—</span>;
          
          return (
            <div className="flex flex-col gap-0.5">
              {type && (
                <span className={cn(
                  "inline-block w-fit px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase",
                  type === "Classical" && "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
                  type === "Rapid" && "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
                  type === "Blitz" && "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                )}>
                  {type}
                </span>
              )}
              {details && (
                <span className="text-[10px] text-muted-foreground truncate" title={details}>
                  {details}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "rounds",
        accessorKey: "rounds",
        header: "Rds",
        size: 50,
        maxSize: 60,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.rounds || "—"}
          </span>
        ),
      },
      {
        id: "totalPrize",
        accessorKey: "totalPrize",
        header: ({ column }) => (
          <SortableHeader column={column} title="Prize" />
        ),
        size: 100,
        maxSize: 120,
        cell: ({ row }) => {
          const prize = row.original.totalPrize;
          if (!prize) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <Trophy className="h-3 w-3 shrink-0" />
              <span className="truncate">{prize}</span>
            </span>
          );
        },
      },
      {
        id: "entryFee",
        accessorKey: "entryFee",
        header: "Fee",
        size: 80,
        maxSize: 100,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground truncate">
            {row.original.entryFee || "—"}
          </span>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: events,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex-1 rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Tournament</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Rds</TableHead>
              <TableHead>Prize</TableHead>
              <TableHead>Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 15 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-md border">
        <div className="text-center py-12">
          <p className="font-medium">No tournaments found</p>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 rounded-md border overflow-hidden flex flex-col min-h-0">
      <div className="overflow-auto flex-1">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onEventClick(row.original)}
                className="cursor-pointer h-10"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortableHeader({ column, title }: { column: any; title: string }) {
  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{title}</span>
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );
}

function StatusDot({ status, days }: { status: "upcoming" | "ongoing" | "past"; days: number }) {
  if (status === "ongoing") {
    return (
      <span className="relative flex h-2 w-2 shrink-0" title="Live now">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
    );
  }
  if (status === "upcoming" && days <= 7) {
    return <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title={`In ${days} days`} />;
  }
  if (status === "upcoming") {
    return <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" title={`In ${days} days`} />;
  }
  return <span className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" title="Completed" />;
}
