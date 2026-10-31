import { spawn, spawnSync } from "node:child_process";
import { closeSync, openSync, readSync, createWriteStream, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { StringDecoder } from "node:string_decoder";
import type Database from "better-sqlite3";
import { fideHash, suppressedHashes } from "../db/privacy.js";

// Ingest of FIDE's official monthly rating list (players_list_xml.zip, "foa" combined file).
// That one file carries standard, rapid and blitz ratings, so one download covers all three lists.
// Only federation IND records are kept. Date of birth and birth year are never read into a record.

type Db = InstanceType<typeof Database>;

export const USER_AGENT = "ChessAtlasBot/1.0 (India chess directory)";
export const SOURCE = "fide-monthly-list";
export const LIST_URLS = { combined: "https://ratings.fide.com/download/players_list_xml.zip" } as const;
export type ListKind = keyof typeof LIST_URLS;
export const BATCH_SIZE = 1000;
const FED = "IND";

export type RatingList = "standard" | "rapid" | "blitz";
export interface ListRating { rating: number | null; games: number | null; k: number | null }
export interface FideRecord {
  fideId: string;
  name: string;
  federationCode: string;
  sex: "M" | "F" | null;
  title: string | null;
  inactive: boolean;
  /** Birth year as published in the FIDE list (the list gives a year only). */
  birthYear: number | null;
  ratings: Record<RatingList, ListRating>;
}

// ---- download ------------------------------------------------------------------------------

/** True if the file starts with a zip local-file-header (or empty-archive) signature. */
export function looksLikeZip(path: string): boolean {
  const fd = openSync(path, "r");
  try {
    const b = Buffer.alloc(4);
    if (readSync(fd, b, 0, 4, 0) < 4) return false;
    return b[0] === 0x50 && b[1] === 0x4b && ((b[2] === 3 && b[3] === 4) || (b[2] === 5 && b[3] === 6));
  } finally {
    closeSync(fd);
  }
}

/** Lists archive members with `unzip -Z1`; throws if the archive is not valid. */
export function listZipMembers(zipPath: string): string[] {
  const r = spawnSync("unzip", ["-Z1", zipPath], { encoding: "utf8" });
  if (r.error) throw new Error(`unzip is not available: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`not a valid zip archive: ${r.stderr.trim().slice(0, 200)}`);
  return r.stdout.split("\n").filter(Boolean);
}

/** Downloads the official zip into destDir (one request) and verifies it is a zip, not an HTML page. */
export async function downloadList(kind: ListKind, destDir: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  mkdirSync(destDir, { recursive: true });
  const res = await fetchImpl(LIST_URLS[kind], { headers: { "user-agent": USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`FIDE list download failed: HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (/text\/html/i.test(type)) throw new Error("FIDE list download returned HTML, not a zip");
  const dest = join(destDir, `fide_${kind}.zip`);
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  if (statSync(dest).size < 4 || !looksLikeZip(dest)) throw new Error("downloaded file is not a zip archive");
  listZipMembers(dest);
  return dest;
}

/** Streams the first member of the zip as text, via `unzip -p`. The content is only parsed as data. */
export function zipTextStream(zipPath: string): AsyncIterable<string> {
  const member = listZipMembers(zipPath)[0];
  if (!member) throw new Error("zip archive is empty");
  const child = spawn("unzip", ["-p", zipPath, member], { stdio: ["ignore", "pipe", "pipe"] });
  const exited = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 || code === null ? resolve() : reject(new Error(`unzip exited with ${code}`))));
  });
  exited.catch(() => {});
  async function* gen(): AsyncGenerator<string> {
    const dec = new StringDecoder("utf8");
    for await (const chunk of child.stdout) yield dec.write(chunk as Buffer);
    const tail = dec.end();
    if (tail) yield tail;
    await exited;
  }
  return gen();
}

// ---- parse ---------------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function intOrNull(v: string | undefined): number | null {
  if (!v || !/^\d+$/.test(v.trim())) return null;
  const n = Number(v);
  return n > 0 ? n : null; // 0 means "no rating" in the file
}

function rated(fields: Map<string, string>, prefix: string): ListRating {
  const rating = intOrNull(fields.get(`${prefix}rating`));
  if (rating === null) return { rating: null, games: null, k: null };
  const games = fields.get(`${prefix}games`)?.trim();
  return { rating, games: games && /^\d+$/.test(games) ? Number(games) : null, k: intOrNull(fields.get(`${prefix}k`)) };
}

/** Converts one <player> block to a record; null if it is not a usable IND record. */
/** A four-digit year, or null. Full dates are not published by FIDE, so anything else is dropped. */
export function yearOf(raw: string | undefined): number | null {
  const t = (raw ?? "").trim();
  return /^(19|20)\d{2}$/.test(t) ? Number(t) : null;
}

export function parsePlayerBlock(block: string, country = FED): FideRecord | null {
  const fields = new Map<string, string>();
  const re = /<([a-z_]+)>([^<]*)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) fields.set(m[1], m[2]);
  if ((fields.get("country") ?? "").trim() !== country) return null;
  const fideId = (fields.get("fideid") ?? "").trim();
  const name = decode(fields.get("name") ?? "").replace(/\s+/g, " ").replace(/^[\s,]+/, "").trim();
  if (!/^\d+$/.test(fideId) || !name) return null;
  const sex = fields.get("sex")?.trim();
  const title = (fields.get("title") || fields.get("w_title") || "").trim().toUpperCase();
  return {
    fideId,
    name,
    federationCode: country,
    sex: sex === "M" || sex === "F" ? sex : null,
    title: title || null,
    inactive: /i/i.test(fields.get("flag") ?? ""),
    birthYear: yearOf(fields.get("birthday")),
    ratings: { standard: rated(fields, ""), rapid: rated(fields, "rapid_"), blitz: rated(fields, "blitz_") },
  };
}

