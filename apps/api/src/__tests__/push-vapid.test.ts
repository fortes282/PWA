/**
 * Integration tests — /push routes WITH VAPID configured
 *
 * These tests cover the happy-path where VAPID keys are set.
 * Because push.ts evaluates `vapidConfigured` at module-load time, we must
 * set env vars + call vi.resetModules() BEFORE dynamically importing the server,
 * so the fresh module sees the keys.
 *
 * All web-push calls are mocked — no real push delivery happens here.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ── Mock web-push (hoisted by Vitest before any module evaluation) ────────────
const mockSendNotification = vi.fn().mockResolvedValue({ statusCode: 201, body: "" });
const mockSetVapidDetails = vi.fn();

vi.mock("web-push", () => ({
  default: { sendNotification: mockSendNotification, setVapidDetails: mockSetVapidDetails },
  sendNotification: mockSendNotification,
  setVapidDetails: mockSetVapidDetails,
}));

// ── Example VAPID keys (safe to use in tests — these are NOT production keys) ─
const TEST_VAPID_PUBLIC = "BIb6q6_kpiixh5NSLgQUcIAYhzBmFHXWLNdozgxtWMF4yw4iqDfu7ApIQ4WTFI6SZLy2YVo4I3Byj6ZkfPIj-9c";
const TEST_VAPID_PRIVATE = "E0SO-d0liwq_G0iHI_YWmqh4WaTZzdHlRpZoXP8gcho";

const MIGRATION_SQL = `
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
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, duration_min INTEGER NOT NULL DEFAULT 60, price REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, capacity INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS working_hours (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS appointments (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, service_id INTEGER NOT NULL, room_id INTEGER, start_time TEXT NOT NULL, end_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, price REAL, booking_activated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, appointment_id INTEGER, type TEXT NOT NULL, amount REAL NOT NULL, balance REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, service_id INTEGER NOT NULL, employee_id INTEGER, preferred_dates TEXT, status TEXT NOT NULL DEFAULT 'WAITING', notified_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, metadata TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT NOT NULL UNIQUE, client_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT', total REAL NOT NULL DEFAULT 0, due_date TEXT NOT NULL, paid_at TEXT, notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS invoice_items (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_id INTEGER NOT NULL, description TEXT NOT NULL, quantity REAL NOT NULL DEFAULT 1, unit_price REAL NOT NULL, total REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS medical_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, appointment_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, diagnosis TEXT, recommendations TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS behavior_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL, points REAL NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS profile_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, changed_by INTEGER NOT NULL, field TEXT NOT NULL, old_value TEXT, new_value TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS fio_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, fio_id TEXT NOT NULL UNIQUE, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'CZK', variable_symbol TEXT, note TEXT, counter_account TEXT, counter_name TEXT, transaction_date TEXT NOT NULL, matched_invoice_id INTEGER, matched_client_id INTEGER, is_matched INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS health_records (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL UNIQUE, blood_type TEXT, allergies TEXT, contraindications TEXT, medications TEXT, chronic_conditions TEXT, emergency_contact_name TEXT, emergency_contact_phone TEXT, emergency_contact_relation TEXT, primary_diagnosis TEXT, functional_status TEXT, rehab_goals TEXT, notes TEXT, last_updated_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS credit_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, amount REAL NOT NULL, note TEXT, status TEXT NOT NULL DEFAULT 'PENDING', reviewed_by INTEGER, review_note TEXT, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
`;

let app: any;
let clientToken: string;
let clientId: number;
let sendPushNotification: (userId: number, notification: any) => Promise<boolean>;
let db: any;
let rawSqlite: any;
let usersTable: any;
let eq: any;

beforeAll(async () => {
  // Set VAPID + other env vars BEFORE dynamically importing the server,
  // so push.ts evaluates vapidConfigured = true on first load.
  process.env.JWT_SECRET = "test-secret-for-push-vapid-suite-min64chars!!!!!!!!!!!!!!!!";
  process.env.DATABASE_PATH = ":memory:";
  process.env.NODE_ENV = "test";
  process.env.VAPID_PUBLIC_KEY = TEST_VAPID_PUBLIC;
  process.env.VAPID_PRIVATE_KEY = TEST_VAPID_PRIVATE;
  process.env.VAPID_SUBJECT = "mailto:test@test.cz";

  // Reset module cache so server/push.ts re-evaluate with env vars above
  vi.resetModules();

  const serverMod = await import("../server.js");
  const dbMod = await import("../db/index.js");
  const schemaMod = await import("../db/schema.js");
  const hashMod = await import("../utils/hash.js");
  const pushMod = await import("../routes/push.js");
  const drizzleMod = await import("drizzle-orm");

  db = dbMod.db;
  rawSqlite = dbMod.rawSqlite;
  usersTable = schemaMod.users;
  eq = drizzleMod.eq;
  sendPushNotification = pushMod.sendPushNotification;

  app = await serverMod.buildApp({ logger: false });
  await app.ready();

  rawSqlite.exec(MIGRATION_SQL);

  const cliHash = await hashMod.hashPassword("Klient123!");
  const cliRes = db
    .insert(usersTable)
    .values({ email: "vapid-client@test.cz", passwordHash: cliHash, name: "VAPID Klient", role: "CLIENT" })
    .returning()
    .get();
  clientId = cliRes.id;

  clientToken = (
    await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "vapid-client@test.cz", password: "Klient123!" },
    })
  ).json().accessToken;
});

afterAll(async () => {
  await app?.close();
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
});

// ── GET /push/vapid-public-key with VAPID configured ─────────────────────────

describe("GET /push/vapid-public-key (VAPID configured)", () => {
  it("returns enabled:true and the public key when VAPID is configured", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/push/vapid-public-key",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.enabled).toBe(true);
    expect(body.publicKey).toBe(TEST_VAPID_PUBLIC);
  });
});

// ── POST /push/subscribe with VAPID configured ───────────────────────────────

describe("POST /push/subscribe (VAPID configured)", () => {
  const fakeSubscription = {
    endpoint: "https://fcm.googleapis.com/fcm/send/fake-vapid-test-endpoint",
    keys: { p256dh: "BKh5x7PdQ2kj3FkKlmnO4p5r6S7", auth: "abc123def456" },
  };

  it("returns 200 and saves subscription to DB when VAPID is configured", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/push/subscribe",
      headers: { authorization: `Bearer ${clientToken}`, "content-type": "application/json" },
      payload: fakeSubscription,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // Verify the subscription was persisted
    const [updatedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, clientId))
      .limit(1);
    expect(updatedUser.pushEnabled).toBe(true);
    expect(updatedUser.pushSubscription).toBeTruthy();
    const saved = JSON.parse(updatedUser.pushSubscription);
    expect(saved.endpoint).toBe(fakeSubscription.endpoint);
  });
});

// ── POST /push/test with subscription seeded ─────────────────────────────────

describe("POST /push/test (VAPID configured + subscription exists)", () => {
  beforeAll(async () => {
    // Ensure user has a subscription from the subscribe test above (or re-seed)
    await db.update(usersTable)
      .set({
        pushEnabled: true,
        pushSubscription: JSON.stringify({
          endpoint: "https://fcm.googleapis.com/fcm/send/fake-vapid-test-endpoint",
          keys: { p256dh: "BKh5x7PdQ2kj3FkKlmnO4p5r6S7", auth: "abc123def456" },
        }),
      })
      .where(eq(usersTable.id, clientId));
    mockSendNotification.mockClear();
  });

  it("returns sent:true and vapidConfigured:true and calls web-push", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/push/test",
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.vapidConfigured).toBe(true);
    expect(body.sent).toBe(true);
    expect(mockSendNotification).toHaveBeenCalledOnce();
    const [sub, payload] = mockSendNotification.mock.calls[0];
    expect(sub.endpoint).toContain("fcm.googleapis.com");
    const parsed = JSON.parse(payload);
    expect(parsed.title).toBe("Test notifikace");
  });
});

// ── sendPushNotification helper with VAPID + subscription ────────────────────

describe("sendPushNotification helper (VAPID configured)", () => {
  beforeAll(async () => {
    mockSendNotification.mockClear();
  });

  it("returns true and calls webpush.sendNotification when user has subscription", async () => {
    const result = await sendPushNotification(clientId, {
      title: "Direct helper test",
      body: "Sent via helper",
    });
    expect(result).toBe(true);
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("returns false when user has no subscription", async () => {
    // Clear subscription
    await db.update(usersTable)
      .set({ pushEnabled: false, pushSubscription: null })
      .where(eq(usersTable.id, clientId));
    mockSendNotification.mockClear();

    const result = await sendPushNotification(clientId, { title: "No sub", body: "Should fail" });
    expect(result).toBe(false);
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("clears subscription on HTTP 410 (expired subscription)", async () => {
    // Re-seed subscription, then make sendNotification throw 410
    await db.update(usersTable)
      .set({
        pushEnabled: true,
        pushSubscription: JSON.stringify({
          endpoint: "https://expired.example.com/push",
          keys: { p256dh: "key", auth: "auth" },
        }),
      })
      .where(eq(usersTable.id, clientId));

    mockSendNotification.mockRejectedValueOnce(
      Object.assign(new Error("Gone"), { statusCode: 410 })
    );

    const result = await sendPushNotification(clientId, { title: "Expired", body: "Gone" });
    expect(result).toBe(false);

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, clientId)).limit(1);
    expect(user.pushEnabled).toBe(false);
    expect(user.pushSubscription).toBeNull();
  });
});
