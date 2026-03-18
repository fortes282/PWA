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

  // NOC 15: Create loyalty_points table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // NOC 15: Create appointment_templates table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS appointment_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        service_id INTEGER NOT NULL REFERENCES services(id),
        employee_id INTEGER REFERENCES users(id),
        room_id INTEGER REFERENCES rooms(id),
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // NOC 15: Create health_goals table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS health_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        target_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        employee_notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // NOC 16: Create messages table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0,
        parent_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // NOC 16: Create appointment_ratings table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS appointment_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(appointment_id)
      )
    `);
  } catch {
    // ignore
  }

  // NOC 16: Create client_staff_notes table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS client_staff_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        is_private INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {
    // ignore
  }

  // NOC 17: Create notification_preferences table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        user_id INTEGER PRIMARY KEY,
        email_reminders INTEGER NOT NULL DEFAULT 1,
        sms_reminders INTEGER NOT NULL DEFAULT 1,
        push_reminders INTEGER NOT NULL DEFAULT 1
      )
    `);
  } catch {
    // ignore
  }

  // NOC 18: Add recurrence columns to appointments
  try {
    const apptCols2 = sqlite.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
    if (apptCols2.length > 0 && !apptCols2.some((c) => c.name === "recurrence_rule")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN recurrence_rule TEXT");
    }
    if (apptCols2.length > 0 && !apptCols2.some((c) => c.name === "recurrence_end_date")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN recurrence_end_date TEXT");
    }
    if (apptCols2.length > 0 && !apptCols2.some((c) => c.name === "recurrence_parent_id")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN recurrence_parent_id INTEGER");
    }
  } catch {
    // ignore
  }

  // ── NOC 23: Performance indexes ─────────────────────────────────────────
  applyDatabaseIndexes();
}

/**
 * NOC 23: Create performance indexes for all hot query paths.
 * Uses CREATE INDEX IF NOT EXISTS — safe to call repeatedly.
 */
function applyDatabaseIndexes(): void {
  const indexes = [
    // Appointments — the most queried table
    "CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_employee_id ON appointments(employee_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_employee_start ON appointments(employee_id, start_time)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_client_status ON appointments(client_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_parent ON appointments(recurrence_parent_id)",

    // Invoices
    "CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)",

    // Notifications — read by user, sorted by date
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)",

    // Credit transactions
    "CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id)",

    // Waitlist
    "CREATE INDEX IF NOT EXISTS idx_waitlist_client_id ON waitlist(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status)",

    // Medical reports
    "CREATE INDEX IF NOT EXISTS idx_medical_reports_client_id ON medical_reports(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_medical_reports_employee_id ON medical_reports(employee_id)",

    // Behavior events
    "CREATE INDEX IF NOT EXISTS idx_behavior_events_user_id ON behavior_events(user_id)",

    // Health records
    "CREATE INDEX IF NOT EXISTS idx_health_records_client_id ON health_records(client_id)",

    // FIO transactions
    "CREATE INDEX IF NOT EXISTS idx_fio_transactions_matched ON fio_transactions(is_matched)",
    "CREATE INDEX IF NOT EXISTS idx_fio_transactions_vs ON fio_transactions(variable_symbol)",

    // Messages
    "CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id)",

    // Ratings
    "CREATE INDEX IF NOT EXISTS idx_appointment_ratings_appointment ON appointment_ratings(appointment_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointment_ratings_client ON appointment_ratings(client_id)",

    // Staff notes
    "CREATE INDEX IF NOT EXISTS idx_client_staff_notes_client ON client_staff_notes(client_id)",

    // Loyalty points
    "CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id)",

    // Working hours
    "CREATE INDEX IF NOT EXISTS idx_working_hours_employee ON working_hours(employee_id)",

    // Audit log
    "CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)",

    // Refresh tokens
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)",

    // Health goals
    "CREATE INDEX IF NOT EXISTS idx_health_goals_client ON health_goals(client_id)",

    // Pending bookings
    "CREATE INDEX IF NOT EXISTS idx_pending_bookings_status ON pending_bookings(status)",

    // Client packages
    "CREATE INDEX IF NOT EXISTS idx_client_packages_client ON client_packages(client_id)",

    // Time off blocks
    "CREATE INDEX IF NOT EXISTS idx_time_off_employee ON time_off_blocks(employee_id)",

    // Profile log
    "CREATE INDEX IF NOT EXISTS idx_profile_log_user ON profile_log(user_id)",
  ];

  for (const sql of indexes) {
    try {
      sqlite.exec(sql);
    } catch {
      // ignore — table may not exist yet
    }
  }
}
