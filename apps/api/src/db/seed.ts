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
    hashPassword("admin123"),
    hashPassword("recepce123"),
    hashPassword("terapeut123"),
    hashPassword("klient123"),
    hashPassword("klient123"),
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

  // Sample appointment
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setHours(11, 0, 0, 0);

  sqlite.prepare(`
    INSERT INTO appointments (client_id, employee_id, service_id, room_id, start_time, end_time, status, price, booking_activated)
    VALUES (4, 3, 1, 1, ?, ?, 'CONFIRMED', 1200, 1)
  `).run(tomorrow.toISOString(), end.toISOString());

  console.log("✅ Seed complete");
  console.log("   admin@pristav.cz / admin123");
  console.log("   recepce@pristav.cz / recepce123");
  console.log("   terapeut@pristav.cz / terapeut123");
  console.log("   klient@pristav.cz / klient123");

  sqlite.close();
};

seed();
