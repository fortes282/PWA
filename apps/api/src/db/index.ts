import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { join } from "path";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");

const sqlite = new Database(DB_PATH);

// WAL mode for better concurrency
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
