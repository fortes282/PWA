/**
 * Database connection module — supports both SQLite (dev) and PostgreSQL (production).
 *
 * Mode selection:
 *   DATABASE_URL set → PostgreSQL via drizzle-orm/postgres-js
 *   DATABASE_URL not set → SQLite file via drizzle-orm/better-sqlite3 (default/dev)
 *
 * rawSqlite is always a SQLite Database instance:
 *   - SQLite mode: real file-based database
 *   - PostgreSQL mode: in-memory SQLite (available for legacy callers;
 *     new code should use the drizzle `db` instance)
 *
 * applyRuntimeMigrations() is a no-op in PostgreSQL mode.
 */
import Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
// PostgresJsDatabase imported only for documentation purposes
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PostgresJsDatabase as _PgDb } from "drizzle-orm/postgres-js";
import { join } from "path";
import * as schema from "./schema.js";

// ─── Detect mode ──────────────────────────────────────────────────────────────
export const DATABASE_URL = process.env.DATABASE_URL;
export const IS_POSTGRES = !!DATABASE_URL;

// ─── SQLite instance (always available for rawSqlite callers) ─────────────────
// Always use file-based SQLite for rawSqlite, even in PostgreSQL mode.
// Many routes use rawSqlite directly for their own tables (questionnaires, groups, etc.)
// The migration script creates all tables in this SQLite file.
const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");

const sqlite = new Database(DB_PATH);

if (!IS_POSTGRES) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
}

export const rawSqlite = sqlite;

// ─── Drizzle db export ────────────────────────────────────────────────────────
// In PostgreSQL mode we do a dynamic import so better-sqlite3 driver is not mixed in.
// In SQLite mode we use the synchronous drizzle-orm/better-sqlite3 driver.
//
// db is typed as BetterSQLite3Database for SQLite-first compatibility.
// When DATABASE_URL is set, it is actually a PostgresJsDatabase at runtime.
// Code that needs PG-specific features should check IS_POSTGRES at runtime.

export type DB = BetterSQLite3Database<typeof schema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any;