/** Streaming parser: holds at most one chunk plus one partial <player> block in memory. */
export async function* parsePlayers(chunks: AsyncIterable<string | Buffer>, country = FED): AsyncGenerator<FideRecord> {
  let buf = "";
  const dec = new StringDecoder("utf8");
  const drain = function* (final: boolean): Generator<FideRecord> {
    for (;;) {
      const start = buf.indexOf("<player>");
      if (start < 0) { buf = final ? "" : buf.slice(Math.max(0, buf.length - 8)); return; }
      const end = buf.indexOf("</player>", start);
      if (end < 0) { buf = buf.slice(start); return; }
      const rec = parsePlayerBlock(buf.slice(start, end), country);
      buf = buf.slice(end + 9);
      if (rec) yield rec;
    }
  };
  for await (const c of chunks) {
    buf += typeof c === "string" ? c : dec.write(c);
    yield* drain(false);
  }
  buf += dec.end();
  yield* drain(true);
}

// ---- store ---------------------------------------------------------------------------------

export function normaliseKey(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export interface IngestStats { seen: number; playersCreated: number; playersLinked: number; ratingRows: number }

function stmts(db: Db) {
  return {
    byFide: db.prepare("SELECT id FROM players WHERE fideId = ?"),
    byName: db.prepare("SELECT id FROM players WHERE federationCode = ? AND nameKey = ? AND fideId IS NULL"),
    link: db.prepare("UPDATE players SET fideId = ?, name = ?, updatedAtMs = ? WHERE id = ?"),
    touch: db.prepare("UPDATE players SET name = ?, updatedAtMs = ? WHERE id = ?"),
    insert: db.prepare("INSERT INTO players (fideId, name, nameKey, federationCode, createdAtMs, updatedAtMs) VALUES (?, ?, ?, ?, ?, ?)"),
    fed: db.prepare("INSERT OR IGNORE INTO federations (code, name) VALUES (?, NULL)"),
    profile: db.prepare(`INSERT INTO fide_profiles (playerId, fideId, title, sex, federationCode, inactive, source, fetchedAtMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(playerId) DO UPDATE SET fideId = excluded.fideId, title = excluded.title, sex = excluded.sex,
        federationCode = excluded.federationCode, inactive = excluded.inactive, source = excluded.source, fetchedAtMs = excluded.fetchedAtMs`),
    rating: db.prepare(`INSERT INTO fide_ratings (playerId, list, period, rating, games, k, source, fetchedAtMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(playerId, list, period) DO UPDATE SET rating = excluded.rating, games = excluded.games, k = excluded.k,
        source = excluded.source, fetchedAtMs = excluded.fetchedAtMs`),
  };
}

/** Upserts a batch of records in one transaction. Idempotent per (fideId, list, period). */
export function upsertRecords(db: Db, records: FideRecord[], period: string, nowMs: number, stats?: IngestStats): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error(`bad period: ${period}`);
  const s = stmts(db);
  const erased = suppressedHashes(db);
  db.transaction(() => {
    for (const r of records) {
      s.fed.run(r.federationCode);
      const key = normaliseKey(r.name);
      if (erased.has(fideHash(r.fideId))) continue; // erased on request
      let id = (s.byFide.get(r.fideId) as { id: number } | undefined)?.id;
      if (id !== undefined) {
        s.touch.run(r.name, nowMs, id);
      } else {
        // Matched on FIDE id only. Players are never merged by name (see docs/DECISIONS.md).
        id = Number(s.insert.run(r.fideId, r.name, key, r.federationCode, nowMs, nowMs).lastInsertRowid);
        if (stats) stats.playersCreated++;
      }
      if (r.birthYear !== null) db.prepare("UPDATE players SET birthYear = ?, birthYearSource = 'fide' WHERE id = ?").run(r.birthYear, id);
      s.profile.run(id, r.fideId, r.title, r.sex, r.federationCode, r.inactive ? 1 : 0, SOURCE, nowMs);
      for (const list of ["standard", "rapid", "blitz"] as const) {
        const x = r.ratings[list];
        s.rating.run(id, list, period, x.rating, x.games, x.k, SOURCE, nowMs);
        if (stats) stats.ratingRows++;
      }
    }
  })();
}

export interface IngestOptions {
  period: string;
  db: Db;
  /** Path to the downloaded zip. */
  zipPath?: string;
  /** Alternative text source (used by tests). */
  chunks?: AsyncIterable<string | Buffer>;
  nowMs?: number;
}

export async function ingestMonthlyList(opts: IngestOptions): Promise<IngestStats> {
  const src = opts.chunks ?? (opts.zipPath ? zipTextStream(opts.zipPath) : null);
  if (!src) throw new Error("zipPath or chunks required");
  const nowMs = opts.nowMs ?? Date.now();
  const stats: IngestStats = { seen: 0, playersCreated: 0, playersLinked: 0, ratingRows: 0 };
  let batch: FideRecord[] = [];
  for await (const rec of parsePlayers(src)) {
    stats.seen++;
    batch.push(rec);
    if (batch.length >= BATCH_SIZE) { upsertRecords(opts.db, batch, opts.period, nowMs, stats); batch = []; }
  }
  if (batch.length) upsertRecords(opts.db, batch, opts.period, nowMs, stats);
  return stats;
}
