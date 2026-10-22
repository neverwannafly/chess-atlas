// Dev-only fixtures (VITE_MOCK=1). Dates are relative to "today" so the UI always looks alive.
import type { BrochureExtraction, EventDetail, TimeControlType } from "@/types/event";
import { addDays, todayIST } from "@/lib/format";

type Row = [
  code: string, name: string, city: string, state: string,
  offset: number, len: number, tc: TimeControlType, rounds: number,
  fide: boolean, prize: number | null, fee: number | null, extracted: boolean,
];

const ROWS: Row[] = [
  ["MH-26-001", "Mumbai International Open Chess Championship 2026", "Mumbai", "Maharashtra", 9, 5, "Classical", 9, true, 1250000, 1500, true],
  ["KA-26-002", "Bengaluru Rapid Rating Chess Tournament", "Bengaluru", "Karnataka", 3, 1, "Rapid", 9, false, 250000, 800, true],
  ["TN-26-003", "Chennai Grandmasters Invitational", "Chennai", "Tamil Nadu", -1, 4, "Classical", 9, true, 5000000, 2500, true],
  ["WB-26-004", "Kolkata Rapid & Blitz Festival", "Kolkata", "West Bengal", 15, 2, "Mixed", 11, false, 400000, 700, false],
  ["DL-26-005", "Delhi State Open Under-19 Championship", "New Delhi", "Delhi", 1, 3, "Classical", 7, true, 150000, 1000, true],
  ["GJ-26-006", "Ahmedabad Blitz Brigade", "Ahmedabad", "Gujarat", 6, 1, "Blitz", 13, false, 75000, 500, true],
  ["RJ-26-007", "Jaipur Pink City Open", "Jaipur", "Rajasthan", 24, 3, "Classical", 8, true, 600000, 1200, false],
  ["KL-26-008", "Kerala Open Rating Tournament", "Kochi", "Kerala", 18, 3, "Classical", 9, true, 900000, 1500, true],
  ["TG-26-009", "Hyderabad Biryani Blitz Cup", "Hyderabad", "Telangana", 4, 1, "Blitz", 11, false, 60000, 400, true],
  ["MH-26-010", "Pune Junior Rapid Under-13", "Pune", "Maharashtra", 12, 1, "Rapid", 7, false, 40000, 300, false],
  ["UP-26-011", "Lucknow Nawabi Open", "Lucknow", "Uttar Pradesh", 33, 4, "Classical", 9, true, 750000, 1000, false],
  ["PB-26-012", "Chandigarh Tricity Rapid", "Chandigarh", "Chandigarh", 2, 1, "Rapid", 8, false, 120000, 600, true],
  ["OD-26-013", "Odisha State Open Chess Championship", "Bhubaneswar", "Odisha", 40, 5, "Classical", 9, true, 300000, 800, false],
  ["AS-26-014", "Guwahati Brahmaputra Open", "Guwahati", "Assam", 55, 4, "Classical", 9, true, 500000, 900, false],
  ["MP-26-015", "Indore Poha Rapid Challenge", "Indore", "Madhya Pradesh", 8, 2, "Rapid", 9, false, 200000, 700, true],
  ["GA-26-016", "Goa International Open", "Panaji", "Goa", 27, 6, "Classical", 9, true, 2100000, 2000, true],
  ["KA-26-017", "Mysuru Dasara Rapid", "Mysuru", "Karnataka", -2, 3, "Rapid", 9, false, 180000, 600, true],
  ["TN-26-018", "Coimbatore District Open", "Coimbatore", "Tamil Nadu", 21, 2, "Classical", 7, false, 100000, 500, false],
  ["TN-26-019", "Madurai Meenakshi Open", "Madurai", "Tamil Nadu", 45, 3, "Classical", 9, true, 350000, 800, false],
  ["WB-26-020", "Siliguri Himalayan Open", "Siliguri", "West Bengal", 30, 3, "Classical", 9, true, 450000, 1000, false],
  ["HR-26-021", "Gurugram Corporate Blitz Championship", "Gurugram", "Haryana", 5, 1, "Blitz", 11, false, 90000, 1200, true],
  ["MH-26-022", "Nagpur Orange City Open", "Nagpur", "Maharashtra", 62, 4, "Classical", 9, true, 400000, 900, false],
  ["BR-26-023", "Patna Bihar State Open", "Patna", "Bihar", 70, 3, "Classical", 9, false, null, null, false],
  ["TN-26-024", "Tamil Nadu State Chess Championship", "Chennai", "Tamil Nadu", -30, 5, "Classical", 9, true, 800000, 1000, true],
  ["KA-26-025", "Mangaluru Coastal Rapid", "Mangaluru", "Karnataka", -45, 2, "Rapid", 9, false, 150000, 500, true],
  ["DL-26-026", "Delhi International Grandmaster Open", "New Delhi", "Delhi", 80, 8, "Classical", 9, true, 3500000, 3000, false],
  ["UK-26-027", "Dehradun Doon Valley Open", "Dehradun", "Uttarakhand", 14, 2, "Classical", 7, true, 250000, 800, false],
  ["MH-26-028", "Thane Women's Rapid Open", "Thane", "Maharashtra", 7, 1, "Rapid", 7, false, 80000, 300, true],
  ["KL-26-029", "Thrissur Pooram Blitz", "Thrissur", "Kerala", 36, 1, "Blitz", 11, false, 50000, 350, false],
  ["TS-26-030", "Warangal Kakatiya Open", "Warangal", "Telangana", 50, 3, "Classical", 9, true, 550000, 1000, false],
];

const MAPS: Record<string, string> = {};

