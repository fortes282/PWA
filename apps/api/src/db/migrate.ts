import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");

// Ensure data dir
mkdirSync(join(process.cwd(), "data"), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const migrate = () => {
  console.log("▶ Running migrations...");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CLIENT',
      phone TEXT,
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      behavior_score REAL NOT NULL DEFAULT 100,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      sms_enabled INTEGER NOT NULL DEFAULT 0,
      push_enabled INTEGER NOT NULL DEFAULT 0,
      push_subscription TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      duration_min INTEGER NOT NULL DEFAULT 60,
      price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      capacity INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      employee_id INTEGER NOT NULL REFERENCES users(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      room_id INTEGER REFERENCES rooms(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      price REAL,
      booking_activated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_id INTEGER REFERENCES appointments(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id),
      employee_id INTEGER REFERENCES users(id),
      preferred_dates TEXT,
      status TEXT NOT NULL DEFAULT 'WAITING',
      notified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'DRAFT',
      total REAL NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      paid_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medical_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id),
      employee_id INTEGER NOT NULL REFERENCES users(id),
      appointment_id INTEGER REFERENCES appointments(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      diagnosis TEXT,
      recommendations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS behavior_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      points REAL NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      changed_by INTEGER NOT NULL REFERENCES users(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fio_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      is_matched INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credit_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      reviewed_by INTEGER REFERENCES users(id),
      review_note TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_id INTEGER,
      target_type TEXT,
      details TEXT,
      ip TEXT,
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_employee ON appointments(employee_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_credit_user ON credit_transactions(user_id);
  `);

    // ── Schema migrations (add new columns safely) ──────────────────────────────
  // Migration 001: Add cancellation_reason to appointments (2026-03-16)
  const cols = sqlite.prepare("PRAGMA table_info(appointments)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "cancellation_reason")) {
    sqlite.exec(`ALTER TABLE appointments ADD COLUMN cancellation_reason TEXT`);
    console.log("▶ Migration 001: added cancellation_reason to appointments");
  }

  // Migration 002: Therapy templates + reports (2026-03-19)
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNames = tables.map((t) => t.name);

  if (!tableNames.includes("therapy_templates")) {
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
      );
    `);
    // Seed default templates
    const templates = [
      {
        name: "Vstupní vyšetření",
        category: "intake",
        structure: JSON.stringify([
          { id: "anamneza", label: "Anamnéza", type: "textarea", required: true },
          { id: "diagnoza", label: "Diagnóza", type: "text", required: true },
          { id: "objektivni_nalez", label: "Objektivní nález", type: "textarea", required: true },
          { id: "plan_terapie", label: "Plán terapie", type: "textarea", required: true },
        ]),
      },
      {
        name: "Průběžná zpráva",
        category: "progress",
        structure: JSON.stringify([
          { id: "subjektivni_hodnoceni", label: "Subjektivní hodnocení pacienta", type: "textarea", required: true },
          { id: "objektivni_nalez", label: "Objektivní nález", type: "textarea", required: true },
          { id: "terapie_provedena", label: "Terapie provedena", type: "textarea", required: true },
          { id: "plan", label: "Plán na příští sezení", type: "textarea", required: false },
        ]),
      },
      {
        name: "Závěrečná zpráva",
        category: "final",
        structure: JSON.stringify([
          { id: "shrnutí_terapie", label: "Shrnutí průběhu terapie", type: "textarea", required: true },
          { id: "vysledky", label: "Dosažené výsledky", type: "textarea", required: true },
          { id: "doporuceni", label: "Doporučení do budoucna", type: "textarea", required: false },
        ]),
      },
      {
        name: "Hodnocení kognitivních funkcí",
        category: "cognitive",
        structure: JSON.stringify([
          { id: "orientace", label: "Orientace", type: "scale", min: 1, max: 5, required: true },
          { id: "pamet", label: "Paměť", type: "scale", min: 1, max: 5, required: true },
          { id: "pozornost", label: "Pozornost", type: "scale", min: 1, max: 5, required: true },
          { id: "exekutivni_funkce", label: "Exekutivní funkce", type: "scale", min: 1, max: 5, required: true },
          { id: "poznamky", label: "Poznámky", type: "textarea", required: false },
        ]),
      },
    ];
    const insertTpl = sqlite.prepare(`INSERT INTO therapy_templates (name, category, structure) VALUES (?, ?, ?)`);
    for (const tpl of templates) {
      insertTpl.run(tpl.name, tpl.category, tpl.structure);
    }
    console.log("▶ Migration 002a: created therapy_templates + seeded 4 default templates");
  }

  if (!tableNames.includes("therapy_reports")) {
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
      );
    `);
    console.log("▶ Migration 002b: created therapy_reports");
  }

  // Migration booking-v2: new tables (2026-03-20)
  const tablesV2 = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  const tableNamesV2 = tablesV2.map((t) => t.name);

  if (!tableNamesV2.includes("work_schedule")) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS work_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        break_start TEXT,
        break_end TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS time_off_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'vacation',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS open_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        booking_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS bookings_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_id INTEGER NOT NULL REFERENCES open_slots(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'confirmed',
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        cancelled_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_open_slots_employee_date ON open_slots(employee_id, date);
      CREATE INDEX IF NOT EXISTS idx_open_slots_status ON open_slots(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_v2_client ON bookings_v2(client_id);
      CREATE INDEX IF NOT EXISTS idx_bookings_v2_slot ON bookings_v2(slot_id);
    `);
    console.log("▶ Migration booking-v2: created work_schedule, time_off_v2, open_slots, bookings_v2");
  }

  // Migration 003: TOTP 2FA columns on users (2026-03-21)
  const userCols = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userCols.some((c) => c.name === "totp_enabled")) {
    sqlite.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`);
    sqlite.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`);
    sqlite.exec(`ALTER TABLE users ADD COLUMN totp_backup_codes TEXT`);
    console.log("▶ Migration 003: added totp_enabled, totp_secret, totp_backup_codes to users");
  }

  // Migration 004: login_history table (2026-03-21)
  const tables003 = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
  if (!tables003.map((t) => t.name).includes("login_history")) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS login_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip TEXT,
        user_agent TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
    `);
    console.log("▶ Migration 004: created login_history");
  }

  // Migration 005: add remaining Drizzle schema columns to users (2026-03-21)
  // These columns exist in the Drizzle ORM schema (schema.ts) but were previously
  // only added by applyRuntimeMigrations() at first HTTP request — causing SELECT
  // failures if a login arrived before that hook ran. Adding them here ensures
  // db:migrate produces a fully schema-compliant database.
  const userCols005 = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const addIfMissing005 = (col: string, def: string) => {
    if (!userCols005.some((c) => c.name === col)) {
      sqlite.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`);
    }
  };
  let migration005Ran = false;
  if (!userCols005.some((c) => c.name === "insurance_company_id")) { addIfMissing005("insurance_company_id", "INTEGER"); migration005Ran = true; }
  if (!userCols005.some((c) => c.name === "insurance_number")) { addIfMissing005("insurance_number", "TEXT"); migration005Ran = true; }
  if (!userCols005.some((c) => c.name === "gdpr_health_consent_granted")) { addIfMissing005("gdpr_health_consent_granted", "INTEGER NOT NULL DEFAULT 0"); migration005Ran = true; }
  if (!userCols005.some((c) => c.name === "gdpr_health_consent_at")) { addIfMissing005("gdpr_health_consent_at", "TEXT"); migration005Ran = true; }
  if (!userCols005.some((c) => c.name === "gdpr_anonymized_at")) { addIfMissing005("gdpr_anonymized_at", "TEXT"); migration005Ran = true; }
  if (!userCols005.some((c) => c.name === "last_reengagement_at")) { addIfMissing005("last_reengagement_at", "TEXT"); migration005Ran = true; }
  if (migration005Ran) {
    console.log("▶ Migration 005: added missing Drizzle schema columns to users");
  }

  // Migration 006: Remove UNJUSTIFIED_CANCEL status (2026-03-29)
  // Remap existing rows to safe statuses before the enum is dropped from code.
  const hasUnjustified = sqlite.prepare(
    "SELECT COUNT(*) as cnt FROM appointments WHERE status = 'UNJUSTIFIED_CANCEL'"
  ).get() as { cnt: number };
  const hasUnjustifiedBooking = sqlite.prepare(
    "SELECT COUNT(*) as cnt FROM bookings_v2 WHERE status = 'unjustified_cancel'"
  ).get() as { cnt: number };
  const hasUnjustifiedEvent = sqlite.prepare(
    "SELECT COUNT(*) as cnt FROM behavior_events WHERE type = 'UNJUSTIFIED_CANCEL'"
  ).get() as { cnt: number };
  if (hasUnjustified.cnt > 0 || hasUnjustifiedBooking.cnt > 0 || hasUnjustifiedEvent.cnt > 0) {
    sqlite.exec(`
      UPDATE appointments SET status = 'COMPLETED' WHERE status = 'UNJUSTIFIED_CANCEL';
      UPDATE bookings_v2 SET status = 'completed' WHERE status = 'unjustified_cancel';
      UPDATE behavior_events SET type = 'LATE_CANCEL' WHERE type = 'UNJUSTIFIED_CANCEL';
      DELETE FROM system_settings WHERE key IN ('auto_processor_unjustified_cancel_last_run', 'unjustified_cancel_processor_last_run');
    `);
    console.log("▶ Migration 006: removed UNJUSTIFIED_CANCEL status from appointments, bookings_v2, behavior_events");
  }

  // Migration 007: Add cancellation columns to bookings_v2 (2026-03-31)
  const bookingCols = sqlite.prepare("PRAGMA table_info(bookings_v2)").all() as Array<{ name: string }>;
  if (!bookingCols.some((c) => c.name === "cancellation_type")) {
    sqlite.exec(`ALTER TABLE bookings_v2 ADD COLUMN cancellation_type TEXT`);
    sqlite.exec(`ALTER TABLE bookings_v2 ADD COLUMN cancellation_fee REAL`);
    sqlite.exec(`ALTER TABLE bookings_v2 ADD COLUMN invoice_item_id INTEGER`);
    console.log("▶ Migration 007: added cancellation_type, cancellation_fee, invoice_item_id to bookings_v2");
  }

  console.log("✅ Migrations complete");
  sqlite.close();
};

migrate();
