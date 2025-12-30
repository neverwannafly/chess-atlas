import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilters } from "@/hooks/useEvents";
import type { EventFilters } from "@/types/event";
import { cn } from "@/lib/utils";

interface FiltersProps {
  filters: EventFilters;
  onChange: (filters: EventFilters) => void;
}

const statusOptions = [
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Live" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

const timeControlOptions = [
  { value: "all", label: "All Formats" },
  { value: "Classical", label: "Classical" },
  { value: "Rapid", label: "Rapid" },
  { value: "Blitz", label: "Blitz" },
];

export function Filters({ filters, onChange }: FiltersProps) {
  const { data: filterOptions } = useFilters();

  const updateFilter = (key: keyof EventFilters, value: string) => {
    onChange({ ...filters, [key]: value === "all" ? undefined : value || undefined });
  };

  const clearFilters = () => {
    onChange({ status: "upcoming" });
  };

  const hasActiveFilters = Boolean(
    filters.state || filters.city || filters.timeControlType || filters.search
  );

  return (
    <div className="flex flex-wrap items-center gap-2 py-3 border-b">
      {/* Status Toggle */}
      <div className="flex items-center rounded-md border bg-muted p-0.5">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateFilter("status", opt.value)}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-sm transition-colors",
              filters.status === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Time Control */}
      <Select
        value={filters.timeControlType || "all"}
        onValueChange={(v) => updateFilter("timeControlType", v)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Format" />
        </SelectTrigger>
        <SelectContent>
          {timeControlOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* State */}
      <Select
        value={filters.state || "all"}
        onValueChange={(v) => updateFilter("state", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="State" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          {(filterOptions?.states ?? []).map((state) => (
            <SelectItem key={state} value={state}>
              {state}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* City */}
      <Select
        value={filters.city || "all"}
        onValueChange={(v) => updateFilter("city", v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cities</SelectItem>
          {(filterOptions?.cities ?? []).map((city) => (
            <SelectItem key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-6 w-px bg-border" />

      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tournaments..."
          value={filters.search ?? ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="h-8 pl-8"
        />
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
