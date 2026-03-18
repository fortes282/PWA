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

  // Create password_resets table if missing
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // Create avatar_uploads dir info table if missing (just ensure users has avatar_url)
  // avatar_url is already in users table — no migration needed

  // Create appointment_series table if missing
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS appointment_series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES users(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        service_id INTEGER NOT NULL REFERENCES services(id),
        room_id INTEGER REFERENCES rooms(id),
        start_time TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'WEEKLY',
        start_date TEXT NOT NULL,
        end_date TEXT,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // Create time_off_blocks table if missing
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS time_off_blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES users(id),
        start_date_time TEXT NOT NULL,
        end_date_time TEXT NOT NULL,
        reason TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // NOC 14: Add payment_method + payment_paid_at to invoices
  try {
    const invCols = sqlite.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
    if (invCols.length > 0 && !invCols.some((c) => c.name === "payment_method")) {
      sqlite.exec("ALTER TABLE invoices ADD COLUMN payment_method TEXT");
    }
    if (invCols.length > 0 && !invCols.some((c) => c.name === "payment_paid_at")) {
      sqlite.exec("ALTER TABLE invoices ADD COLUMN payment_paid_at INTEGER");
    }
  } catch {
    // ignore
  }

  // NOC 14: Add category to services
  try {
    const svcCols = sqlite.prepare("PRAGMA table_info(services)").all() as Array<{ name: string }>;
    if (svcCols.length > 0 && !svcCols.some((c) => c.name === "category")) {
      sqlite.exec("ALTER TABLE services ADD COLUMN category TEXT");
    }
  } catch {
    // ignore
  }

  // NOC 14: Add client_note to appointments
  try {
    const apptCols = sqlite.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
    if (apptCols.length > 0 && !apptCols.some((c) => c.name === "client_note")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN client_note TEXT");
    }
  } catch {
    // ignore
  }
}
