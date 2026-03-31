import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rawSqlite } from "../db/index.js";
import {
  ensureSlotRecoverySchema,
  getSlotRecoveryAdminSettings,
  listRecoveryDeliveryLogs,
  publishSlotRecoveryCancellationEvent,
  respondToRecoveryOffer,
  runSlotRecoveryEngine,
  updateSlotRecoveryAdminSettings,
} from "../services/slot-recovery.js";

const logShim = {
  info: (_m: string, _d?: unknown) => {},
  error: (_m: string, _e?: unknown) => {},
};

function hoursFromNowIso(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function resetTables(): void {
  rawSqlite.exec("PRAGMA foreign_keys = OFF;");
  rawSqlite.exec(`
    DELETE FROM slot_recovery_offers;
    DELETE FROM slot_recovery_delivery_log;
    DELETE FROM slot_recovery_queue;
    DELETE FROM slot_recovery_events;
    DELETE FROM client_recovery_profiles;
    DELETE FROM system_settings;
    DELETE FROM bookings_v2;
    DELETE FROM open_slots;
    DELETE FROM waitlist;
    DELETE FROM loyalty_points;
    DELETE FROM notifications;
    DELETE FROM users;
  `);
  rawSqlite.exec("PRAGMA foreign_keys = ON;");
}

describe("slot recovery engine", () => {
  beforeAll(() => {
    process.env.SLOT_RECOVERY_ENABLED = "true";
    process.env.SLOT_RECOVERY_MODE = "full-auto";
    process.env.SLOT_RECOVERY_DISCOUNT_HOURS = "12";
    process.env.SLOT_RECOVERY_MAX_OFFERS_PER_EVENT = "5";
    process.env.SLOT_RECOVERY_MAX_OFFERS_PER_CLIENT_DAY = "5";

    rawSqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT,
        name TEXT,
        role TEXT,
        is_active INTEGER DEFAULT 1,
        behavior_score REAL DEFAULT 100,
        email_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        push_enabled INTEGER DEFAULT 0,
        phone TEXT
      );
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY,
        name TEXT
      );
      CREATE TABLE IF NOT EXISTS waitlist (
        id INTEGER PRIMARY KEY,
        client_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        employee_id INTEGER,
        status TEXT NOT NULL DEFAULT 'WAITING',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        notified_at TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        points INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS open_slots (
        id INTEGER PRIMARY KEY,
        employee_id INTEGER NOT NULL,
        service_id INTEGER,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        booking_id INTEGER
      );
      CREATE TABLE IF NOT EXISTS bookings_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        note TEXT
      );
    `);
    ensureSlotRecoverySchema();
  });

  afterAll(() => {
    resetTables();
  });

  it("awards more points for full-price <=48h than discounted last-minute", async () => {
    resetTables();

    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, email_enabled) VALUES (1, 'src@test.cz', 'Cancelled Client', 'CLIENT', 80, 1)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, email_enabled) VALUES (2, 'emp@test.cz', 'Employee', 'EMPLOYEE', 100, 1)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, email_enabled, push_enabled) VALUES (3, 'cand1@test.cz', 'Candidate Full', 'CLIENT', 95, 1, 1)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, email_enabled, push_enabled) VALUES (4, 'cand2@test.cz', 'Candidate Discount', 'CLIENT', 95, 1, 1)").run();
    rawSqlite.prepare("INSERT OR IGNORE INTO services (id, name) VALUES (11, 'Masaz')").run();

    rawSqlite.prepare("INSERT INTO waitlist (id, client_id, service_id, employee_id, status) VALUES (101, 3, 11, 2, 'WAITING')").run();
    rawSqlite.prepare("INSERT INTO waitlist (id, client_id, service_id, employee_id, status) VALUES (102, 4, 11, 2, 'WAITING')").run();

    rawSqlite.prepare("INSERT INTO open_slots (id, employee_id, service_id, date, time, status) VALUES (501, 2, 11, '2099-01-01', '10:00', 'open')").run();
    rawSqlite.prepare("INSERT INTO open_slots (id, employee_id, service_id, date, time, status) VALUES (502, 2, 11, '2099-01-01', '12:00', 'open')").run();

    publishSlotRecoveryCancellationEvent({
      sourceModel: "bookings_v2",
      sourceId: 9001,
      slotId: 501,
      clientId: 1,
      employeeId: 2,
      serviceId: 11,
      startTime: hoursFromNowIso(24),
      cancelledBy: 1,
    });

    await runSlotRecoveryEngine(logShim);

    const fullOffer = rawSqlite.prepare(
      "SELECT id, client_id, reward_points, price_mode FROM slot_recovery_offers WHERE event_id = (SELECT id FROM slot_recovery_events WHERE source_id = 9001)"
    ).get() as { id: number; client_id: number; reward_points: number; price_mode: string };
    expect(fullOffer.price_mode).toBe("FULL");
    const accepted = respondToRecoveryOffer(fullOffer.client_id, fullOffer.id, "ACCEPT");
    expect(accepted.pointsAwarded).toBe(fullOffer.reward_points);

    publishSlotRecoveryCancellationEvent({
      sourceModel: "bookings_v2",
      sourceId: 9002,
      slotId: 502,
      clientId: 1,
      employeeId: 2,
      serviceId: 11,
      startTime: hoursFromNowIso(2),
      cancelledBy: 1,
    });

    await runSlotRecoveryEngine(logShim);
    const discountedOffer = rawSqlite.prepare(
      "SELECT reward_points, price_mode FROM slot_recovery_offers WHERE event_id = (SELECT id FROM slot_recovery_events WHERE source_id = 9002)"
    ).get() as { reward_points: number; price_mode: string };
    expect(discountedOffer.price_mode).toBe("DISCOUNTED_LAST_MINUTE");
    expect(fullOffer.reward_points).toBeGreaterThan(discountedOffer.reward_points);
  });

  it("supports admin setting updates with clamping and discount guard", () => {
    resetTables();

    const updated = updateSlotRecoveryAdminSettings({
      batchSize: 999,
      offerExpirationMin: 1,
      defaultDiscountPercent: 75,
      maxDiscountPercent: 30,
      pushOnly: true,
      mode: "full-auto",
    });

    expect(updated.batchSize).toBe(200); // clamped
    expect(updated.offerExpirationMin).toBe(5); // clamped
    expect(updated.maxDiscountPercent).toBe(30);
    expect(updated.defaultDiscountPercent).toBe(30); // corrected <= max
    expect(updated.pushOnly).toBe(true);

    const loaded = getSlotRecoveryAdminSettings();
    expect(loaded.defaultDiscountPercent).toBe(30);
    expect(loaded.maxDiscountPercent).toBe(30);
  });

  it("writes SENT delivery log for push delivery", async () => {
    resetTables();
    updateSlotRecoveryAdminSettings({
      enabled: true,
      mode: "full-auto",
      pushOnly: true,
      maxOffersPerClientDay: 5,
      maxOffersPerEvent: 5,
    });

    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, push_enabled) VALUES (1, 'src@test.cz', 'Cancelled Client', 'CLIENT', 80, 0)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, push_enabled) VALUES (2, 'emp@test.cz', 'Employee', 'EMPLOYEE', 100, 0)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, push_enabled) VALUES (3, 'cand@test.cz', 'Candidate Push', 'CLIENT', 95, 1)").run();
    rawSqlite.prepare("INSERT OR IGNORE INTO services (id, name) VALUES (11, 'Masaz')").run();
    rawSqlite.prepare("INSERT INTO waitlist (id, client_id, service_id, employee_id, status) VALUES (101, 3, 11, 2, 'WAITING')").run();
    rawSqlite.prepare("INSERT INTO open_slots (id, employee_id, service_id, date, time, status) VALUES (501, 2, 11, '2099-01-01', '10:00', 'open')").run();

    publishSlotRecoveryCancellationEvent({
      sourceModel: "bookings_v2",
      sourceId: 9101,
      slotId: 501,
      clientId: 1,
      employeeId: 2,
      serviceId: 11,
      startTime: hoursFromNowIso(24),
      cancelledBy: 1,
    });
    await runSlotRecoveryEngine(logShim);

    const logs = listRecoveryDeliveryLogs(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].channel).toBe("push");
    expect(logs[0].status).toBe("SENT");
  });

  it("writes FAILED delivery log when push-only and client has no push", async () => {
    resetTables();
    updateSlotRecoveryAdminSettings({
      enabled: true,
      mode: "full-auto",
      pushOnly: true,
      maxOffersPerClientDay: 5,
      maxOffersPerEvent: 5,
    });

    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, push_enabled, email_enabled, sms_enabled) VALUES (1, 'src@test.cz', 'Cancelled Client', 'CLIENT', 80, 0, 1, 1)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, push_enabled) VALUES (2, 'emp@test.cz', 'Employee', 'EMPLOYEE', 100, 0)").run();
    rawSqlite.prepare("INSERT INTO users (id, email, name, role, behavior_score, push_enabled, email_enabled, sms_enabled) VALUES (3, 'cand@test.cz', 'No Push Candidate', 'CLIENT', 95, 0, 1, 1)").run();
    rawSqlite.prepare("INSERT OR IGNORE INTO services (id, name) VALUES (11, 'Masaz')").run();
    rawSqlite.prepare("INSERT INTO waitlist (id, client_id, service_id, employee_id, status) VALUES (101, 3, 11, 2, 'WAITING')").run();
    rawSqlite.prepare("INSERT INTO open_slots (id, employee_id, service_id, date, time, status) VALUES (501, 2, 11, '2099-01-01', '10:00', 'open')").run();

    publishSlotRecoveryCancellationEvent({
      sourceModel: "bookings_v2",
      sourceId: 9102,
      slotId: 501,
      clientId: 1,
      employeeId: 2,
      serviceId: 11,
      startTime: hoursFromNowIso(24),
      cancelledBy: 1,
    });
    await runSlotRecoveryEngine(logShim);

    const logs = listRecoveryDeliveryLogs(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe("FAILED");
    expect(String(logs[0].error_message)).toContain("Push-only policy");
  });
});
