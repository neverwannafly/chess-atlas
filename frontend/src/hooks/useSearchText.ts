import { useEffect, useState } from "react";
import { useFilters } from "@/lib/filters";

/**
 * Search text with a local, keystroke-exact value and a short debounce into the URL (`?q=`).
 * External URL changes (Back, Clear all, another field) flow back into the input.
 */
export function useSearchText(delay = 120) {
  const { filters, update } = useFilters();
  const [text, setText] = useState(filters.q);
  const [seen, setSeen] = useState(filters.q);
  if (seen !== filters.q) {
    setSeen(filters.q);
    if (text.trim() !== filters.q.trim()) setText(filters.q);
  }
  useEffect(() => {
    if (text === filters.q) return;
    const t = setTimeout(() => update({ q: text }), text ? delay : 0);
    return () => clearTimeout(t);
  }, [text, filters.q, update, delay]);
  return [text, setText] as const;
}
