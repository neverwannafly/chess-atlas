import { CITY_STATES, lookupCity, lookupState } from "../data/places.js";

export interface ParsedPlace {
  city: string | null;
  state: string | null;
}

function tidy(s: string): string {
  let t = s
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(dt|dist|district)\b\.?$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.\-–]+|[\s.\-–]+$/g, "")
    .trim();
  // Title-case shouty names ("PUNE" -> "Pune")
  if (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
    t = t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  }
  return t;
}

function splitParts(raw: string): string[] {
  const out: string[] = [];
  for (const p of raw.split(/[,;|\n\/]+/).map(tidy).filter(Boolean)) {
    // "Virudhachalam.Cuddalore" -> two parts, unless the whole part is known ("U.P.")
    if (/[A-Za-z]\.[A-Za-z]{2,}/.test(p) && !lookupState(p) && !lookupCity(p)) {
      out.push(...p.split(".").map(tidy).filter(Boolean));
    } else out.push(p);
  }
  return out;
}

function cityOf(part: string) {
  const direct = lookupCity(part);
  if (direct) return direct;
  // "Thane West" / "North Chennai"
  const stripped = part.replace(/\b(north|south|east|west|central)\b/gi, " ").replace(/\s+/g, " ").trim();
  return stripped && stripped !== part ? lookupCity(stripped) : null;
}

/** Split a free-text AICF "place" into a canonical city + state. */
export function parsePlace(raw: string | null | undefined): ParsedPlace {
  if (!raw) return { city: null, state: null };
  const parts = splitParts(raw);
  if (parts.length === 0) return { city: null, state: null };

  // State: the last part that resolves to a state.
  let state: string | null = null;
  let stateIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    const s = lookupState(parts[i]);
    if (s) {
      state = s;
      stateIdx = i;
      break;
    }
  }
  const rest = parts.filter((_, i) => i !== stateIdx);

  // City: the first known city among remaining parts, else the first remaining part.
  let city: string | null = null;
  let cityState: string | null = null;
  for (const p of rest) {
    const c = cityOf(p);
    if (c) {
      city = c.canonical;
      cityState = c.state;
      break;
    }
  }
  if (!city && rest.length) city = rest[0];

  // "New Delhi"/"Delhi" resolve as a state alias but are also the city.
  if (!city && state && CITY_STATES.has(state) && stateIdx >= 0) city = state;
  if (!city && stateIdx === -1 && rest.length === 0) return { city: null, state };

  if (!state && cityState) state = cityState;
  return { city, state };
}