if (IS_POSTGRES) {
  // Top-level await — valid in ESM (NodeNext + type:module)
  const pg = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const pgClient = pg.default(DATABASE_URL!, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  _db = drizzle(pgClient, { schema });
} else {
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  _db = drizzle(sqlite, { schema });
}

export const db: DB = _db as DB;

// ─── Runtime migrations (SQLite-only) ────────────────────────────────────────
/**
 * Apply lightweight schema migrations at runtime.
 * In PostgreSQL mode this is a no-op — PG schema is managed by Drizzle push/migrate.
 * Safe to call multiple times — uses PRAGMA table_info to check existence.
 * Call this after creating tables (e.g. in tests after MIGRATION_SQL).
 */
export function applyRuntimeMigrations(): void {
  // Skip in PostgreSQL mode
  if (IS_POSTGRES) return;

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

  // NOC 29: Create api_keys table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        prefix TEXT NOT NULL,
        scopes TEXT NOT NULL DEFAULT '[]',
        last_used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER REFERENCES users(id)
      )
    `);
  } catch {
    // ignore
  }

  // NOC 28: Create login_history table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip TEXT,
        user_agent TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // ── MUST Sprint: New tables ──────────────────────────────────────────────

  // MUST #1: Reminder sent log
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reminder_sent_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL,
        window TEXT NOT NULL,
        channel TEXT NOT NULL,
        sent_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(appointment_id, window, channel)
      )
    `);
  } catch { /* ignore */ }

  // MUST #1: Notification log (detailed outbound log)
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS notification_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER REFERENCES appointments(id),
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        channel TEXT NOT NULL,
        window TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'sent',
        detail TEXT,
        sent_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_notification_log_sent ON notification_log(sent_at)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id)`);
  } catch { /* ignore */ }

  // MUST #2: GDPR tables
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS gdpr_consents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        consent_type TEXT NOT NULL,
        granted INTEGER NOT NULL DEFAULT 0,
        granted_at TEXT,
        revoked_at TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS health_record_access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        accessor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS gdpr_erasure_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_by INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'PENDING',
        completed_at TEXT,
        completed_by INTEGER REFERENCES users(id),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  // MUST #2: Add GDPR + 2FA columns to users
  try {
    const userCols = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const addIfMissing = (col: string, def: string) => {
      if (userCols.length > 0 && !userCols.some((c) => c.name === col)) {
        sqlite.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
      }
    };
    addIfMissing("totp_secret", "TEXT");
    addIfMissing("totp_enabled", "INTEGER NOT NULL DEFAULT 0");
    addIfMissing("totp_backup_codes", "TEXT");
    addIfMissing("gdpr_health_consent_granted", "INTEGER NOT NULL DEFAULT 0");
    addIfMissing("gdpr_health_consent_at", "TEXT");
    addIfMissing("gdpr_anonymized_at", "TEXT");
  } catch { /* ignore */ }

  // MUST #5: Emergency contacts & SOS
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        description TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Seed default contacts if table is empty
    const count = (sqlite.prepare("SELECT COUNT(*) as n FROM emergency_contacts").get() as any).n;
    if (count === 0) {
      sqlite.prepare(`INSERT INTO emergency_contacts (name, phone, description, sort_order) VALUES (?, ?, ?, ?)`).run(
        "Linka bezpečí", "116 123", "Bezplatná krizová linka 24/7", 1
      );
      sqlite.prepare(`INSERT INTO emergency_contacts (name, phone, description, sort_order) VALUES (?, ?, ?, ?)`).run(
        "Centrum krizové intervence Praha", "284 016 666", "Psychiatrická nemocnice Bohnice — krizová linka", 2
      );
      sqlite.prepare(`INSERT INTO emergency_contacts (name, phone, description, sort_order) VALUES (?, ?, ?, ?)`).run(
        "Tísňová linka", "155", "Záchranná služba", 3
      );
    }
  } catch { /* ignore */ }

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS sos_activations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip_address TEXT,
        alerts_sent INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  // MUST #6: Therapy templates + reports
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS therapy_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        structure TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const tcount = (sqlite.prepare("SELECT COUNT(*) as n FROM therapy_templates").get() as any).n;
    if (tcount === 0) {
      for (const t of [
        { name: "Vstupní vyšetření", category: "intake" },
        { name: "Průběžná zpráva", category: "progress" },
        { name: "Závěrečná zpráva", category: "final" },
        { name: "Hodnocení kognitivních funkcí", category: "cognitive" },
      ]) {
        sqlite.prepare(`INSERT INTO therapy_templates (name, category, structure) VALUES (?, ?, ?)`).run(
          t.name, t.category, JSON.stringify({ sections: [] })
        );
      }
    }
  } catch { /* ignore */ }

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS therapy_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER REFERENCES therapy_templates(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        therapist_id INTEGER NOT NULL REFERENCES users(id),
        appointment_id INTEGER REFERENCES appointments(id),
        title TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  // SHOULD #10: Add cancellation_risk_score to appointments
  try {
    const apptColsRisk = sqlite.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
    if (apptColsRisk.length > 0 && !apptColsRisk.some((c) => c.name === "cancellation_risk_score")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN cancellation_risk_score REAL");
    }
  } catch { /* ignore */ }

  // SHOULD #10: Add last_reengagement_at to users
  try {
    const userColsRe = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    if (userColsRe.length > 0 && !userColsRe.some((c) => c.name === "last_reengagement_at")) {
      sqlite.exec("ALTER TABLE users ADD COLUMN last_reengagement_at TEXT");
    }
  } catch { /* ignore */ }

  // SHOULD #11: Insurance — add columns to users
  try {
    const userColsIns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    if (userColsIns.length > 0 && !userColsIns.some((c) => c.name === "insurance_company_id")) {
      sqlite.exec("ALTER TABLE users ADD COLUMN insurance_company_id INTEGER");
    }
    if (userColsIns.length > 0 && !userColsIns.some((c) => c.name === "insurance_number")) {
      sqlite.exec("ALTER TABLE users ADD COLUMN insurance_number TEXT");
    }
  } catch { /* ignore */ }

  // SHOULD #11: Insurance companies table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS insurance_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        contract_notes TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Seed predefined companies if empty
    const cnt = (sqlite.prepare("SELECT COUNT(*) as n FROM insurance_companies").get() as any).n;
    if (cnt === 0) {
      const ins = sqlite.prepare(`INSERT INTO insurance_companies (code, name) VALUES (?, ?)`);
      for (const [code, name] of [
        ["111", "VZP ČR — Všeobecná zdravotní pojišťovna"],
        ["201", "VoZP — Vojenská zdravotní pojišťovna"],
        ["205", "ČPZP — Česká průmyslová zdravotní pojišťovna"],
        ["207", "OZP — Oborová zdravotní pojišťovna"],
        ["209", "SZP — Zaměstnanecká pojišťovna Škoda"],
        ["211", "ZPMV — Zdravotní pojišťovna ministerstva vnitra"],
        ["213", "RBP — Revírní bratrská pokladna"],
      ]) { ins.run(code, name); }
    }
  } catch { /* ignore */ }

  // SHOULD #11: Insurance procedures table
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS insurance_procedures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        points REAL NOT NULL DEFAULT 0,
        point_price REAL NOT NULL DEFAULT 1.0,
        max_per_day INTEGER,
        max_per_month INTEGER,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Seed some common VZP procedures
    const pCnt = (sqlite.prepare("SELECT COUNT(*) as n FROM insurance_procedures").get() as any).n;
    if (pCnt === 0) {
      const pIns = sqlite.prepare(`INSERT INTO insurance_procedures (code, name, points, point_price, max_per_month) VALUES (?, ?, ?, ?, ?)`);
      pIns.run("906", "Fyzioterapie — individuální LTV", 400, 1.2, 20);
      pIns.run("902", "Fyzikální terapie", 250, 1.2, 10);
      pIns.run("905", "Skupinová LTV", 150, 1.2, 8);
      pIns.run("21225", "Psychoterapie individuální — 50 min", 800, 1.1, 4);
      pIns.run("35021", "Komplexní lázeňská péče", 1200, 1.0, null);
    }
  } catch { /* ignore */ }

  // SHOULD #11: Service → procedure mapping
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS service_procedure_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        procedure_id INTEGER NOT NULL REFERENCES insurance_procedures(id) ON DELETE CASCADE
      )
    `);
  } catch { /* ignore */ }

  // SHOULD #11: Insurance claims
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS insurance_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        procedure_id INTEGER NOT NULL REFERENCES insurance_procedures(id),
        batch_id INTEGER,
        status TEXT NOT NULL DEFAULT 'UNBILLED',
        amount REAL NOT NULL DEFAULT 0,
        diagnosis TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  // SHOULD #11: Insurance batches
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS insurance_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        insurance_company_id INTEGER NOT NULL REFERENCES insurance_companies(id),
        period TEXT NOT NULL,
        xml_content TEXT,
        status TEXT NOT NULL DEFAULT 'GENERATED',
        total_amount REAL NOT NULL DEFAULT 0,
        claims_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_insurance_claims_appointment ON insurance_claims(appointment_id)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON insurance_claims(status)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_insurance_claims_batch ON insurance_claims(batch_id)`);
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_insurance_batches_company ON insurance_batches(insurance_company_id)`);
  } catch { /* ignore */ }

  // SHOULD #8: Add isOnline column to appointments
  try {
    const apptColsOnline = sqlite.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
    if (apptColsOnline.length > 0 && !apptColsOnline.some((c) => c.name === "is_online")) {
      sqlite.exec("ALTER TABLE appointments ADD COLUMN is_online INTEGER NOT NULL DEFAULT 0");
    }
  } catch { /* ignore */ }

  // SHOULD #8: Video tokens table (for persistence across restarts)
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS video_tokens (
        token TEXT PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch { /* ignore */ }

  // ── NOC 23: Performance indexes ─────────────────────────────────────────
  applyDatabaseIndexes();
}

