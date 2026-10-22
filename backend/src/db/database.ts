import "dotenv/config";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./migrations.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(here, "../../data");
export const DB_PATH = path.join(DATA_DIR, "chessatlas.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db: InstanceType<typeof Database> = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

runMigrations(db);

export default db;
