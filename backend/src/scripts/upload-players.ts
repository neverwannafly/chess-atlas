import { readFileSync } from "node:fs";

// Uploads players prepared locally to a running Chess Atlas API.
//   ADMIN_TOKEN=... npx tsx src/scripts/upload-players.ts --api https://<host> --file players.json
// The file is either { "players": [...] } or a bare array. Sent in batches of 500 (see docs/PLAYER_IMPORT.md).

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const api = (arg("--api") ?? process.env.CHESSATLAS_API_URL ?? "").replace(/\/$/, "");
const file = arg("--file");
const token = process.env.ADMIN_TOKEN;
if (!api || !file || !token) {
  console.error("Usage: ADMIN_TOKEN=... upload-players.ts --api <url> --file <players.json>");
  process.exit(1);
}

const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
const players = Array.isArray(raw) ? raw : (raw as { players: unknown[] }).players;
if (!Array.isArray(players)) throw new Error("file must hold an array or { players: [...] }");

const BATCH = 500;
const total = { created: 0, updated: 0, skipped: 0, ratingRows: 0 };
for (let i = 0; i < players.length; i += BATCH) {
  const batch = players.slice(i, i + BATCH);
  const res = await fetch(`${api}/api/admin/players/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ players: batch }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`batch starting at ${i} failed: HTTP ${res.status}`, JSON.stringify(body).slice(0, 500));
    process.exit(2);
  }
  const s = (body as { data: typeof total }).data;
  for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += s[k];
  console.log(`batch ${i / BATCH + 1}: ${JSON.stringify(s)}`);
}
console.log("total", JSON.stringify(total));
