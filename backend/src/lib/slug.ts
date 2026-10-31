/** Longest slug we store or serve. */
export const MAX_SLUG_LENGTH = 80;

/**
 * Lowercase ASCII slug from free text: accents stripped, every run of
 * non-alphanumerics becomes one hyphen, no leading or trailing hyphen.
 * Capped at `max` characters, cut at a hyphen when one is available.
 * Returns "" when nothing ASCII is left (e.g. a name in Devanagari).
 */
export function slugify(text: string, max = MAX_SLUG_LENGTH): string {
  const base = text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return capSlug(base, max);
}

/** Truncate to `max` characters at the last hyphen that fits (hard cut if there is none). */
export function capSlug(slug: string, max: number): string {
  if (slug.length <= max) return slug;
  const cut = slug.slice(0, max);
  const dash = cut.lastIndexOf("-");
  return (dash > 0 ? cut.slice(0, dash) : cut).replace(/-+$/, "");
}

/**
 * Choose a unique slug for an event. The bare name wins when free; otherwise
 * "<name>-<year>", then "<name>-<year>-2", "-3", ... `isTaken` says whether a
 * candidate is already used by another event.
 */
export function pickEventSlug(name: string, startDate: string, isTaken: (slug: string) => boolean): string {
  const base = slugify(name) || "event";
  if (!isTaken(base)) return base;
  const year = startDate.slice(0, 4);
  const withYear = (suffix: string) => {
    const tail = `-${year}${suffix}`;
    return `${capSlug(base, MAX_SLUG_LENGTH - tail.length)}${tail}`;
  };
  const dated = withYear("");
  if (!isTaken(dated)) return dated;
  for (let n = 2; ; n++) {
    const candidate = withYear(`-${n}`);
    if (!isTaken(candidate)) return candidate;
  }
}
