import Database from "better-sqlite3";
import { join } from "path";
import { createHash, randomBytes } from "crypto";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");
const sqlite = new Database(DB_PATH);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

function d(daysOffset: number, hour: number, minute = 0): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysOffset);
  dt.setHours(hour, minute, 0, 0);
  return dt.toISOString();
}

const seed = () => {
  console.log("▶ Seeding database...");

  const existing = sqlite.prepare("SELECT id FROM users LIMIT 1").get();
  if (existing) {
    console.log("ℹ️  Database already seeded — skipping");
    sqlite.close();
    return;
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO users (email, password_hash, name, role, phone, behavior_score) VALUES
    ('admin@pristav.cz',      ?, 'Admin Správce',       'ADMIN',     '+420 601 000 001', 100),
    ('recepce@pristav.cz',    ?, 'Jana Nováková',        'RECEPTION', '+420 601 000 002', 100),
    ('terapeut@pristav.cz',   ?, 'Mgr. Petr Dvořák',   'EMPLOYEE',  '+420 601 000 003', 100),
    ('terapeut2@pristav.cz',  ?, 'Bc. Lucie Horáková',  'EMPLOYEE',  '+420 601 000 004', 100),
    ('klient@pristav.cz',     ?, 'Martin Svoboda',       'CLIENT',    '+420 601 100 001', 85),
    ('klient2@pristav.cz',    ?, 'Eva Procházková',      'CLIENT',    '+420 601 100 002', 92),
    ('klient3@pristav.cz',    ?, 'Tomáš Kratochvíl',    'CLIENT',    '+420 601 100 003', 100),
    ('klient4@pristav.cz',    ?, 'Petra Krejčí',         'CLIENT',    '+420 601 100 004', 70)
  `).run(
    hashPassword("Admin123!"),
    hashPassword("Recepce123!"),
    hashPassword("Terapeut123!"),
    hashPassword("Terapeut123!"),
    hashPassword("Klient123!"),
    hashPassword("Klient123!"),
    hashPassword("Klient123!"),
    hashPassword("Klient123!"),
  );
  // userId mapping: 1=admin, 2=recepce, 3=terapeut, 4=terapeut2, 5=klient, 6=klient2, 7=klient3, 8=klient4

  // ── Services ───────────────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO services (name, description, duration_min, price) VALUES
    ('Neurorehabilitace',     'Individuální neurorehabilitační cvičení', 60, 1200),
    ('Vstupní konzultace',    'Vstupní konzultace s terapeutem',         30,  600),
    ('Skupinové cvičení',     'Skupinové rehabilitační cvičení',         90,  400),
    ('Fyzioterapie',          'Komplexní fyzioterapie',                  60, 1000),
    ('Psychoterapie',         'Psychoterapeutické sezení',               50, 1500),
    ('Ergoterapie',           'Pracovní a funkční rehabilitace',         60, 1100),
    ('Logopedie',             'Řečová terapie a komunikace',             45,  900)
  `).run();

  // ── Rooms ─────────────────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO rooms (name, description, capacity, is_active) VALUES
    ('Rehabilitační sál A',  'Cvičební stroje, žíněnky, závěsy', 4, 1),
    ('Terapeutická místnost 1', 'Lehátko, terapeutické pomůcky', 2, 1),
    ('Terapeutická místnost 2', 'Lehátko, elektroterapie', 2, 1),
    ('Skupinový sál',        'Velká cvičební plocha, hudba', 10, 1)
  `).run();

  // ── Working hours (Mon–Fri 08:00–18:00) ───────────────────────────────────
  for (const empId of [3, 4]) {
    for (let day = 1; day <= 5; day++) {
      sqlite.prepare(`
        INSERT INTO working_hours (employee_id, day_of_week, start_time, end_time, is_active)
        VALUES (?, ?, '08:00', '18:00', 1)
      `).run(empId, day);
    }
  }

  // ── Appointments ─────────────────────────────────────────────────────────
  const appt = (clientId: number, empId: number, svcId: number, roomId: number, startIso: string, endIso: string, status: string, price: number, activated = 1) => {
    sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(clientId, empId, svcId, roomId, startIso, endIso, status, price, activated);
  };

  // TODAY — various clients + therapists (for day timeline showcase)
  appt(5, 3, 1, 1, d(0, 8), d(0, 9), "CONFIRMED", 1200);
  appt(6, 3, 4, 2, d(0, 9, 30), d(0, 10, 30), "CONFIRMED", 1000);
  appt(7, 3, 2, 2, d(0, 11), d(0, 11, 30), "CONFIRMED", 600);
  appt(8, 4, 6, 1, d(0, 9), d(0, 10), "CONFIRMED", 1100);
  appt(5, 4, 5, 3, d(0, 13), d(0, 13, 50), "CONFIRMED", 1500);
  appt(6, 4, 7, 3, d(0, 14, 30), d(0, 15, 15), "PENDING", 900, 0);
  appt(7, 3, 3, 4, d(0, 15, 30), d(0, 17), "CONFIRMED", 400);

  // TOMORROW
  appt(5, 3, 1, 1, d(1, 10), d(1, 11), "CONFIRMED", 1200);
  appt(6, 3, 2, 2, d(1, 14), d(1, 14, 30), "PENDING", 600, 0);
  appt(8, 4, 4, 1, d(1, 9), d(1, 10), "CONFIRMED", 1000);

  // DAY AFTER TOMORROW
  appt(5, 4, 5, 3, d(2, 8), d(2, 8, 50), "CONFIRMED", 1500);
  appt(7, 3, 6, 2, d(2, 10), d(2, 11), "CONFIRMED", 1100);

  // +3 DAYS
  appt(6, 3, 1, 1, d(3, 11), d(3, 12), "CONFIRMED", 1200);
  appt(8, 4, 7, 3, d(3, 14), d(3, 14, 45), "PENDING", 900, 0);

  // PAST — COMPLETED (last 14 days, for stats chart)
  for (let i = 1; i <= 14; i++) {
    if (i % 7 === 0) continue; // skip weekends roughly
    appt(5, 3, 1, 1, d(-i, 9),     d(-i, 10),    "COMPLETED", 1200);
    appt(6, 4, 4, 2, d(-i, 10, 30), d(-i, 11, 30), "COMPLETED", 1000);
    if (i % 2 === 0) appt(7, 3, 2, 2, d(-i, 13), d(-i, 13, 30), "COMPLETED", 600);
    if (i % 3 === 0) appt(8, 4, 5, 3, d(-i, 14), d(-i, 14, 50), i % 6 === 0 ? "NO_SHOW" : "COMPLETED", 1500);
  }

  // PAST — NO_SHOW & CANCELLED
  appt(5, 3, 1, 1, d(-4, 15), d(-4, 16), "NO_SHOW", 1200);
  appt(6, 3, 3, 4, d(-5, 11), d(-5, 12, 30), "CANCELLED", 400);
  appt(8, 4, 6, 1, d(-7, 10), d(-7, 11), "CANCELLED", 1100);

  // ── Credits ───────────────────────────────────────────────────────────────
  const credTx = (userId: number, type: string, amount: number, balance: number, note: string) => {
    sqlite.prepare(`INSERT INTO credit_transactions (user_id, type, amount, balance, note) VALUES (?, ?, ?, ?, ?)`).run(userId, type, amount, balance, note);
  };
  // Client 5 — Martin Svoboda
  credTx(5, "PURCHASE", 5000, 5000, "Nákup kreditů");
  credTx(5, "USE", -1200, 3800, "Neurorehabilitace");
  credTx(5, "USE", -1000, 2800, "Fyzioterapie");
  credTx(5, "USE", -1500, 1300, "Psychoterapie");
  credTx(5, "PURCHASE", 3000, 4300, "Nákup kreditů");
  // Client 6 — Eva Procházková
  credTx(6, "PURCHASE", 8000, 8000, "Nákup kreditů — balíček");
  credTx(6, "USE", -1000, 7000, "Fyzioterapie");
  credTx(6, "USE", -600, 6400, "Konzultace");
  // Client 7 — Tomáš Kratochvíl
  credTx(7, "PURCHASE", 3000, 3000, "Nákup kreditů");
  credTx(7, "USE", -600, 2400, "Konzultace");
  // Client 8 — Petra Krejčí
  credTx(8, "PURCHASE", 5000, 5000, "Nákup kreditů");
  credTx(8, "USE", -1100, 3900, "Ergoterapie");

  // ── Notifications ──────────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO notifications (user_id, type, title, message) VALUES
    (5, 'APPOINTMENT_CONFIRMED', 'Termín potvrzen',   'Váš termín neurorehabilitace byl potvrzen.'),
    (5, 'APPOINTMENT_REMINDER',  'Připomínka termínu','Dnes máte termín v 08:00.'),
    (6, 'APPOINTMENT_CONFIRMED', 'Termín potvrzen',   'Váš termín fyzioterapie byl potvrzen.'),
    (6, 'WAITLIST_AVAILABLE',    'Volný termín',       'Uvolnil se termín pro skupinové cvičení.'),
    (7, 'APPOINTMENT_CONFIRMED', 'Termín potvrzen',   'Váš termín ergoterapie byl potvrzen.'),
    (8, 'APPOINTMENT_CANCELLED', 'Termín zrušen',     'Vaše skupinové cvičení bylo přesunuto.')
  `).run();

  // ── Waitlist ──────────────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO waitlist (client_id, service_id, employee_id, preferred_dates, status) VALUES
    (8, 1, 3, '["2026-03-16","2026-03-17"]', 'WAITING'),
    (7, 5, NULL, NULL, 'WAITING'),
    (6, 3, NULL, NULL, 'NOTIFIED')
  `).run();

  // ── Health records ────────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO health_records
      (client_id, blood_type, allergies, contraindications, medications, chronic_conditions,
       primary_diagnosis, functional_status, rehab_goals,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
       notes, last_updated_by)
    VALUES
    (5, 'A+', 'Penicilin', NULL, 'Warfarin 5mg/den', 'Hypertenze',
     'CMP — ischemická cévní mozková příhoda, 06/2024',
     'Levostranná hemiparéza, chůze s oporou, zachovaná řeč',
     'Obnova samostatné chůze, zlepšení jemné motoriky levé ruky',
     'Marie Svobodová', '+420 601 200 001', 'Manželka',
     'Alergie na penicilin — DŮLEŽITÉ. Antikoagulační léčba.', 2),
    (6, 'B+', NULL, 'Elektroterapie kontraindikována — kardiostimulátor', NULL, 'Roztroušená skleróza',
     'Relabující-remitující roztroušená skleróza (RRMS)',
     'Ambulantní pacientka, minimální funkční deficit, dobrá compliance',
     'Prevence relapsů, udržení kondice a funkčnosti',
     'Pavel Procházek', '+420 601 200 002', 'Manžel',
     'Kardiostimulátor! Bez elektroterapie.', 2)
  `).run();

  // ── Behavior records ──────────────────────────────────────────────────────
  sqlite.prepare(`
    INSERT INTO behavior_events (user_id, type, note, points) VALUES
    (5, 'NO_SHOW', 'Nedostavil se dne ${new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10)}', -15),
    (6, 'ON_TIME', 'Dochvilná docházka', 0),
    (8, 'LATE_CANCEL', 'Zrušení méně než 24h předem', -10)
  `).run();

  console.log("✅ Seed complete — přihlašovací údaje:");
  console.log("   admin@pristav.cz / Admin123!");
  console.log("   recepce@pristav.cz / Recepce123!");
  console.log("   terapeut@pristav.cz / Terapeut123!");
  console.log("   terapeut2@pristav.cz / Terapeut123!");
  console.log("   klient@pristav.cz / Klient123!");
  console.log("   klient2@pristav.cz / Klient123!");
  console.log("   klient3@pristav.cz / Klient123!");
  console.log("   klient4@pristav.cz / Klient123!");

  sqlite.close();
};

seed();
