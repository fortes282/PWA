import { randomBytes } from "crypto";
import { rawSqlite } from "../db/index.js";
import { sendEmail } from "./email.js";
import { sendSms } from "./sms.js";
import { sendPushNotification } from "../routes/push.js";

type LogShim = { info: (m: string, d?: unknown) => void; error: (m: string, e?: unknown) => void };

type SlotRecoveryAdminSettings = {
  enabled: boolean;
  mode: "full-auto" | "dry-run";
  pushOnly: boolean;
  batchSize: number;
  offerExpirationMin: number;
  discountHours: number;
  maxOffersPerEvent: number;
  maxOffersPerClientDay: number;
  clientCooldownHours: number;
  defaultDiscountPercent: number;
  maxDiscountPercent: number;
};

const SETTINGS_KEY_MAP = {
  enabled: "slot_recovery_enabled",
  mode: "slot_recovery_mode",
  pushOnly: "slot_recovery_push_only",
  batchSize: "slot_recovery_batch_size",
  offerExpirationMin: "slot_recovery_offer_expiration_min",
  discountHours: "slot_recovery_discount_hours",
  maxOffersPerEvent: "slot_recovery_max_offers_per_event",
  maxOffersPerClientDay: "slot_recovery_max_offers_per_client_day",
  clientCooldownHours: "slot_recovery_client_cooldown_hours",
  defaultDiscountPercent: "slot_recovery_default_discount_percent",
  maxDiscountPercent: "slot_recovery_max_discount_percent",
} as const;

