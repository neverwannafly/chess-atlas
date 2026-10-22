export interface IcsEvent {
  uid: string;
  summary: string;
  startDate: string; // YYYY-MM-DD
  endDateExclusive: string; // YYYY-MM-DD
  location?: string;
  description?: string;
  url?: string;
  stamp?: string; // ISO
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const d8 = (d: string) => d.replace(/-/g, "");

/** Fold to 75 octets per RFC 5545, never splitting a UTF-8 character. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > limit) {
      out.push(cur);
      cur = " ";
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n");
}

export function buildIcs(e: IcsEvent): string {
  const stamp = new Date(e.stamp ?? Date.now());
  const dtstamp = (isNaN(stamp.getTime()) ? new Date() : stamp).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chess Atlas//Tournaments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${d8(e.startDate)}`,
    `DTEND;VALUE=DATE:${d8(e.endDateExclusive)}`,
    `SUMMARY:${esc(e.summary)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
