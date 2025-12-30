import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (start === end) {
    return formatDate(start);
  }

  const startMonth = startDate.toLocaleDateString("en-IN", { month: "short" });
  const endMonth = endDate.toLocaleDateString("en-IN", { month: "short" });

  if (startMonth === endMonth && startDate.getFullYear() === endDate.getFullYear()) {
    return `${startDate.getDate()} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()}`;
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

export function getEventStatus(startDate: string, endDate: string): "upcoming" | "ongoing" | "past" {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return "upcoming";
  if (now > end) return "past";
  return "ongoing";
}

export function getGoogleMapsUrl(query: string | null): string | null {
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
