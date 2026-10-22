// Generates brochure.schema.json (for `agy --json-schema`) from a compact spec that mirrors schema.ts.
// Run: npx tsx src/extraction/gen-schema.ts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const S = { type: ["string", "null"] };
const D = { type: ["string", "null"], description: "YYYY-MM-DD" };
const INR = { type: ["integer", "null"], minimum: 0, description: "Whole rupees as an integer (lakh notation converted); null if unknown" };
const N = { type: ["number", "null"], minimum: 0 };
const o = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const a = (items: unknown) => ({ type: "array", items });

const schema = o({
  summary: S,
  tagline: { type: ["string", "null"], description: "One line, max 120 chars" },
  venue: o({ name: S, address: S, city: S, state: S, pincode: S, mapQuery: S }),
  timeControl: o({
    type: { type: ["string", "null"], enum: ["Classical", "Rapid", "Blitz", "Mixed"] },
    baseMinutes: N,
    incrementSeconds: N,
    raw: S,
  }),
  rounds: { type: ["integer", "null"], minimum: 1 },
  fideRated: { type: ["boolean", "null"] },
  format: S,
  prizes: o({
    totalInr: INR,
    places: a(o({ label: { type: "string" }, amountInr: INR, extra: S })),
    categoryPrizes: a(o({ category: { type: "string" }, label: { type: "string" }, amountInr: INR })),
    notes: S,
  }),
  entryFees: a(o({ category: { type: "string" }, amountInr: INR })),
  categories: o({ rating: a({ type: "string" }), age: a({ type: "string" }) }),
  eligibility: S,
  registration: o({ link: S, deadline: D, notes: S }),
  organizer: S,
  chiefArbiter: S,
  contacts: a(o({ name: S, role: S, phone: S, email: S })),
  accommodation: S,
  schedule: a(o({ date: D, time: S, item: { type: "string" } })),
});

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "brochure.schema.json"), JSON.stringify(schema, null, 2) + "\n");
console.log("wrote brochure.schema.json");
