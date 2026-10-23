import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom type scale so `text-small text-muted` keeps both (size vs colour).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["label", "small", "ui", "body", "body-lg", "h3", "h2", "stat", "h1", "display"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function mapsEmbedUrl(q: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}
export function mapsOpenUrl(q: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
