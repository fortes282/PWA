import Database from "better-sqlite3";
import { join } from "path";
import { createHash, randomBytes } from "crypto";

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), "data", "pristav.db");
const sqlite = new Database(DB_PATH);

function hashPassword(password: string): string {
  // Simple SHA-256 for seed — in production use bcrypt via plugin
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(password + salt).digest("hex");
  return `${salt}:${hash}`;
}

const seed = () => {
  console.log("▶ Seeding database...");

  const existing = sqlite.prepare("SELECT id FROM users LIMIT 1").get();
  if (existing) {
    console.log("ℹ️  Database already seeded — skipping");
    sqlite.close();
    return;
  }

  // Users
  sqlite.prepare(`
    INSERT INTO users (email, password_hash, name, role, behavior_score) VALUES
    ('admin@pristav.cz', ?, 'Admin', 'ADMIN', 100),
    ('recepce@pristav.cz', ?, 'Jana Nováková', 'RECEPTION', 100),
    ('terapeut@pristav.cz', ?, 'Mgr. Petr Dvořák', 'EMPLOYEE', 100),
    ('klient@pristav.cz', ?, 'Martin Svoboda', 'CLIENT', 85),
    ('klient2@pristav.cz', ?, 'Eva Procházková', 'CLIENT', 92)
  `).run(
    hashPassword("Admin123!"),
    hashPassword("Recepce123!"),
    hashPassword("Terapeut123!"),
    hashPassword("Klient123!"),
    hashPassword("Klient123!"),
  );

  // Services
  sqlite.prepare(`
    INSERT INTO services (name, description, duration_min, price) VALUES
    ('Neurorehabilitace', 'Individuální neurorehabilitační cvičení', 60, 1200),
    ('Konzultace', 'Vstupní konzultace s terapeutem', 30, 600),
    ('Skupinové cvičení', 'Skupinové rehabilitační cvičení', 90, 400),
    ('Fyzioterapie', 'Komplexní fyzioterapie', 60, 1000),
    ('Psychoterapie', 'Psychoterapeutické sezení', 50, 1500)
  `).run();

  // Rooms
  sqlite.prepare(`
    INSERT INTO rooms (name, description, capacity) VALUES
    ('Místnost A', 'Hlavní rehabilitační místnost', 2),
    ('Místnost B', 'Malá cvičebna', 1),
    ('Skupinová sál', 'Velký sál pro skupinová cvičení', 10),
    ('Konzultační pokoj', 'Privátní konzultační prostor', 1)
  `).run();

  // Working hours for employee (id=3) — Mon-Fri 8:00-16:00
  for (let day = 1; day <= 5; day++) {
    sqlite.prepare(`
      INSERT INTO working_hours (employee_id, day_of_week, start_time, end_time)
      VALUES (3, ?, '08:00', '16:00')
    `).run(day);
  }

  // Credit transactions for client (id=4)
  sqlite.prepare(`
    INSERT INTO credit_transactions (user_id, type, amount, balance, note)
    VALUES (4, 'PURCHASE', 5000, 5000, 'Počáteční kredit')
  `).run();

  // Credit for klient2 (id=5)
  sqlite.prepare(`
    INSERT INTO credit_transactions (user_id, type, amount, balance, note)
    VALUES (5, 'PURCHASE', 3000, 3000, 'Počáteční kredit')
  `).run();

  // Sample appointments — various states
  const now = new Date();

  // Tomorrow 10:00-11:00 — CONFIRMED
  const t1Start = new Date(now); t1Start.setDate(t1Start.getDate() + 1); t1Start.setHours(10, 0, 0, 0);
  const t1End = new Date(t1Start); t1End.setHours(11, 0, 0, 0);
  sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (4, 3, 1, 1, ?, ?, 'CONFIRMED', 1200, 1)`).run(t1Start.toISOString(), t1End.toISOString());

  // Tomorrow 14:00-14:30 — PENDING (not activated)
  const t2Start = new Date(now); t2Start.setDate(t2Start.getDate() + 1); t2Start.setHours(14, 0, 0, 0);
  const t2End = new Date(t2Start); t2End.setHours(14, 30, 0, 0);
  sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (5, 3, 2, 4, ?, ?, 'PENDING', 600, 0)`).run(t2Start.toISOString(), t2End.toISOString());

  // Yesterday 9:00-10:00 — COMPLETED
  const t3Start = new Date(now); t3Start.setDate(t3Start.getDate() - 1); t3Start.setHours(9, 0, 0, 0);
  const t3End = new Date(t3Start); t3End.setHours(10, 0, 0, 0);
  sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (4, 3, 4, 1, ?, ?, 'COMPLETED', 1000, 1)`).run(t3Start.toISOString(), t3End.toISOString());

  // 2 days ago 11:00-12:30 — CANCELLED
  const t4Start = new Date(now); t4Start.setDate(t4Start.getDate() - 2); t4Start.setHours(11, 0, 0, 0);
  const t4End = new Date(t4Start); t4End.setHours(12, 30, 0, 0);
  sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (5, 3, 3, 3, ?, ?, 'CANCELLED', 400, 1)`).run(t4Start.toISOString(), t4End.toISOString());

  // Day after tomorrow 8:00-8:50 — CONFIRMED
  const t5Start = new Date(now); t5Start.setDate(t5Start.getDate() + 2); t5Start.setHours(8, 0, 0, 0);
  const t5End = new Date(t5Start); t5End.setHours(8, 50, 0, 0);
  sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (4, 3, 5, 4, ?, ?, 'CONFIRMED', 1500, 1)`).run(t5Start.toISOString(), t5End.toISOString());

  // 3 days ago — NO_SHOW
  const t6Start = new Date(now); t6Start.setDate(t6Start.getDate() - 3); t6Start.setHours(15, 0, 0, 0);
  const t6End = new Date(t6Start); t6End.setHours(16, 0, 0, 0);
  sqlite.prepare(`INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (5, 3, 1, 1, ?, ?, 'NO_SHOW', 1200, 1)`).run(t6Start.toISOString(), t6End.toISOString());

  // Credit usage for completed appointment
  sqlite.prepare(`
    INSERT INTO credit_transactions (user_id, appointment_id, type, amount, balance, note)
    VALUES (4, 3, 'USE', -1000, 4000, 'Fyzioterapie')
  `).run();

  // Notifications
  sqlite.prepare(`
    INSERT INTO notifications (user_id, type, title, message) VALUES
    (4, 'APPOINTMENT_CONFIRMED', 'Termín potvrzen', 'Váš termín neurorehabilitace byl potvrzen.'),
    (4, 'APPOINTMENT_REMINDER', 'Připomínka termínu', 'Zítra máte termín v 10:00.'),
    (5, 'APPOINTMENT_CANCELLED', 'Termín zrušen', 'Vaše skupinové cvičení bylo zrušeno.')
  `).run();

  console.log("✅ Seed complete");
  console.log("   admin@pristav.cz / Admin123!");
  console.log("   recepce@pristav.cz / Recepce123!");
  console.log("   terapeut@pristav.cz / Terapeut123!");
  console.log("   klient@pristav.cz / Klient123!");
  console.log("   klient2@pristav.cz / Klient123!");

  sqlite.close();
};

seed();