function details(r: Row, start: string, end: string): BrochureExtraction {
  const [, name, city, state, , , tc, rounds, fide, prize, fee] = r;
  const total = prize ?? 0;
  const tcRaw = tc === "Classical" ? "90 min + 30 sec increment from move 1" : tc === "Rapid" ? "15 min + 10 sec increment" : tc === "Blitz" ? "3 min + 2 sec increment" : "Rapid 15+10, Blitz 3+2";
  const venue = `${city} Chess Hall, MG Road`;
  MAPS[r[0]] = `${venue}, ${city}, ${state}`;
  const days = Math.max(1, daysOf(start, end));
  const sched: BrochureExtraction["schedule"] = [{ date: start, time: "09:00", item: "Reporting and registration" }, { date: start, time: "10:30", item: "Opening ceremony" }];
  for (let i = 0; i < Math.min(rounds, days * 3); i++) {
    sched.push({ date: addDays(start, Math.floor(i / 3)), time: ["11:00", "14:30", "17:00"][i % 3], item: `Round ${i + 1}` });
  }
  sched.push({ date: end, time: "18:30", item: "Prize distribution" });
  return {
    summary: `${name} is a ${rounds}-round ${tc.toLowerCase()} Swiss-system event in ${city}, ${state}. ${fide ? "The tournament is FIDE rated and counts towards rating norms." : "The event is AICF-affiliated and open to all registered players."}\n\nPlay takes place at a central, easy-to-reach hall with analysis rooms and a food court on site. Spot entries are accepted subject to availability.`,
    tagline: `${rounds} rounds. ${total ? "₹" + (total / 100000).toFixed(1) + "L in prizes." : "Open to all."} ${city} awaits.`,
    venue: { name: venue, address: `${venue}, near Central Station`, city, state, pincode: "400001", mapQuery: MAPS[r[0]] },
    timeControl: { type: tc, baseMinutes: tc === "Classical" ? 90 : tc === "Rapid" ? 15 : 3, incrementSeconds: tc === "Classical" ? 30 : tc === "Rapid" ? 10 : 2, raw: tcRaw },
    rounds, fideRated: fide, format: "Swiss",
    prizes: {
      totalInr: prize,
      places: total ? [
        { label: "1st", amountInr: Math.round(total * 0.2), extra: "Trophy" },
        { label: "2nd", amountInr: Math.round(total * 0.12), extra: "Trophy" },
        { label: "3rd", amountInr: Math.round(total * 0.08), extra: "Trophy" },
        { label: "4th–10th", amountInr: Math.round(total * 0.03), extra: null },
      ] : [],
      categoryPrizes: total ? [
        { category: "Best Woman", label: "1st", amountInr: Math.round(total * 0.02) },
        { category: "Under 1600", label: "1st", amountInr: Math.round(total * 0.015) },
        { category: "Veteran 60+", label: "1st", amountInr: Math.round(total * 0.01) },
      ] : [],
      notes: "Prizes subject to tax deduction as applicable. No shared prizes in top 3 places.",
    },
    entryFees: fee != null ? [
      { category: "Open", amountInr: fee },
      { category: "Women / Juniors (U-15)", amountInr: Math.round(fee * 0.7) },
      { category: "Spot entry", amountInr: Math.round(fee * 1.5) },
    ] : [],
    categories: { rating: ["Open", "Under 1800", "Under 1600", "Unrated"], age: ["U-9", "U-13", "U-19", "Senior 60+"] },
    eligibility: "Open to all players holding a valid AICF/State Association ID. Foreign players need a FIDE ID and federation clearance.",
    registration: {
      link: "https://example.com/register",
      deadline: addDays(start, -3),
      notes: "Online registration closes 3 days before the start. Limited to 400 players.",
    },
    organizer: `${city} District Chess Association`,
    chiefArbiter: "IA Rajesh Kumar",
    contacts: [
      { name: "Anil Sharma", role: "Organizing Secretary", phone: "+91 98765 43210", email: "anil@example.com" },
      { name: "Meera Iyer", role: "Tournament Director", phone: "022-2345 6789", email: null },
    ],
    accommodation: "Tie-up hotels within 500 m of the venue from ₹1,500 per night. Contact the organizers for booking.",
    schedule: sched,
  };
}

function daysOf(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
}

export function buildFixtures(): EventDetail[] {
  const today = todayIST();
  return ROWS.map((r, i): EventDetail => {
    const [code, name, city, state, off, len, tc, rounds, fide, prize, , ex] = r;
    const startDate = addDays(today, off);
    const endDate = addDays(startDate, len - 1);
    const status = endDate < today ? "past" : startDate <= today ? "ongoing" : "upcoming";
    const d = ex ? details(r, startDate, endDate) : null;
    const hasBrochure = i % 11 !== 10;
    return {
      eventCode: code, name, startDate, endDate, city, state, status,
      brochureUrl: hasBrochure ? "https://example.com/brochure.pdf" : null,
      extractionStatus: ex ? "done" : hasBrochure ? (i % 5 === 0 ? "failed" : "pending") : "no_brochure",
      tagline: d?.tagline ?? null,
      timeControlType: ex ? tc : null,
      rounds: ex ? rounds : null,
      fideRated: ex ? fide : null,
      totalPrizeInr: ex ? prize : null,
      entryFeeMinInr: ex && d?.entryFees.length ? Math.min(...d.entryFees.map((e) => e.amountInr ?? Infinity)) : null,
      registrationDeadline: d?.registration.deadline ?? null,
      venueName: d?.venue.name ?? null,
      details: d,
      extractedAt: ex ? `${today}T06:00:00Z` : null,
      extractionModel: ex ? "mock" : null,
      aicfUrl: `https://aicf.in/event/${code}`,
      createdAt: `${today}T00:00:00Z`,
      updatedAt: `${today}T00:00:00Z`,
    };
  });
}
