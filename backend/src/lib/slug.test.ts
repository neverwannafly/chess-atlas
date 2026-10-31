import test from "node:test";
import assert from "node:assert/strict";
import { MAX_SLUG_LENGTH, capSlug, pickEventSlug, slugify } from "../lib/slug.js";

test("slugify lowercases and joins words with single hyphens", () => {
  assert.equal(slugify("8th SHAASTRA Rapid FIDE Rated Chess Tournament 2026"), "8th-shaastra-rapid-fide-rated-chess-tournament-2026");
});

test("slugify strips accents", () => {
  assert.equal(slugify("Café Déjà Vu Open"), "cafe-deja-vu-open");
  assert.equal(slugify("Ñandú Chess Ça Va"), "nandu-chess-ca-va");
});

test("slugify turns punctuation and runs of symbols into one hyphen", () => {
  assert.equal(slugify("U-11 (Boys) / Girls -- Open!!"), "u-11-boys-girls-open");
  assert.equal(slugify("  --Rs. 5,00,000 prize--  "), "rs-5-00-000-prize");
  assert.equal(slugify("A&B   C_D"), "a-b-c-d");
});

test("slugify returns empty for text with no ASCII letters or digits", () => {
  assert.equal(slugify("शतरंज प्रतियोगिता"), "");
  assert.equal(slugify("!!!"), "");
});

test("slugify caps length at a word boundary", () => {
  const name = "word ".repeat(30).trim();
  const s = slugify(name);
  assert.ok(s.length <= MAX_SLUG_LENGTH);
  assert.ok(!s.endsWith("-"));
  assert.ok(name.replace(/ /g, "-").startsWith(s));
  assert.equal(s, "word-".repeat(15) + "word");
});

test("slugify hard-cuts a single word longer than the cap", () => {
  const s = slugify("a".repeat(120));
  assert.equal(s.length, MAX_SLUG_LENGTH);
});

test("capSlug keeps short slugs and trims hyphens left by the cut", () => {
  assert.equal(capSlug("abc-def", 10), "abc-def");
  assert.equal(capSlug("abc-def-ghi", 8), "abc-def");
  assert.equal(capSlug("abc-def-ghi", 7), "abc");
});

test("pickEventSlug uses the bare name when free", () => {
  assert.equal(pickEventSlug("Delhi Open", "2026-04-01", () => false), "delhi-open");
});

test("pickEventSlug appends the start year on a collision", () => {
  const taken = new Set(["delhi-open"]);
  assert.equal(pickEventSlug("Delhi Open", "2026-04-01", (s) => taken.has(s)), "delhi-open-2026");
});

test("pickEventSlug numbers further collisions", () => {
  const taken = new Set(["delhi-open", "delhi-open-2026"]);
  assert.equal(pickEventSlug("Delhi Open", "2026-04-01", (s) => taken.has(s)), "delhi-open-2026-2");
  taken.add("delhi-open-2026-2");
  assert.equal(pickEventSlug("Delhi Open", "2026-04-01", (s) => taken.has(s)), "delhi-open-2026-3");
});

test("pickEventSlug keeps the year suffix within the length cap", () => {
  const name = "word ".repeat(30).trim();
  const bare = slugify(name);
  const taken = new Set([bare]);
  const s = pickEventSlug(name, "2026-04-01", (x) => taken.has(x));
  assert.ok(s.length <= MAX_SLUG_LENGTH);
  assert.ok(s.endsWith("-2026"));
  assert.ok(s.startsWith("word-"));
});

test("pickEventSlug falls back to 'event' for names without ASCII", () => {
  assert.equal(pickEventSlug("शतरंज", "2026-04-01", () => false), "event");
});
