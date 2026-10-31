import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

// Pure helpers for erasure. This module does not open the database itself, so importers such as the
// FIDE ingester and its tests can use it with any handle. See db/deletion.ts for the request workflow.

/** FIDE ids are stored hashed in the suppression list, so the list itself holds no ids. */
export function fideHash(fideId: string): string {
  return createHash("sha256").update(fideId.trim()).digest("hex");
}

export function suppressedHashes(db: Database.Database): Set<string> {
  const rows = db.prepare("SELECT fideHash FROM suppressed_fide_ids").all() as { fideHash: string }[];
  return new Set(rows.map((r) => r.fideHash));
}
