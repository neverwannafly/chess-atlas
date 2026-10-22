import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mapsEmbedUrl(q: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}
export function mapsOpenUrl(q: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
