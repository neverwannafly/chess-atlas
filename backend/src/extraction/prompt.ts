export const MAX_TEXT_CHARS = 60_000;

const RULES = `You extract structured data from an Indian chess tournament brochure (prospectus) for a public tournament directory. Return ONLY the JSON object required by the schema.

GROUND RULES
- Use ONLY information stated in the brochure. Never invent, guess or infer values that are not written. If something is absent or unclear, use null (or [] for lists).
- Do not use tools, do not browse the web, do not write files. Everything you need is provided.
- Strings: concise, plain text, no markdown, no emojis. Keep names, phone numbers and e-mails exactly as written.
- Dates: YYYY-MM-DD. If the year is missing, use the year of the tournament dates given in the context line. Date ranges: use the individual day for each schedule row.

MONEY (all amounts are integer Indian rupees, no decimals, no symbols)
- Indian lakh notation: 1,00,000 = 100000; 4,50,000 = 450000; "1 lakh" / "1 lac" = 100000; "2.5 lakh" = 250000; "1 crore" = 10000000; "50K" = 50000.
- Strip "Rs.", "INR", "₹", "/-" and commas. Prizes given in other currency or as trophies/medals only: amountInr = null and describe in "extra" or "notes".
- prizes.totalInr: ONLY the total prize fund if the brochure states it ("total prize fund Rs. 5 Lakh"). Otherwise null (do not sum yourself).
- A prize of "Trophy + Rs. 5000" has amountInr 5000 and extra "Trophy".

FIELD GUIDANCE
- summary: 2-3 short factual paragraphs (separated by a blank line) for a player deciding whether to attend: what/where/when, format and time control, prizes and fees, who can play. Neutral tone; NO hype words (grand, prestigious, thrilling, exciting, amazing...). Only facts from the brochure.
- tagline: one factual line, at most 110 characters, e.g. "FIDE-rated rapid open in Pune, 18-19 April 2026, Rs 5 lakh prize fund".
- venue: name, full address, city, state (full official name, e.g. "Maharashtra"), 6-digit pincode if written. mapQuery: a string a person could paste in Google Maps to find the venue (venue name + city + state); null if no venue name or address.
- timeControl.raw: copy as written. baseMinutes: starting time per player in minutes for the main event (e.g. 90 min + 30 sec increment => 90 and 30; "15 min + 10 sec" => 15, 10; "3+2" => 3, 2). incrementSeconds in seconds, 0 if explicitly "no increment", null if not stated.
- timeControl.type: if NO time control is stated anywhere, set type, baseMinutes, incrementSeconds and raw ALL to null (do not guess from the event name). Otherwise by base minutes: >= 60 Classical; 10-59 Rapid; < 10 Blitz. Use "Mixed" if the brochure has sections with different time controls (e.g. rapid and blitz in the same event, or classical + rapid). If the brochure itself says rapid/blitz/classical clearly, agree with it unless the numbers contradict.
- rounds: number of rounds of the main event (integer). If several sections list different counts, use the main/open section.
- fideRated: true if the brochure says it is FIDE rated (FIDE rating tournament, FIDE ID required, FIDE rating will be calculated). false if it explicitly says unrated/not rated. null if not stated.
- format: e.g. "Swiss", "Swiss System", "Round robin", "Knockout". null if not stated.
- prizes.places: main standings prizes in order: label ("1st", "2nd", ...) and amountInr. If the brochure has separate sections (Open / Below 1600 / Girls), include only the main open section here and put the others in categoryPrizes with the section as category. If prizes are for rank ranges ("11th-20th: Rs 2000 each") use label "11th-20th".
- prizes.categoryPrizes: every special/side prize: rating bands (Below 1600, U-1800, Unrated), age groups (U-7, U-9, U-11...), Best Woman / Girls, Best Veteran / Senior, Best Local / State player, etc. category = the group name, label = the place ("1st", "Best Player", "2nd"), amountInr = amount. One entry per prize.
- prizes.notes: only noteworthy prize rules (tie-break rules, TDS, cash vs trophy, GST).
- entryFees: one entry per fee category as written (e.g. "General", "FIDE rated < 1600", "Early bird", "Spot entry", "Under 15", "GM/IM/WGM free" with amountInr 0 only if explicitly free). Unknown amount => null, never 0.
- categories.rating: rating bands or sections as written (e.g. "Open", "Below 1600", "Unrated"). categories.age: age groups (e.g. "U-7", "U-9", "U-13", "Senior 50+").
- eligibility: short sentence on who may play and requirements (FIDE ID, state/age/gender limits, AICF registration).
- registration.link: URL (online form, Google Form, Chess-results, etc.) copied exactly; null if none. deadline: last date to register as YYYY-MM-DD. notes: how to register / payment details summarized (do NOT include bank account numbers).
- organizer: organising body/club/academy name. chiefArbiter: name of the person labelled Chief Arbiter ONLY (give the name without IA/FA prefixes). If only a Tournament Director is named, leave null and list them in contacts instead.
- contacts: people to contact with name, role, phone, e-mail; each distinct person once.
- accommodation: short note on hotels/stay arrangement if mentioned; null otherwise.
- schedule: reporting/registration, opening ceremony, each round with date and time (24h "HH:MM" if clear, else as written), closing/prize distribution. date may be null if not given; item is required.
`;

