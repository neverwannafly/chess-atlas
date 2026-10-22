import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | null = null;
export function appVersion(): string {
  if (cached) return cached;
  try {
    const p = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../package.json");
    cached = (JSON.parse(fs.readFileSync(p, "utf8")) as { version: string }).version;
  } catch {
    cached = "0.0.0";
  }
  return cached;
}
