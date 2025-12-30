export function tryParseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  if (typeof value !== "string") return value as T;
  
  try {
    if (value.startsWith("{") || value.startsWith("[")) {
      return JSON.parse(value) as T;
    }
  } catch {
    // Not JSON, return null
  }
  return null;
}

export interface ContactInfo {
  phone?: string[];
  email?: string | null;
  whatsapp?: string | null;
}

export interface PrizeBreakdown {
  [category: string]: {
    [position: string]: string;
  };
}

export function parseContact(value: string | null | undefined): ContactInfo | string | null {
  if (!value) return null;
  const parsed = tryParseJson<ContactInfo>(value);
  if (parsed) return parsed;
  return value;
}

export function parsePrizeBreakdown(value: string | null | undefined): PrizeBreakdown | string | null {
  if (!value) return null;
  const parsed = tryParseJson<PrizeBreakdown>(value);
  if (parsed) return parsed;
  return value;
}
