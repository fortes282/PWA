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
    // Seed default templates
    const tcount = (sqlite.prepare("SELECT COUNT(*) as n FROM therapy_templates").get() as any).n;
    if (tcount === 0) {
      const templates = [
        {
          name: "Vstupní vyšetření",
          category: "intake",
          structure: JSON.stringify({
            sections: [
              {
                id: "personal", title: "Osobní údaje",
                fields: [
                  { id: "clientName", label: "Jméno klienta", type: "autofill", source: "clientName" },
                  { id: "birthDate", label: "Datum narození", type: "autofill", source: "birthDate" },
                  { id: "diagnosis", label: "Diagnóza", type: "autofill", source: "primaryDiagnosis" },
                  { id: "referringDoctor", label: "Odesílající lékař", type: "text" },
                ]
              },
              {
                id: "anamnesis", title: "Anamnéza",
                fields: [
                  { id: "personalHistory", label: "Osobní anamnéza", type: "textarea" },
                  { id: "familyHistory", label: "Rodinná anamnéza", type: "textarea" },
                  { id: "medications", label: "Aktuální medikace", type: "autofill", source: "medications" },
                  { id: "allergies", label: "Alergie", type: "autofill", source: "allergies" },
                ]
              },
              {
                id: "examination", title: "Vstupní vyšetření",
                fields: [
                  { id: "orientation", label: "Orientace (místo/čas/osoba)", type: "select", options: ["Plně orientován/a", "Částečně dezorientován/a", "Dezorientován/a"] },
                  { id: "mobility", label: "Mobilita", type: "select", options: ["Plně mobilní", "S dopomocí", "Imobilní"] },
                  { id: "cognitiveStatus", label: "Kognitivní stav", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "Bez poruchy" },
                  { id: "emotionalStatus", label: "Emoční stav", type: "textarea" },
                  { id: "findings", label: "Nálezy", type: "textarea" },
                ]
              },
              {
                id: "plan", title: "Plán terapie",
                fields: [
                  { id: "goals", label: "Terapeutické cíle", type: "textarea" },
                  { id: "frequency", label: "Frekvence sezení", type: "text" },
                  { id: "methods", label: "Terapeutické metody", type: "checkbox_group", options: ["Kognitivní rehabilitace", "Fyzioterapie", "Ergoterapie", "Logopedie", "Psychoterapie", "Skupinová terapie"] },
                  { id: "nextAppointment", label: "Datum dalšího sezení", type: "autofill", source: "nextAppointment" },
                ]
              },
              {
                id: "signature", title: "Závěr",
                fields: [
                  { id: "therapistName", label: "Terapeut", type: "autofill", source: "therapistName" },
                  { id: "date", label: "Datum", type: "autofill", source: "today" },
                  { id: "notes", label: "Poznámky", type: "textarea" },
                ]
              }
            ]
          })
        },
        {
          name: "Průběžná zpráva",
          category: "progress",
          structure: JSON.stringify({
            sections: [
              {
                id: "header", title: "Záhlaví",
                fields: [
                  { id: "clientName", label: "Klient", type: "autofill", source: "clientName" },
                  { id: "therapistName", label: "Terapeut", type: "autofill", source: "therapistName" },
                  { id: "date", label: "Datum sezení", type: "autofill", source: "today" },
                  { id: "sessionNumber", label: "Číslo sezení", type: "number" },
                ]
              },
              {
                id: "progress", title: "Průběh sezení",
                fields: [
                  { id: "attendance", label: "Docházka", type: "select", options: ["Přítomen/přítomna", "Omluvená absence", "Neomluvená absence"] },
                  { id: "mood", label: "Nálada klienta (1–10)", type: "scale", min: 1, max: 10, label_min: "Velmi špatná", label_max: "Výborná" },
                  { id: "cooperation", label: "Spolupráce", type: "select", options: ["Výborná", "Dobrá", "Průměrná", "Problematická"] },
                  { id: "activities", label: "Aktivity sezení", type: "textarea" },
                  { id: "observations", label: "Pozorování a výsledky", type: "textarea" },
                ]
              },
              {
                id: "goals", title: "Cíle a pokrok",
                fields: [
                  { id: "goalProgress", label: "Pokrok v plnění cílů", type: "scale", min: 0, max: 100, label_min: "0%", label_max: "100%" },
                  { id: "achievedGoals", label: "Splněné cíle", type: "textarea" },
                  { id: "barriers", label: "Překážky", type: "textarea" },
                  { id: "planAdjustment", label: "Úprava plánu terapie", type: "textarea" },
                ]
              },
              {
                id: "next", title: "Plán",
                fields: [
                  { id: "nextGoals", label: "Cíle pro příští sezení", type: "textarea" },
                  { id: "homework", label: "Domácí úkoly", type: "textarea" },
                  { id: "notes", label: "Poznámky", type: "textarea" },
                ]
              }
            ]
          })
        },
        {
          name: "Závěrečná zpráva",
          category: "final",
          structure: JSON.stringify({
            sections: [
              {
                id: "header", title: "Záhlaví",
                fields: [
                  { id: "clientName", label: "Klient", type: "autofill", source: "clientName" },
                  { id: "therapistName", label: "Terapeut", type: "autofill", source: "therapistName" },
                  { id: "startDate", label: "Datum zahájení terapie", type: "text" },
                  { id: "endDate", label: "Datum ukončení terapie", type: "autofill", source: "today" },
                  { id: "totalSessions", label: "Celkový počet sezení", type: "number" },
                ]
              },
              {
                id: "summary", title: "Shrnutí terapie",
                fields: [
                  { id: "diagnosis", label: "Diagnóza", type: "autofill", source: "primaryDiagnosis" },
                  { id: "initialStatus", label: "Vstupní stav", type: "textarea" },
                  { id: "finalStatus", label: "Výstupní stav", type: "textarea" },
                  { id: "treatmentMethods", label: "Použité metody", type: "textarea" },
                ]
              },
              {
                id: "outcomes", title: "Výsledky",
                fields: [
                  { id: "goalsAchieved", label: "Splněné cíle", type: "checkbox_group", options: ["Zlepšení kognice", "Zlepšení mobility", "Zlepšení komunikace", "Sociální reintegrace", "Snížení bolesti", "Zlepšení ADL"] },
                  { id: "overallOutcome", label: "Celkový výsledek", type: "select", options: ["Výrazné zlepšení", "Mírné zlepšení", "Beze změny", "Zhoršení"] },
                  { id: "patientSatisfaction", label: "Spokojenost klienta (1–10)", type: "scale", min: 1, max: 10, label_min: "Nespokojen/a", label_max: "Velmi spokojen/a" },
                  { id: "outcomeDetails", label: "Komentář k výsledkům", type: "textarea" },
                ]
              },
              {
                id: "recommendations", title: "Doporučení",
                fields: [
                  { id: "followUp", label: "Doporučení pro další péči", type: "textarea" },
                  { id: "referral", label: "Doporučení ke specialistovi", type: "text" },
                  { id: "homeProgram", label: "Domácí program", type: "textarea" },
                  { id: "notes", label: "Poznámky", type: "textarea" },
                ]
              }
            ]
          })
        },
        {
          name: "Hodnocení kognitivních funkcí",
          category: "cognitive",
          structure: JSON.stringify({
            sections: [
              {
                id: "header", title: "Záhlaví",
                fields: [
                  { id: "clientName", label: "Klient", type: "autofill", source: "clientName" },
                  { id: "therapistName", label: "Terapeut", type: "autofill", source: "therapistName" },
                  { id: "date", label: "Datum hodnocení", type: "autofill", source: "today" },
                  { id: "diagnosis", label: "Diagnóza", type: "autofill", source: "primaryDiagnosis" },
                ]
              },
              {
                id: "memory", title: "Paměť",
                fields: [
                  { id: "shortTermMemory", label: "Krátkodobá paměť (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "longTermMemory", label: "Dlouhodobá paměť (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "workingMemory", label: "Pracovní paměť (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "memoryNotes", label: "Poznámky k paměti", type: "textarea" },
                ]
              },
              {
                id: "attention", title: "Pozornost a soustředění",
                fields: [
                  { id: "sustainedAttention", label: "Udržení pozornosti (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "dividedAttention", label: "Rozdělená pozornost (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "attentionNotes", label: "Poznámky k pozornosti", type: "textarea" },
                ]
              },
              {
                id: "executive", title: "Exekutivní funkce",
                fields: [
                  { id: "planning", label: "Plánování (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "problemSolving", label: "Řešení problémů (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "flexibility", label: "Kognitivní flexibilita (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "executiveNotes", label: "Poznámky", type: "textarea" },
                ]
              },
              {
                id: "language", title: "Řeč a komunikace",
                fields: [
                  { id: "comprehension", label: "Porozumění řeči (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "expression", label: "Produkce řeči (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "reading", label: "Čtení (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "writing", label: "Psaní (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "languageNotes", label: "Poznámky k řeči", type: "textarea" },
                ]
              },
              {
                id: "summary", title: "Celkové hodnocení",
                fields: [
                  { id: "overallScore", label: "Celkové kognitivní hodnocení (0–10)", type: "scale", min: 0, max: 10, label_min: "Těžká porucha", label_max: "V normě" },
                  { id: "comparedToPrevious", label: "Porovnání s předchozím hodnocením", type: "select", options: ["Výrazné zlepšení", "Mírné zlepšení", "Beze změny", "Mírné zhoršení", "Výrazné zhoršení", "První hodnocení"] },
                  { id: "recommendations", label: "Doporučení pro terapii", type: "textarea" },
                  { id: "notes", label: "Závěrečné poznámky", type: "textarea" },
                ]
              }
            ]
          })
        }
      ];
      for (const t of templates) {
        sqlite.prepare(`
          INSERT INTO therapy_templates (name, category, structure) VALUES (?, ?, ?)
        `).run(t.name, t.category, t.structure);
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

    // Login history
    "CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_login_history_created ON login_history(created_at)",
  ];

  for (const sql of indexes) {
    try {
      sqlite.exec(sql);
    } catch {
      // ignore — table may not exist yet
    }
  }
}