export interface PromptContext {
  name?: string;
  startDate?: string;
  endDate?: string;
  /** Other directory events that share this brochure (festival sections). */
  siblings?: { name: string; startDate: string; endDate: string }[];
}

function sharedBrochureRules(ctx: PromptContext): string {
  const others = (ctx.siblings ?? []).map((s) => `- ${s.name} (${s.startDate} to ${s.endDate})`).join("\n");
  return `SHARED BROCHURE
This brochure covers several separate events (sections) that the directory lists individually. The other events using this same brochure are:
${others}
Extract ONLY the target event: "${ctx.name}" (${ctx.startDate}${ctx.endDate ? ` to ${ctx.endDate}` : ""}). Find its section by category letter, rating limit, format (rapid/blitz/classical) or dates, and take from that section only: dates and schedule, time control, rounds, eligibility, entry fees, prize fund and prizes, rating/age categories, registration deadline.
- timeControl.type describes the target event alone; do not use "Mixed" just because other sections have a different time control.
- prizes.totalInr: the target section's own total if stated. Use a festival-wide total only if the brochure gives no per-section total, and then say so in prizes.notes.
- Information common to all sections (venue, organiser, chief arbiter, contacts, accommodation, registration link) may be used.
- summary and tagline describe the target event; you may mention in one sentence that it is part of a larger festival.
`;
}

export function buildPrompt(text: string | null, ctx: PromptContext = {}, opts: { pdfFile?: string; errors?: string } = {}): string {
  const lines = [RULES];
  const known: string[] = [];
  if (ctx.name) known.push(`Event name (from directory listing): ${ctx.name}`);
  if (ctx.startDate) known.push(`Event start date (from directory listing): ${ctx.startDate}`);
  if (ctx.endDate) known.push(`Event end date (from directory listing): ${ctx.endDate}`);
  if (known.length) lines.push("CONTEXT\n" + known.join("\n") + "\n");
  if (ctx.siblings?.length) lines.push(sharedBrochureRules(ctx));

  if (opts.pdfFile) {
    lines.push(
      `SOURCE\nThe brochure is the PDF file ./${opts.pdfFile} in the current directory. It is a scanned/image PDF without a text layer: read it by viewing every page (OCR it). Read ALL pages, then answer. This single file read is the only tool use allowed.\n`,
    );
  } else {
    let t = text ?? "";
    if (t.length > MAX_TEXT_CHARS) t = t.slice(0, MAX_TEXT_CHARS) + "\n[... brochure truncated ...]";
    lines.push(`BROCHURE TEXT (extracted from PDF; layout may be garbled, tables flattened)\n<<<BROCHURE\n${t}\nBROCHURE>>>\n`);
  }
  if (opts.errors) {
    lines.push(`YOUR PREVIOUS ANSWER FAILED VALIDATION. Fix these problems and answer again:\n${opts.errors}\n`);
  }
  lines.push("Now return the JSON object.");
  return lines.join("\n");
}