export type CancellationEventInput = {
  sourceModel: "appointments" | "bookings_v2" | "cancellations";
  sourceId: number;
  appointmentId?: number | null;
  slotId?: number | null;
  clientId: number;
  employeeId: number | null;
  serviceId: number | null;
  startTime: string;
  endTime?: string | null;
  cancellationReason?: string | null;
  cancelledBy: number | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toIsoFromSqliteDateTime(value: string): string {
  if (value.includes("T")) return value;
  return `${value.replace(" ", "T")}Z`;
}

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function readSettingValue(key: string): string | null {
  const row = rawSqlite.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function getSettingInt(key: string, fallback: number): number {
  const raw = readSettingValue(key);
  if (raw == null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getSettingBool(key: string, fallback: boolean): boolean {
  const raw = readSettingValue(key);
  if (raw == null) return fallback;
  const norm = raw.toLowerCase();
  if (["1", "true", "yes", "on"].includes(norm)) return true;
  if (["0", "false", "no", "off"].includes(norm)) return false;
  return fallback;
}

function getSettingMode(key: string, fallback: "full-auto" | "dry-run"): "full-auto" | "dry-run" {
  const raw = readSettingValue(key);
  if (raw === "dry-run") return "dry-run";
  if (raw === "full-auto") return "full-auto";
  return fallback;
}

function getSlotRecoveryAdminSettingsInternal(): SlotRecoveryAdminSettings {
  const envMode = (process.env.SLOT_RECOVERY_MODE ?? "").toLowerCase() === "dry-run" ? "dry-run" : "full-auto";
  const defaults: SlotRecoveryAdminSettings = {
    enabled: isEnabled(),
    mode: envMode,
    pushOnly: true,
    batchSize: getEnvInt("SLOT_RECOVERY_BATCH_SIZE", 25),
    offerExpirationMin: getEnvInt("SLOT_RECOVERY_OFFER_EXPIRATION_MIN", 20),
    discountHours: getEnvInt("SLOT_RECOVERY_DISCOUNT_HOURS", 12),
    maxOffersPerEvent: getEnvInt("SLOT_RECOVERY_MAX_OFFERS_PER_EVENT", 6),
    maxOffersPerClientDay: getEnvInt("SLOT_RECOVERY_MAX_OFFERS_PER_CLIENT_DAY", 4),
    clientCooldownHours: getEnvInt("SLOT_RECOVERY_CLIENT_COOLDOWN_HOURS", 6),
    defaultDiscountPercent: getEnvInt("SLOT_RECOVERY_DEFAULT_DISCOUNT_PERCENT", 20),
    maxDiscountPercent: getEnvInt("SLOT_RECOVERY_MAX_DISCOUNT_PERCENT", 30),
  };

  const settings: SlotRecoveryAdminSettings = {
    enabled: getSettingBool(SETTINGS_KEY_MAP.enabled, defaults.enabled),
    mode: getSettingMode(SETTINGS_KEY_MAP.mode, defaults.mode),
    pushOnly: getSettingBool(SETTINGS_KEY_MAP.pushOnly, defaults.pushOnly),
    batchSize: clampInt(getSettingInt(SETTINGS_KEY_MAP.batchSize, defaults.batchSize), 1, 200),
    offerExpirationMin: clampInt(getSettingInt(SETTINGS_KEY_MAP.offerExpirationMin, defaults.offerExpirationMin), 5, 180),
    discountHours: clampInt(getSettingInt(SETTINGS_KEY_MAP.discountHours, defaults.discountHours), 1, 48),
    maxOffersPerEvent: clampInt(getSettingInt(SETTINGS_KEY_MAP.maxOffersPerEvent, defaults.maxOffersPerEvent), 1, 25),
    maxOffersPerClientDay: clampInt(getSettingInt(SETTINGS_KEY_MAP.maxOffersPerClientDay, defaults.maxOffersPerClientDay), 1, 20),
    clientCooldownHours: clampInt(getSettingInt(SETTINGS_KEY_MAP.clientCooldownHours, defaults.clientCooldownHours), 1, 72),
    defaultDiscountPercent: clampInt(getSettingInt(SETTINGS_KEY_MAP.defaultDiscountPercent, defaults.defaultDiscountPercent), 0, 90),
    maxDiscountPercent: clampInt(getSettingInt(SETTINGS_KEY_MAP.maxDiscountPercent, defaults.maxDiscountPercent), 0, 90),
  };

  if (settings.defaultDiscountPercent > settings.maxDiscountPercent) {
    settings.defaultDiscountPercent = settings.maxDiscountPercent;
  }
  return settings;
}

function isEnabled(): boolean {
  const raw = (process.env.SLOT_RECOVERY_ENABLED ?? "true").toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function isDryRunMode(): boolean {
  return (process.env.SLOT_RECOVERY_MODE ?? "").toLowerCase() === "dry-run";
}

function getPriceModeForEvent(startTimeIso: string): "FULL" | "DISCOUNTED_LAST_MINUTE" {
  const discountHours = getSlotRecoveryAdminSettingsInternal().discountHours;
  const hoursToStart = (new Date(startTimeIso).getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursToStart <= discountHours ? "DISCOUNTED_LAST_MINUTE" : "FULL";
}

function computeRewardPoints(startTimeIso: string, priceMode: "FULL" | "DISCOUNTED_LAST_MINUTE"): number {
  const hoursToStart = (new Date(startTimeIso).getTime() - Date.now()) / (1000 * 60 * 60);
  if (priceMode === "FULL" && hoursToStart <= 48) return 20;
  if (priceMode === "FULL") return 10;
  if (hoursToStart <= 6) return 4;
  return 6;
}

export function ensureSlotRecoverySchema(): void {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_recovery_profiles (
      client_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      opt_in INTEGER NOT NULL DEFAULT 1,
      preferred_window_hours INTEGER NOT NULL DEFAULT 48,
      cooldown_until TEXT,
      recovery_score INTEGER NOT NULL DEFAULT 0,
      total_offers INTEGER NOT NULL DEFAULT 0,
      total_accepted INTEGER NOT NULL DEFAULT 0,
      total_declined INTEGER NOT NULL DEFAULT 0,
      last_offered_at TEXT,
      last_accepted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS slot_recovery_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_model TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      appointment_id INTEGER,
      slot_id INTEGER,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      employee_id INTEGER REFERENCES users(id),
      service_id INTEGER REFERENCES services(id),
      start_time TEXT NOT NULL,
      end_time TEXT,
      cancellation_reason TEXT,
      cancelled_by INTEGER REFERENCES users(id),
      price_mode TEXT NOT NULL DEFAULT 'FULL',
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_model, source_id)
    );

    CREATE TABLE IF NOT EXISTS slot_recovery_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES slot_recovery_events(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      candidate_rank REAL NOT NULL DEFAULT 0,
      offer_window TEXT NOT NULL DEFAULT '48h',
      channel TEXT NOT NULL DEFAULT 'inapp',
      status TEXT NOT NULL DEFAULT 'OFFERED',
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      reward_points INTEGER NOT NULL DEFAULT 0,
      price_mode TEXT NOT NULL DEFAULT 'FULL',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      responded_at TEXT
    );

    CREATE TABLE IF NOT EXISTS slot_recovery_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES slot_recovery_events(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(event_id)
    );

    CREATE TABLE IF NOT EXISTS slot_recovery_delivery_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER REFERENCES slot_recovery_offers(id) ON DELETE SET NULL,
      event_id INTEGER NOT NULL REFERENCES slot_recovery_events(id) ON DELETE CASCADE,
      client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_slot_recovery_events_status ON slot_recovery_events(status);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_events_start ON slot_recovery_events(start_time);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_offers_event ON slot_recovery_offers(event_id);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_offers_client ON slot_recovery_offers(client_id);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_offers_status ON slot_recovery_offers(status);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_queue_status_next ON slot_recovery_queue(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_delivery_log_client ON slot_recovery_delivery_log(client_id);
    CREATE INDEX IF NOT EXISTS idx_slot_recovery_delivery_log_event ON slot_recovery_delivery_log(event_id);
  `);
}

export function publishSlotRecoveryCancellationEvent(input: CancellationEventInput): { created: boolean; eventId: number } {
  ensureSlotRecoverySchema();
  const priceMode = getPriceModeForEvent(input.startTime);
  const startIso = toIsoFromSqliteDateTime(input.startTime);
  const endIso = input.endTime ? toIsoFromSqliteDateTime(input.endTime) : null;

  const existing = rawSqlite.prepare(
    "SELECT id FROM slot_recovery_events WHERE source_model = ? AND source_id = ?"
  ).get(input.sourceModel, input.sourceId) as { id: number } | undefined;
  if (existing) return { created: false, eventId: existing.id };

  const insert = rawSqlite.prepare(`
    INSERT INTO slot_recovery_events (
      source_model, source_id, appointment_id, slot_id, client_id, employee_id, service_id,
      start_time, end_time, cancellation_reason, cancelled_by, price_mode, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    input.sourceModel,
    input.sourceId,
    input.appointmentId ?? null,
    input.slotId ?? null,
    input.clientId,
    input.employeeId,
    input.serviceId,
    startIso,
    endIso,
    input.cancellationReason ?? null,
    input.cancelledBy,
    priceMode,
    nowIso()
  );
  const eventId = Number(insert.lastInsertRowid);
  rawSqlite.prepare(`
    INSERT OR REPLACE INTO slot_recovery_queue (event_id, status, next_attempt_at, attempts, updated_at)
    VALUES (?, 'PENDING', datetime('now'), 0, ?)
  `).run(eventId, nowIso());
  return { created: true, eventId };
}

function pickCandidate(eventId: number): {
  client_id: number;
  candidate_rank: number;
  waitlist_id: number;
  email: string | null;
  phone: string | null;
  name: string;
  email_enabled: number;
  sms_enabled: number;
  push_enabled: number;
} | undefined {
  const maxPerClientPerDay = getSlotRecoveryAdminSettingsInternal().maxOffersPerClientDay;
  return rawSqlite.prepare(`
    SELECT
      w.id AS waitlist_id,
      w.client_id,
      (
        COALESCE(crp.recovery_score, 0)
        + (COALESCE(u.behavior_score, 100) * 0.2)
        + MIN(COALESCE(lp.points_sum, 0) / 20.0, 15)
        + CASE WHEN COALESCE(crp.total_offers, 0) > 0
          THEN (CAST(COALESCE(crp.total_accepted, 0) AS REAL) / CAST(crp.total_offers AS REAL)) * 25
          ELSE 0
          END
      ) AS candidate_rank,
      u.name,
      u.email,
      u.phone,
      u.email_enabled,
      u.sms_enabled,
      u.push_enabled
    FROM slot_recovery_events e
    JOIN waitlist w ON w.service_id = e.service_id AND w.status = 'WAITING'
    JOIN users u ON u.id = w.client_id
    LEFT JOIN client_recovery_profiles crp ON crp.client_id = w.client_id
    LEFT JOIN (
      SELECT user_id, SUM(points) AS points_sum
      FROM loyalty_points
      GROUP BY user_id
    ) lp ON lp.user_id = w.client_id
    WHERE e.id = ?
      AND (w.employee_id IS NULL OR w.employee_id = e.employee_id)
      AND w.client_id != e.client_id
      AND COALESCE(crp.opt_in, 1) = 1
      AND (crp.cooldown_until IS NULL OR crp.cooldown_until < datetime('now'))
      AND NOT EXISTS (
        SELECT 1
        FROM slot_recovery_offers o
        WHERE o.event_id = e.id
          AND o.client_id = w.client_id
          AND o.status IN ('OFFERED', 'ACCEPTED')
      )
      AND (
        SELECT COUNT(*)
        FROM slot_recovery_offers od
        WHERE od.client_id = w.client_id
          AND od.created_at >= datetime('now', '-1 day')
      ) < ?
    ORDER BY candidate_rank DESC, w.created_at ASC
    LIMIT 1
  `).get(eventId, maxPerClientPerDay) as any;
}

async function dispatchOffer(
  event: { id: number; start_time: string; price_mode: "FULL" | "DISCOUNTED_LAST_MINUTE"; slot_id: number | null },
  candidate: {
    client_id: number;
    candidate_rank: number;
    waitlist_id: number;
    email: string | null;
    phone: string | null;
    name: string;
    email_enabled: number;
    sms_enabled: number;
    push_enabled: number;
  },
  log: LogShim
): Promise<void> {
  const settings = getSlotRecoveryAdminSettingsInternal();
  if (settings.mode === "dry-run" || isDryRunMode()) {
    log.info("slot-recovery: dry-run mode, skipping delivery", { eventId: event.id, clientId: candidate.client_id });
    rawSqlite.prepare(`
      UPDATE slot_recovery_queue
      SET status = 'PENDING', next_attempt_at = datetime('now', '+30 minutes'), attempts = attempts + 1, updated_at = datetime('now')
      WHERE event_id = ?
    `).run(event.id);
    return;
  }
  const offerToken = randomBytes(24).toString("hex");
  const expirationMin = settings.offerExpirationMin;
  const expiresAt = new Date(Date.now() + expirationMin * 60 * 1000).toISOString();
  const rewardPoints = computeRewardPoints(event.start_time, event.price_mode);
  const offerWindow = "48h";
  const appliedDiscountPercent = event.price_mode === "DISCOUNTED_LAST_MINUTE"
    ? Math.min(settings.defaultDiscountPercent, settings.maxDiscountPercent)
    : 0;

  const info = rawSqlite.prepare(`
    INSERT INTO slot_recovery_offers (
      event_id, client_id, candidate_rank, offer_window, channel, status, token, expires_at, reward_points, price_mode
    ) VALUES (?, ?, ?, ?, 'push', 'OFFERED', ?, ?, ?, ?)
  `).run(event.id, candidate.client_id, candidate.candidate_rank, offerWindow, offerToken, expiresAt, rewardPoints, event.price_mode);
  const offerId = Number(info.lastInsertRowid);

  const startDate = new Date(event.start_time);
  const dateLabel = startDate.toLocaleDateString("cs-CZ");
  const timeLabel = startDate.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  const priceNote = event.price_mode === "FULL"
    ? "Plná cena, zvýhodněné bodové ohodnocení."
    : `Last-minute sleva až ${appliedDiscountPercent} %, nižší bodové ohodnocení.`;

  const msg = `Uvolnil se termín ${dateLabel} v ${timeLabel}. ${priceNote}`;
  const title = "Náhradní termín je dostupný";
  rawSqlite.prepare(`
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (?, 'WAITLIST_AVAILABLE', ?, ?, ?)
  `).run(
    candidate.client_id,
    title,
    msg,
    JSON.stringify({ offerId, eventId: event.id, slotId: event.slot_id, rewardPoints, discountPercent: appliedDiscountPercent })
  );

  let channelUsed = "push";
  let deliveryStatus = "SENT";
  let deliveryError: string | null = null;
  try {
    if (!candidate.push_enabled && settings.pushOnly) {
      throw new Error("Push-only policy active and user has push disabled");
    }
    if (candidate.push_enabled) {
      await sendPushNotification(candidate.client_id, {
        title,
        body: `${dateLabel} ${timeLabel} – reagujte v aplikaci`,
      });
      channelUsed = "push";
    } else if (!settings.pushOnly && candidate.email_enabled && candidate.email) {
      await sendEmail({
        to: candidate.email,
        subject: title,
        html: `<p>Dobrý den ${candidate.name},</p><p>${msg}</p><p>Otevřete aplikaci a potvrďte nabídku v sekci Náhradní termíny.</p>`,
        text: `${msg} Otevřete aplikaci a potvrďte nabídku v sekci Náhradní termíny.`,
      });
      channelUsed = "email";
    } else if (!settings.pushOnly && candidate.sms_enabled && candidate.phone) {
      await sendSms(candidate.phone, `${msg} Otevřete aplikaci a potvrďte nabídku.`);
      channelUsed = "sms";
    } else if (!settings.pushOnly) {
      channelUsed = "inapp";
    } else {
      throw new Error("Push-only policy active and push channel unavailable");
    }
  } catch (e) {
    log.error("slot-recovery: delivery failed", e);
    rawSqlite.prepare("UPDATE slot_recovery_offers SET status = 'FAILED' WHERE id = ?").run(offerId);
    channelUsed = "push";
    deliveryStatus = "FAILED";
    deliveryError = e instanceof Error ? e.message : "Unknown delivery error";
  }

  rawSqlite.prepare("UPDATE slot_recovery_offers SET channel = ? WHERE id = ?").run(channelUsed, offerId);
  rawSqlite.prepare(`
    INSERT INTO slot_recovery_delivery_log (offer_id, event_id, client_id, channel, status, title, message, metadata, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    offerId,
    event.id,
    candidate.client_id,
    channelUsed,
    deliveryStatus,
    title,
    msg,
    JSON.stringify({
      candidateRank: candidate.candidate_rank,
      rewardPoints,
      priceMode: event.price_mode,
      discountPercent: appliedDiscountPercent,
      pushOnly: settings.pushOnly,
    }),
    deliveryError
  );
  rawSqlite.prepare(`
    UPDATE client_recovery_profiles
    SET total_offers = total_offers + 1, last_offered_at = datetime('now'), updated_at = datetime('now')
    WHERE client_id = ?
  `).run(candidate.client_id);
  rawSqlite.prepare(`
    INSERT OR IGNORE INTO client_recovery_profiles (client_id, opt_in, preferred_window_hours, created_at, updated_at)
    VALUES (?, 1, 48, datetime('now'), datetime('now'))
  `).run(candidate.client_id);

  // Cooldown to avoid spam.
  const cooldownHours = settings.clientCooldownHours;
  rawSqlite.prepare(`
    UPDATE client_recovery_profiles
    SET cooldown_until = datetime('now', ?), updated_at = datetime('now')
    WHERE client_id = ?
  `).run(`+${cooldownHours} hours`, candidate.client_id);

  rawSqlite.prepare("UPDATE waitlist SET status = 'NOTIFIED', notified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(candidate.waitlist_id);
  rawSqlite.prepare("UPDATE slot_recovery_events SET status = 'OFFERED', updated_at = datetime('now') WHERE id = ?").run(event.id);
  rawSqlite.prepare(`
    UPDATE slot_recovery_queue
    SET status = 'OFFERED', next_attempt_at = ?, attempts = attempts + 1, updated_at = datetime('now')
    WHERE event_id = ?
  `).run(expiresAt, event.id);
}

function handleExpiredOffersForEvent(eventId: number): void {
  const activeOffer = rawSqlite.prepare(`
    SELECT id, client_id
    FROM slot_recovery_offers
    WHERE event_id = ? AND status = 'OFFERED' AND expires_at <= datetime('now')
    ORDER BY id DESC
    LIMIT 1
  `).get(eventId) as { id: number; client_id: number } | undefined;
  if (!activeOffer) return;

  rawSqlite.prepare("UPDATE slot_recovery_offers SET status = 'EXPIRED', responded_at = datetime('now') WHERE id = ?")
    .run(activeOffer.id);
  rawSqlite.prepare(`
    UPDATE client_recovery_profiles
    SET total_declined = total_declined + 1, updated_at = datetime('now')
    WHERE client_id = ?
  `).run(activeOffer.client_id);
  rawSqlite.prepare("UPDATE slot_recovery_events SET status = 'PENDING', updated_at = datetime('now') WHERE id = ?")
    .run(eventId);
  rawSqlite.prepare(`
    UPDATE slot_recovery_queue
    SET status = 'PENDING', next_attempt_at = datetime('now'), updated_at = datetime('now')
    WHERE event_id = ?
  `).run(eventId);
}

export async function runSlotRecoveryEngine(log: LogShim): Promise<{ processed: number; offered: number; filled: number; expired: number }> {
  ensureSlotRecoverySchema();
  const settings = getSlotRecoveryAdminSettingsInternal();
  if (!settings.enabled) {
    return { processed: 0, offered: 0, filled: 0, expired: 0 };
  }
  const queueRows = rawSqlite.prepare(`
    SELECT q.event_id, q.status, e.start_time
    FROM slot_recovery_queue q
    JOIN slot_recovery_events e ON e.id = q.event_id
    WHERE q.next_attempt_at <= datetime('now')
      AND q.status IN ('PENDING', 'OFFERED')
      AND e.status IN ('PENDING', 'OFFERED')
    ORDER BY e.start_time ASC, q.id ASC
    LIMIT ?
  `).all(settings.batchSize) as Array<{ event_id: number; status: string; start_time: string }>;

  let offered = 0;
  let filled = 0;
  let expired = 0;

  for (const row of queueRows) {
    if (row.status === "OFFERED") {
      handleExpiredOffersForEvent(row.event_id);
      expired++;
      continue;
    }

    const event = rawSqlite.prepare(`
      SELECT id, slot_id, start_time, price_mode, status
      FROM slot_recovery_events
      WHERE id = ?
    `).get(row.event_id) as { id: number; slot_id: number | null; start_time: string; price_mode: "FULL" | "DISCOUNTED_LAST_MINUTE"; status: string } | undefined;
    if (!event || event.status !== "PENDING") continue;

    if (new Date(event.start_time).getTime() < Date.now()) {
      rawSqlite.prepare("UPDATE slot_recovery_events SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?").run(event.id);
      rawSqlite.prepare("UPDATE slot_recovery_queue SET status = 'EXPIRED', updated_at = datetime('now') WHERE event_id = ?").run(event.id);
      expired++;
      continue;
    }

    const maxOffersPerEvent = settings.maxOffersPerEvent;
    const totalOffersForEvent = (rawSqlite.prepare("SELECT COUNT(*) AS n FROM slot_recovery_offers WHERE event_id = ?").get(event.id) as { n: number }).n;
    if (totalOffersForEvent >= maxOffersPerEvent) {
      rawSqlite.prepare("UPDATE slot_recovery_events SET status = 'EXPIRED', updated_at = datetime('now') WHERE id = ?").run(event.id);
      rawSqlite.prepare("UPDATE slot_recovery_queue SET status = 'EXPIRED', updated_at = datetime('now') WHERE event_id = ?").run(event.id);
      expired++;
      continue;
    }

    const candidate = pickCandidate(event.id);
    if (!candidate) {
      rawSqlite.prepare(`
        UPDATE slot_recovery_queue
        SET status = 'PENDING', next_attempt_at = datetime('now', '+15 minutes'), attempts = attempts + 1, updated_at = datetime('now')
        WHERE event_id = ?
      `).run(event.id);
      continue;
    }
    await dispatchOffer(event, candidate, log);
    offered++;
  }

  const filledCount = (rawSqlite.prepare(`
    SELECT COUNT(*) AS n
    FROM slot_recovery_events
    WHERE status = 'FILLED' AND updated_at >= datetime('now', '-5 minutes')
  `).get() as { n: number }).n;
  filled = filledCount;

  return { processed: queueRows.length, offered, filled, expired };
}

export function getClientRecoveryProfile(clientId: number): {
  clientId: number;
  optIn: boolean;
  preferredWindowHours: number;
  recoveryScore: number;
  totalOffers: number;
  totalAccepted: number;
  totalDeclined: number;
  cooldownUntil: string | null;
} {
  ensureSlotRecoverySchema();
  rawSqlite.prepare(`
    INSERT OR IGNORE INTO client_recovery_profiles (client_id, opt_in, preferred_window_hours, created_at, updated_at)
    VALUES (?, 1, 48, datetime('now'), datetime('now'))
  `).run(clientId);
  const row = rawSqlite.prepare(`
    SELECT client_id, opt_in, preferred_window_hours, recovery_score, total_offers, total_accepted, total_declined, cooldown_until
    FROM client_recovery_profiles
    WHERE client_id = ?
  `).get(clientId) as any;
  return {
    clientId: row.client_id,
    optIn: Boolean(row.opt_in),
    preferredWindowHours: row.preferred_window_hours,
    recoveryScore: row.recovery_score,
    totalOffers: row.total_offers,
    totalAccepted: row.total_accepted,
    totalDeclined: row.total_declined,
    cooldownUntil: row.cooldown_until ? toIsoFromSqliteDateTime(row.cooldown_until) : null,
  };
}

export function updateClientRecoveryProfile(clientId: number, input: { optIn: boolean; preferredWindowHours?: number }): void {
  ensureSlotRecoverySchema();
  rawSqlite.prepare(`
    INSERT OR IGNORE INTO client_recovery_profiles (client_id, opt_in, preferred_window_hours, created_at, updated_at)
    VALUES (?, 1, 48, datetime('now'), datetime('now'))
  `).run(clientId);
  rawSqlite.prepare(`
    UPDATE client_recovery_profiles
    SET opt_in = ?, preferred_window_hours = COALESCE(?, preferred_window_hours), updated_at = datetime('now')
    WHERE client_id = ?
  `).run(input.optIn ? 1 : 0, input.preferredWindowHours ?? null, clientId);
}

export function getClientRecoveryHistory(clientId: number): Array<{
  offerId: number;
  eventId: number;
  status: string;
  channel: string;
  rewardPoints: number;
  createdAt: string;
  respondedAt: string | null;
  startTime: string;
  priceMode: string;
}> {
  ensureSlotRecoverySchema();
  const rows = rawSqlite.prepare(`
    SELECT
      o.id AS offer_id,
      o.event_id,
      o.status,
      o.channel,
      o.reward_points,
      o.created_at,
      o.responded_at,
      e.start_time,
      o.price_mode
    FROM slot_recovery_offers o
    JOIN slot_recovery_events e ON e.id = o.event_id
    WHERE o.client_id = ?
    ORDER BY o.id DESC
    LIMIT 100
  `).all(clientId) as any[];
  return rows.map((r) => ({
    offerId: r.offer_id,
    eventId: r.event_id,
    status: r.status,
    channel: r.channel,
    rewardPoints: r.reward_points,
    createdAt: toIsoFromSqliteDateTime(r.created_at),
    respondedAt: r.responded_at ? toIsoFromSqliteDateTime(r.responded_at) : null,
    startTime: r.start_time,
    priceMode: r.price_mode,
  }));
}

export function respondToRecoveryOffer(clientId: number, offerId: number, action: "ACCEPT" | "DECLINE"): { ok: true; pointsAwarded?: number } {
  ensureSlotRecoverySchema();
  const offer = rawSqlite.prepare(`
    SELECT
      o.id, o.event_id, o.client_id, o.status, o.reward_points, o.price_mode,
      e.slot_id, e.start_time, e.status AS event_status, e.source_model
    FROM slot_recovery_offers o
    JOIN slot_recovery_events e ON e.id = o.event_id
    WHERE o.id = ?
  `).get(offerId) as any;
  if (!offer || offer.client_id !== clientId) {
    throw new Error("Offer not found");
  }
  if (offer.status !== "OFFERED") {
    throw new Error("Offer is no longer active");
  }
  if (new Date(offer.start_time).getTime() < Date.now()) {
    throw new Error("Offer expired");
  }

  if (action === "DECLINE") {
    rawSqlite.prepare("UPDATE slot_recovery_offers SET status = 'DECLINED', responded_at = datetime('now') WHERE id = ?").run(offerId);
    rawSqlite.prepare("UPDATE slot_recovery_events SET status = 'PENDING', updated_at = datetime('now') WHERE id = ?").run(offer.event_id);
    rawSqlite.prepare("UPDATE slot_recovery_queue SET status = 'PENDING', next_attempt_at = datetime('now'), updated_at = datetime('now') WHERE event_id = ?")
      .run(offer.event_id);
    rawSqlite.prepare("UPDATE client_recovery_profiles SET total_declined = total_declined + 1, updated_at = datetime('now') WHERE client_id = ?")
      .run(clientId);
    return { ok: true };
  }

  // ACCEPT flow
  if (offer.slot_id) {
    const slot = rawSqlite.prepare("SELECT id, status FROM open_slots WHERE id = ?").get(offer.slot_id) as { id: number; status: string } | undefined;
    if (!slot || slot.status !== "open") {
      throw new Error("Slot is no longer available");
    }
    const insert = rawSqlite.prepare(
      "INSERT INTO bookings_v2 (slot_id, client_id, status, note) VALUES (?, ?, 'confirmed', ?)"
    ).run(slot.id, clientId, "Autonomní náhradní termín");
    const bookingId = Number(insert.lastInsertRowid);
    rawSqlite.prepare("UPDATE open_slots SET status = 'booked', booking_id = ? WHERE id = ?").run(bookingId, slot.id);
  } else {
    // Legacy appointments without slot_id: notify reception/admin for manual finalization.
    const admins = rawSqlite.prepare("SELECT id FROM users WHERE role IN ('ADMIN', 'RECEPTION') AND is_active = 1").all() as Array<{ id: number }>;
    for (const admin of admins) {
      rawSqlite.prepare(`
        INSERT INTO notifications (user_id, type, title, message, metadata)
        VALUES (?, 'GENERAL', 'Náhradní termín přijat', ?, ?)
      `).run(
        admin.id,
        `Klient #${clientId} přijal nabídku náhradního termínu (offer #${offerId}).`,
        JSON.stringify({ offerId, eventId: offer.event_id, sourceModel: offer.source_model })
      );
    }
  }

  rawSqlite.prepare("UPDATE slot_recovery_offers SET status = 'ACCEPTED', responded_at = datetime('now') WHERE id = ?").run(offerId);
  rawSqlite.prepare("UPDATE slot_recovery_events SET status = 'FILLED', updated_at = datetime('now') WHERE id = ?").run(offer.event_id);
  rawSqlite.prepare("UPDATE slot_recovery_queue SET status = 'FILLED', updated_at = datetime('now') WHERE event_id = ?").run(offer.event_id);
  rawSqlite.prepare(`
    INSERT OR IGNORE INTO client_recovery_profiles (client_id, opt_in, preferred_window_hours, created_at, updated_at)
    VALUES (?, 1, 48, datetime('now'), datetime('now'))
  `).run(clientId);
  rawSqlite.prepare(`
    UPDATE client_recovery_profiles
    SET recovery_score = recovery_score + ?, total_accepted = total_accepted + 1, last_accepted_at = datetime('now'), updated_at = datetime('now')
    WHERE client_id = ?
  `).run(offer.reward_points, clientId);

  rawSqlite.prepare(`
    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (?, 'GENERAL', 'Bodové ohodnocení', ?, ?)
  `).run(
    clientId,
    `Získali jste +${offer.reward_points} recovery bodů za přijetí náhradního termínu.`,
    JSON.stringify({ offerId, points: offer.reward_points, scoreType: "recovery" })
  );

  return { ok: true, pointsAwarded: offer.reward_points };
}

export function listRecoveryEvents(limit = 100): any[] {
  ensureSlotRecoverySchema();
  return rawSqlite.prepare(`
    SELECT e.*, u.name AS client_name, s.name AS service_name
    FROM slot_recovery_events e
    LEFT JOIN users u ON u.id = e.client_id
    LEFT JOIN services s ON s.id = e.service_id
    ORDER BY e.id DESC
    LIMIT ?
  `).all(limit);
}

export function listRecoveryOffers(limit = 200): any[] {
  ensureSlotRecoverySchema();
  return rawSqlite.prepare(`
    SELECT o.*, u.name AS client_name, e.start_time, e.source_model
    FROM slot_recovery_offers o
    JOIN users u ON u.id = o.client_id
    JOIN slot_recovery_events e ON e.id = o.event_id
    ORDER BY o.id DESC
    LIMIT ?
  `).all(limit);
}

export function listRecoveryDeliveryLogs(limit = 500): any[] {
  ensureSlotRecoverySchema();
  return rawSqlite.prepare(`
    SELECT
      l.id,
      l.offer_id,
      l.event_id,
      l.client_id,
      u.name AS client_name,
      l.channel,
      l.status,
      l.title,
      l.message,
      l.metadata,
      l.error_message,
      l.created_at
    FROM slot_recovery_delivery_log l
    JOIN users u ON u.id = l.client_id
    ORDER BY l.id DESC
    LIMIT ?
  `).all(limit);
}

export function getSlotRecoveryAdminSettings(): SlotRecoveryAdminSettings {
  ensureSlotRecoverySchema();
  return getSlotRecoveryAdminSettingsInternal();
}

export function updateSlotRecoveryAdminSettings(input: Partial<SlotRecoveryAdminSettings>): SlotRecoveryAdminSettings {
  ensureSlotRecoverySchema();
  const now = nowIso();
  const normalized: Partial<SlotRecoveryAdminSettings> = {};
  if (typeof input.enabled === "boolean") normalized.enabled = input.enabled;
  if (input.mode === "full-auto" || input.mode === "dry-run") normalized.mode = input.mode;
  if (typeof input.pushOnly === "boolean") normalized.pushOnly = input.pushOnly;
  if (typeof input.batchSize === "number") normalized.batchSize = clampInt(input.batchSize, 1, 200);
  if (typeof input.offerExpirationMin === "number") normalized.offerExpirationMin = clampInt(input.offerExpirationMin, 5, 180);
  if (typeof input.discountHours === "number") normalized.discountHours = clampInt(input.discountHours, 1, 48);
  if (typeof input.maxOffersPerEvent === "number") normalized.maxOffersPerEvent = clampInt(input.maxOffersPerEvent, 1, 25);
  if (typeof input.maxOffersPerClientDay === "number") normalized.maxOffersPerClientDay = clampInt(input.maxOffersPerClientDay, 1, 20);
  if (typeof input.clientCooldownHours === "number") normalized.clientCooldownHours = clampInt(input.clientCooldownHours, 1, 72);
  if (typeof input.defaultDiscountPercent === "number") normalized.defaultDiscountPercent = clampInt(input.defaultDiscountPercent, 0, 90);
  if (typeof input.maxDiscountPercent === "number") normalized.maxDiscountPercent = clampInt(input.maxDiscountPercent, 0, 90);

  const entries: Array<[string, string]> = [];
  if (normalized.enabled !== undefined) entries.push([SETTINGS_KEY_MAP.enabled, normalized.enabled ? "true" : "false"]);
  if (normalized.mode !== undefined) entries.push([SETTINGS_KEY_MAP.mode, normalized.mode]);
  if (normalized.pushOnly !== undefined) entries.push([SETTINGS_KEY_MAP.pushOnly, normalized.pushOnly ? "true" : "false"]);
  if (normalized.batchSize !== undefined) entries.push([SETTINGS_KEY_MAP.batchSize, String(normalized.batchSize)]);
  if (normalized.offerExpirationMin !== undefined) entries.push([SETTINGS_KEY_MAP.offerExpirationMin, String(normalized.offerExpirationMin)]);
  if (normalized.discountHours !== undefined) entries.push([SETTINGS_KEY_MAP.discountHours, String(normalized.discountHours)]);
  if (normalized.maxOffersPerEvent !== undefined) entries.push([SETTINGS_KEY_MAP.maxOffersPerEvent, String(normalized.maxOffersPerEvent)]);
  if (normalized.maxOffersPerClientDay !== undefined) entries.push([SETTINGS_KEY_MAP.maxOffersPerClientDay, String(normalized.maxOffersPerClientDay)]);
  if (normalized.clientCooldownHours !== undefined) entries.push([SETTINGS_KEY_MAP.clientCooldownHours, String(normalized.clientCooldownHours)]);
  if (normalized.defaultDiscountPercent !== undefined) entries.push([SETTINGS_KEY_MAP.defaultDiscountPercent, String(normalized.defaultDiscountPercent)]);
  if (normalized.maxDiscountPercent !== undefined) entries.push([SETTINGS_KEY_MAP.maxDiscountPercent, String(normalized.maxDiscountPercent)]);

  for (const [key, value] of entries) {
    rawSqlite.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now);
  }

  const updated = getSlotRecoveryAdminSettingsInternal();
  if (updated.defaultDiscountPercent > updated.maxDiscountPercent) {
    rawSqlite.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(SETTINGS_KEY_MAP.defaultDiscountPercent, String(updated.maxDiscountPercent), now);
  }
  return getSlotRecoveryAdminSettingsInternal();
}
