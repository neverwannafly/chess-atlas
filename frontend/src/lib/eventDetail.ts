import type { BrochureExtraction, EventSummary } from "@/types/event";

export function hasPrizes(p: BrochureExtraction["prizes"]) {
  return (p.totalInr != null && p.totalInr > 0) || p.places.length > 0 || p.categoryPrizes.length > 0;
}

export function groupCategoryPrizes(list: BrochureExtraction["prizes"]["categoryPrizes"]) {
  const groups: { category: string; items: { label: string; amountInr: number | null }[]; total: number }[] = [];
  for (const c of list) {
    let g = groups.find((x) => x.category === c.category);
    if (!g) groups.push((g = { category: c.category, items: [], total: 0 }));
    g.items.push({ label: c.label, amountInr: c.amountInr });
    g.total += c.amountInr ?? 0;
  }
  return groups;
}

export function groupSchedule(items: BrochureExtraction["schedule"]) {
  const groups: { date: string | null; rows: BrochureExtraction["schedule"] }[] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && g.date === it.date) g.rows.push(it);
    else groups.push({ date: it.date, rows: [it] });
  }
  return groups;
}

export function venueQuery(e: Pick<EventSummary, "city" | "state" | "venueName">, d: BrochureExtraction | null) {
  return d?.venue.mapQuery ?? ([d?.venue.name ?? e.venueName, d?.venue.address, e.city, e.state].filter(Boolean).join(", ") || null);
}
