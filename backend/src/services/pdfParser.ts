import OpenAI from "openai";
import pdfParse from "pdf-parse";
import type { ParsedPdfData } from "../types/event.js";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required for PDF parsing");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function parsePdfWithLLM(pdfUrl: string): Promise<ParsedPdfData | null> {
  let text: string;

  try {
    const response = await fetch(pdfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ChessAtlas/1.0)",
      },
    });

    if (!response.ok) {
      console.error(`    HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("pdf")) {
      console.error(`    Not a PDF: ${contentType}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      console.error(`    PDF too small: ${buffer.length} bytes`);
      return null;
    }

    const pdfData = await pdfParse(buffer, {
      max: 0,
    });

    text = pdfData.text?.trim() || "";

    if (text.length < 100) {
      console.error(`    PDF text too short: ${text.length} chars`);
      return null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("TT:")) {
      console.error(`    PDF parse error: ${msg.slice(0, 100)}`);
    }
    return null;
  }

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting structured data from chess tournament brochures/prospectuses.

Extract ALL available information and return as JSON with these fields:

- summary: A well-written 2-3 paragraph summary of the tournament covering key highlights, who should participate, what makes it special, prizes, and practical info. Write it engagingly for chess players considering attending.
- description: Brief one-line tournament description
- venueDetails: Venue name (hotel, hall, club name)
- venueAddress: Full address with city, state, pincode
- venueMapQuery: A Google Maps search query that would find this exact venue (e.g., "Hotel Grand Palace, MG Road, Bengaluru, Karnataka 560001")
- timeControlDetails: Exact time control (e.g., "90 min + 30 sec increment", "15 min + 10 sec", "3 min + 2 sec")
- timeControlType: One of "Classical", "Rapid", or "Blitz" based on the time control
- rounds: Number of rounds (integer)
- totalPrize: Total prize pool amount
- prizeBreakdown: Full prize distribution details
- entryFee: Basic entry fee
- entryFeeBreakdown: Fee by category/rating (e.g., "GM/IM: Free, Above 2000: ₹1000...")
- ratingCategories: Rating-based categories (e.g., "Open, Below 1800, Below 1600, Unrated")
- ageCategories: Age-based categories if any (e.g., "Under 7, Under 9, Under 11...")
- eligibility: Who can participate, nationality requirements, rating requirements
- registrationLink: Online registration URL if mentioned
- registrationDeadline: Last date to register
- organizer: Organizing body/person name
- arbiter: Chief arbiter name
- contact: Phone numbers, email, WhatsApp
- accommodation: Hotel/accommodation details if provided
- schedule: Tournament schedule/round timings

Return null for any field you cannot find. Return ONLY valid JSON, no markdown or explanation.`,
        },
        {
          role: "user",
          content: `Extract tournament details from this brochure:\n\n${text}`,
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error(`    Empty LLM response`);
      return null;
    }

    const parsed = JSON.parse(content) as ParsedPdfData;
    return parsed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    LLM error: ${msg.slice(0, 100)}`);
    return null;
  }
}
