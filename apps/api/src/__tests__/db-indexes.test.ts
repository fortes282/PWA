import { describe, it, expect, beforeAll } from "vitest";
import { rawSqlite, applyRuntimeMigrations } from "../db/index.js";

// Create all tables so indexes can be applied
const TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'CLIENT', phone TEXT, avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1, behavior_score REAL NOT NULL DEFAULT 100, email_enabled INTEGER NOT NULL DEFAULT 1, sms_enabled INTEGER NOT NULL DEFAULT 0, push_enabled INTEGER NOT NULL DEFAULT 0, push_subscription TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, category TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, cancellation_reason TEXT, client_note TEXT, recurrence_rule TEXT, recurrence_end_date TEXT, recurrence_parent_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, appointment_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, service_id INTEGER NOT NULL, employee_id INTEGER, preferred_dates TEXT, status TEXT NOT NULL DEFAULT 'WAITING', notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, metadata TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', total REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, paid_at TEXT, notes TEXT, payment_method TEXT, payment_paid_at INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, total REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS medical_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, appointment_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, diagnosis TEXT, recommendations TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS behavior_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, points REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, blood_type TEXT, allergies TEXT, contraindications TEXT, medications TEXT, chronic_conditions TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, primary_diagnosis TEXT, functional_status TEXT, rehab_goals TEXT, notes TEXT, last_updated_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS fio_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, fio_id TEXT NOT NULL UNIQUE, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CZK', variable_symbol TEXT, note TEXT, counter_account TEXT, counter_name TEXT, transaction_date TEXT NOT NULL, matched_invoice_id INTEGER, matched_client_id INTEGER, is_matched INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER NOT NULL, to_user_id INTEGER NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, parent_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS appointment_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id INTEGER NOT NULL, client_id INTEGER NOT NULL, rating INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(appointment_id));
  CREATE TABLE IF NOT EXISTS client_staff_notes (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, author_id INTEGER NOT NULL, note TEXT NOT NULL, is_private INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS loyalty_points (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, points INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, title TEXT NOT NULL, description TEXT, target_date TEXT, status TEXT NOT NULL DEFAULT 'active', employee_notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, target_id INTEGER, target_type TEXT, details TEXT, ip TEXT, created_at INTEGER);
  CREATE TABLE IF NOT EXISTS pending_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, service_id INTEGER, slot_date TEXT NOT NULL, slot_time TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, note TEXT, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS client_packages (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, package_id INTEGER NOT NULL, sessions_total INTEGER NOT NULL, sessions_used INTEGER NOT NULL DEFAULT 0, purchased_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS time_off_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, start_date_time TEXT NOT NULL, end_date_time TEXT NOT NULL, reason TEXT, created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS profile_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, changed_by INTEGER NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS notification_preferences (user_id INTEGER PRIMARY KEY, email_reminders INTEGER NOT NULL DEFAULT 1, sms_reminders INTEGER NOT NULL DEFAULT 1, push_reminders INTEGER NOT NULL DEFAULT 1);
`;

describe("database indexes (NOC 23)", () => {
  beforeAll(() => {
    rawSqlite.exec(TABLES_SQL);
    applyRuntimeMigrations();
  });

  it("has performance indexes on appointments table", () => {
    const indexes = rawSqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='appointments' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);

    expect(names).toContain("idx_appointments_client_id");
    expect(names).toContain("idx_appointments_employee_id");
    expect(names).toContain("idx_appointments_status");
    expect(names).toContain("idx_appointments_start_time");
    expect(names).toContain("idx_appointments_employee_start");
    expect(names).toContain("idx_appointments_client_status");
  });

  it("has performance indexes on notifications table", () => {
    const indexes = rawSqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='notifications' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);

    expect(names).toContain("idx_notifications_user_id");
    expect(names).toContain("idx_notifications_user_read");
  });

  it("has performance indexes on invoices table", () => {
    const indexes = rawSqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='invoices' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);

    expect(names).toContain("idx_invoices_client_id");
    expect(names).toContain("idx_invoices_status");
  });

  it("has performance indexes on messages table", () => {
    const indexes = rawSqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='messages' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;
    const names = indexes.map((i) => i.name);

    expect(names).toContain("idx_messages_to_user");
    expect(names).toContain("idx_messages_from_user");
  });

  it("has at least 30 custom performance indexes total", () => {
    const allIndexes = rawSqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all() as Array<{ name: string }>;

    expect(allIndexes.length).toBeGreaterThanOrEqual(30);
  });
});
