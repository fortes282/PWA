/**
 * One-time migration script: SQLite → PostgreSQL
 *
 * Usage:
 *   DATABASE_URL=postgresql://... DATABASE_PATH=./data/pristav.db \
 *     tsx src/db/migrate-sqlite-to-pg.ts
 *
 * What it does:
 *   1. Connects to the existing SQLite file (DATABASE_PATH)
 *   2. Connects to the target PostgreSQL (DATABASE_URL)
 *   3. Creates all tables in PG via drizzle-kit push (or raw SQL)
 *   4. Copies each table row-by-row from SQLite → PG
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
 */

import Database from "better-sqlite3";
import postgres from "postgres";
import { join } from "path";

const SQLITE_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is required");
  process.exit(1);
}

console.log(`▶ SQLite source: ${SQLITE_PATH}`);
console.log(`▶ PostgreSQL target: ${DATABASE_URL.replace(/:([^:@]+)@/, ":***@")}`);

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pg = postgres(DATABASE_URL, { max: 5 });

// ─── Helper: get all tables from SQLite ──────────────────────────────────────
function getSqliteTables(): string[] {
  return (
    sqlite
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

// ─── Helper: get column info from SQLite ─────────────────────────────────────
function getColumns(table: string): string[] {
  return (
    sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((c) => c.name);
}

// ─── Create PG schema ────────────────────────────────────────────────────────
// We use a simplified DDL that mirrors the SQLite schema with PG-compatible types.
// This covers all tables that exist in the SQLite DB.
async function createPgSchema() {
  console.log("\n▶ Creating PostgreSQL schema...");
  await pg.unsafe(`
    -- Enable extensions
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CLIENT',
      phone TEXT,
      avatar_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      behavior_score REAL NOT NULL DEFAULT 100,
      email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      push_subscription TEXT,
      totp_secret TEXT,
      totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      totp_backup_codes TEXT,
      gdpr_health_consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
      gdpr_health_consent_at TEXT,
      gdpr_anonymized_at TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      duration_min INTEGER NOT NULL DEFAULT 60,
      price REAL NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      category TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      capacity INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id),
      employee_id INTEGER NOT NULL REFERENCES users(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      room_id INTEGER REFERENCES rooms(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      cancellation_reason TEXT,
      price REAL,
      booking_activated BOOLEAN NOT NULL DEFAULT FALSE,
      client_note TEXT,
      recurrence_rule TEXT,
      recurrence_end_date TEXT,
      recurrence_parent_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      employee_id INTEGER REFERENCES users(id),
      preferred_dates TEXT,
      status TEXT NOT NULL DEFAULT 'WAITING',
      notified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total REAL NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      paid_at TEXT,
      notes TEXT,
      payment_method TEXT,
      payment_paid_at INTEGER,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medical_reports (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id),
      employee_id INTEGER NOT NULL REFERENCES users(id),
      appointment_id INTEGER REFERENCES appointments(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      diagnosis TEXT,
      recommendations TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS behavior_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      points REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS profile_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS fio_transactions (
      id SERIAL PRIMARY KEY,
      fio_id TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CZK',
      variable_symbol TEXT,
      note TEXT,
      counter_account TEXT,
      counter_name TEXT,
      transaction_date TEXT NOT NULL,
      matched_invoice_id INTEGER REFERENCES invoices(id),
      matched_client_id INTEGER REFERENCES users(id),
      is_matched BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      blood_type TEXT,
      allergies TEXT,
      contraindications TEXT,
      medications TEXT,
      chronic_conditions TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      primary_diagnosis TEXT,
      functional_status TEXT,
      rehab_goals TEXT,
      notes TEXT,
      last_updated_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS credit_requests (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by INTEGER REFERENCES users(id),
      review_note TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_id INTEGER,
      target_type TEXT,
      details TEXT,
      ip TEXT,
      created_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS appointment_series (
      id SERIAL PRIMARY KEY,
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
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS time_off_blocks (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER NOT NULL REFERENCES users(id),
      start_date_time TEXT NOT NULL,
      end_date_time TEXT NOT NULL,
      reason TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS loyalty_points (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS appointment_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      service_id INTEGER NOT NULL REFERENCES services(id),
      employee_id INTEGER REFERENCES users(id),
      room_id INTEGER REFERENCES rooms(id),
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS health_goals (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      employee_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      parent_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS appointment_ratings (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS client_staff_notes (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      is_private BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS service_packages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      service_id INTEGER REFERENCES services(id),
      sessions_count INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS client_packages (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      package_id INTEGER NOT NULL REFERENCES service_packages(id),
      sessions_total INTEGER NOT NULL,
      sessions_used INTEGER NOT NULL DEFAULT 0,
      purchased_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      expires_at TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS pending_bookings (
      id SERIAL PRIMARY KEY,
      service_id INTEGER REFERENCES services(id),
      slot_date TEXT NOT NULL,
      slot_time TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      prefix TEXT NOT NULL,
      scopes TEXT NOT NULL DEFAULT '[]',
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      expires_at TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS login_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip TEXT,
      user_agent TEXT,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      email_reminders BOOLEAN NOT NULL DEFAULT TRUE,
      sms_reminders BOOLEAN NOT NULL DEFAULT TRUE,
      push_reminders BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER REFERENCES appointments(id),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      window TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      detail TEXT,
      sent_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS reminder_sent_log (
      id SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL,
      window TEXT NOT NULL,
      channel TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      UNIQUE(appointment_id, window, channel)
    );

    CREATE TABLE IF NOT EXISTS gdpr_consents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_type TEXT NOT NULL,
      granted BOOLEAN NOT NULL DEFAULT FALSE,
      granted_at TEXT,
      revoked_at TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS health_record_access_log (
      id SERIAL PRIMARY KEY,
      accessor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS gdpr_erasure_requests (
      id SERIAL PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requested_by INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'PENDING',
      completed_at TEXT,
      completed_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS sos_activations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      alerts_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS therapy_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      structure TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS therapy_reports (
      id SERIAL PRIMARY KEY,
      template_id INTEGER REFERENCES therapy_templates(id),
      client_id INTEGER NOT NULL REFERENCES users(id),
      therapist_id INTEGER NOT NULL REFERENCES users(id),
      appointment_id INTEGER REFERENCES appointments(id),
      title TEXT NOT NULL,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
      updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_employee_id ON appointments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
    CREATE INDEX IF NOT EXISTS idx_appointments_employee_start ON appointments(employee_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_notification_log_sent ON notification_log(sent_at);
    CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
  `);
  console.log("✅ PostgreSQL schema created");
}

// ─── Copy table data ──────────────────────────────────────────────────────────
type SqliteRow = Record<string, unknown>;

// Tables that use INTEGER 0/1 for booleans — we convert to PG boolean
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  users: ["is_active", "email_enabled", "sms_enabled", "push_enabled", "totp_enabled", "gdpr_health_consent_granted"],
  services: ["is_active"],
  rooms: ["is_active"],
  working_hours: ["is_active"],
  appointments: ["booking_activated"],
  notifications: ["is_read"],
  waitlist: [],
  invoices: [],
  fio_transactions: ["is_matched"],
  service_packages: ["is_active"],
  client_packages: ["is_active"],
  api_keys: ["is_active"],
  login_history: ["success"],
  notification_preferences: ["email_reminders", "sms_reminders", "push_reminders"],
  gdpr_consents: ["granted"],
  emergency_contacts: ["is_active"],
  therapy_templates: ["is_active"],
  client_staff_notes: ["is_private"],
  messages: ["is_read"],
};

function convertRow(table: string, row: SqliteRow): SqliteRow {
  const boolCols = BOOLEAN_COLUMNS[table] ?? [];
  const out: SqliteRow = { ...row };
  for (const col of boolCols) {
    if (col in out && out[col] !== null && out[col] !== undefined) {
      out[col] = out[col] === 1 || out[col] === true;
    }
  }
  return out;
}

async function copyTable(table: string) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as SqliteRow[];
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (empty, skipping)`);
    return;
  }

  const cols = getColumns(table);
  const converted = rows.map((r) => convertRow(table, r));

  // Use batch inserts of 100 rows at a time
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < converted.length; i += BATCH) {
    const batch = converted.slice(i, i + BATCH);
    const placeholders = batch
      .map((_, ri) => `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`)
      .join(", ");
    const values = batch.flatMap((r) => cols.map((c) => r[c] ?? null));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (pg.unsafe as any)(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values
    );
    inserted += batch.length;
  }

  // Reset SERIAL sequences after bulk insert
  if (cols.includes("id")) {
    await pg.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1)) FROM ${table}`
    );
  }

  console.log(`  ${table}: ${inserted} rows copied`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABLE_ORDER = [
  // Must respect FK dependencies
  "users",
  "services",
  "rooms",
  "working_hours",
  "appointments",
  "refresh_tokens",
  "password_resets",
  "credit_transactions",
  "waitlist",
  "notifications",
  "invoices",
  "invoice_items",
  "medical_reports",
  "behavior_events",
  "profile_log",
  "fio_transactions",
  "health_records",
  "system_settings",
  "credit_requests",
  "audit_log",
  "appointment_series",
  "time_off_blocks",
  "loyalty_points",
  "appointment_templates",
  "health_goals",
  "messages",
  "appointment_ratings",
  "client_staff_notes",
  "service_packages",
  "client_packages",
  "pending_bookings",
  "api_keys",
  "login_history",
  "notification_preferences",
  "notification_log",
  "reminder_sent_log",
  "gdpr_consents",
  "health_record_access_log",
  "gdpr_erasure_requests",
  "emergency_contacts",
  "sos_activations",
  "therapy_templates",
  "therapy_reports",
];

async function main() {
  try {
    await createPgSchema();

    const sqliteTables = new Set(getSqliteTables());
    console.log(`\n▶ Copying data (${sqliteTables.size} tables found in SQLite)...`);

    for (const table of TABLE_ORDER) {
      if (sqliteTables.has(table)) {
        try {
          await copyTable(table);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  ⚠ ${table}: skipped (${msg})`);
        }
      }
    }

    // Copy any remaining tables not in TABLE_ORDER
    for (const table of sqliteTables) {
      if (!TABLE_ORDER.includes(table)) {
        try {
          await copyTable(table);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  ⚠ ${table}: skipped (${msg})`);
        }
      }
    }

    console.log("\n✅ Migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    sqlite.close();
    await pg.end();
  }
}

main();
