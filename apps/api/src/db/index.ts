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
export const rawSqlite = sqlite;
export type DB = typeof db;

/**
 * Apply lightweight schema migrations at runtime.
 * Safe to call multiple times — uses PRAGMA table_info to check existence.
 * Call this after creating tables (e.g. in tests after MIGRATION_SQL).
 */
export function applyRuntimeMigrations(): void {
  try {
    const cols = sqlite.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
    if (cols.length > 0 && !cols.some((c) => c.name === "cancellation_reason")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN cancellation_reason TEXT");
    }
  } catch {
    // Table might not exist yet in tests — migrations run lazily
  }
}