/**
 * NOC 23: Create performance indexes for all hot query paths.
 * Uses CREATE INDEX IF NOT EXISTS — safe to call repeatedly.
 * In PostgreSQL mode this is a no-op.
 */
function applyDatabaseIndexes(): void {
  if (IS_POSTGRES) return;

  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON appointments(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_employee_id ON appointments(employee_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_employee_start ON appointments(employee_id, start_time)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_client_status ON appointments(client_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_recurrence_parent ON appointments(recurrence_parent_id)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)",
    "CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_waitlist_client_id ON waitlist(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status)",
    "CREATE INDEX IF NOT EXISTS idx_medical_reports_client_id ON medical_reports(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_medical_reports_employee_id ON medical_reports(employee_id)",
    "CREATE INDEX IF NOT EXISTS idx_behavior_events_user_id ON behavior_events(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_health_records_client_id ON health_records(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_fio_transactions_matched ON fio_transactions(is_matched)",
    "CREATE INDEX IF NOT EXISTS idx_fio_transactions_vs ON fio_transactions(variable_symbol)",
    "CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id, is_read)",
    "CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointment_ratings_appointment ON appointment_ratings(appointment_id)",
    "CREATE INDEX IF NOT EXISTS idx_appointment_ratings_client ON appointment_ratings(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_client_staff_notes_client ON client_staff_notes(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_loyalty_points_user ON loyalty_points(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_working_hours_employee ON working_hours(employee_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_health_goals_client ON health_goals(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_pending_bookings_status ON pending_bookings(status)",
    "CREATE INDEX IF NOT EXISTS idx_client_packages_client ON client_packages(client_id)",
    "CREATE INDEX IF NOT EXISTS idx_time_off_employee ON time_off_blocks(employee_id)",
    "CREATE INDEX IF NOT EXISTS idx_profile_log_user ON profile_log(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_notification_log_sent ON notification_log(sent_at)",
    "CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id)",
  ];

  for (const sql of indexes) {
    try {
      sqlite.exec(sql);
    } catch {
      // ignore — table may not exist yet
    }
  }
}
