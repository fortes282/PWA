/**
 * Booking System v2 — Therapist opens slots, clients pick from open slots.
 * No automatic generation — therapist has full control.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite, db } from "../db/index.js";
import { users, creditTransactions, services, invoices, invoiceItems } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { sendEmail } from "../services/email.js";
import { sendPushNotification } from "./push.js";
import {
  loadClientSelfCancelPolicyFromDb,
  openSlotStartMs,
  validateClientSelfCancellation,
} from "../services/client-cancel-policy.js";
import { publishSlotRecoveryCancellationEvent } from "../services/slot-recovery.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** True if [slotStartMins, slotEndMins) overlaps any CONFIRMED intensive segment for this therapist+day. */
function intensiveTherapyBlocksHour(
  employeeId: number,
  dateStr: string,
  slotStartMins: number,
  slotEndMins: number
): boolean {
  let rows: Array<{ start_time: string; end_time: string }>;
  try {
    rows = rawSqlite
      .prepare(
        `SELECT its.start_time, its.end_time FROM intensive_therapy_segments its
         INNER JOIN intensive_therapy_plans p ON p.id = its.plan_id AND p.status = 'CONFIRMED'
         WHERE its.employee_id = ? AND its.date = ?`
      )
      .all(employeeId, dateStr) as Array<{ start_time: string; end_time: string }>;
  } catch {
    return false;
  }
  for (const r of rows) {
    const s = timeToMins(r.start_time);
    const e = timeToMins(r.end_time);
    if (slotStartMins < e && slotEndMins > s) return true;
  }
  return false;
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  let cur = from;
  while (cur <= to) {
    dates.push(cur);
    cur = addDaysToDate(cur, 1);
  }
  return dates;
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00").getDay();
}

function createNotification(userId: number, type: string, title: string, message: string): void {
  rawSqlite.prepare(
    "INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)"
  ).run(userId, type, title, message);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkScheduleRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

interface SlotRow {
  id: number;
  employee_id: number;
  date: string;
  time: string;
  status: string;
}

interface BookingRow {
  id: number;
  slot_id: number;
  client_id: number;
  status: string;
  employee_id: number;
  date: string;
  time: string;
}

interface TimeOffRow {
  id: number;
  employee_id: number;
  date_from: string;
  date_to: string;
}

interface DayScheduleInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}

interface OpenSlotsBody {
  employeeId: number;
  from: string;
  to: string;
  mode?: string;
}

interface BookingBody {
  slotId: number;
  note?: string;
  clientId?: number;
  serviceId?: number;
}

const bookingV2Routes: FastifyPluginAsync = async (fastify) => {

  // ── Work Schedule ──────────────────────────────────────────────────────────

  // GET /work-schedule/:employeeId — returns weekly template
  fastify.get<{ Params: { employeeId: string } }>("/work-schedule/:employeeId", async (request, reply) => {
    const { id, role } = request.auth!;
    const employeeId = parseInt(request.params.employeeId);
    if (!["EMPLOYEE", "RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    if (role === "EMPLOYEE" && id !== employeeId) return reply.code(403).send({ error: "Forbidden" });

    return rawSqlite.prepare(
      "SELECT * FROM work_schedule WHERE employee_id = ? ORDER BY day_of_week"
    ).all(employeeId);
  });

  // PUT /work-schedule/:employeeId — uloží/aktualizuje šablonu
  fastify.put<{ Params: { employeeId: string }; Body: DayScheduleInput[] }>(
    "/work-schedule/:employeeId",
    async (request, reply) => {
      const { id, role } = request.auth!;
      const employeeId = parseInt(request.params.employeeId);
      if (!["RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

      const days = request.body;
      if (!Array.isArray(days)) return reply.code(400).send({ error: "Body must be an array of day schedules" });

      rawSqlite.prepare("DELETE FROM work_schedule WHERE employee_id = ?").run(employeeId);
      const insert = rawSqlite.prepare(
        "INSERT INTO work_schedule (employee_id, day_of_week, start_time, end_time, break_start, break_end) VALUES (?, ?, ?, ?, ?, ?)"
      );
      for (const d of days) {
        insert.run(employeeId, d.dayOfWeek, d.startTime, d.endTime, d.breakStart ?? null, d.breakEnd ?? null);
      }
      return { ok: true, updated: days.length };
    }
  );

  // ── Time Off v2 ───────────────────────────────────────────────────────────

  // GET /time-off-v2/:employeeId
  fastify.get<{ Params: { employeeId: string } }>("/time-off-v2/:employeeId", async (request, reply) => {
    const { id, role } = request.auth!;
    const employeeId = parseInt(request.params.employeeId);
    if (!["EMPLOYEE", "RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    if (role === "EMPLOYEE" && id !== employeeId) return reply.code(403).send({ error: "Forbidden" });

    return rawSqlite.prepare(
      "SELECT * FROM time_off_v2 WHERE employee_id = ? ORDER BY date_from DESC"
    ).all(employeeId);
  });

  // POST /time-off-v2 — create time off, cancel colliding slots/bookings
  fastify.post<{ Body: { employeeId: number; dateFrom: string; dateTo: string; type?: string; note?: string } }>(
    "/time-off-v2",
    async (request, reply) => {
      const { id, role } = request.auth!;
      if (!["EMPLOYEE", "RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
      const body = request.body;
      if (role === "EMPLOYEE" && id !== body.employeeId) return reply.code(403).send({ error: "Forbidden" });

      if (!body.dateFrom || !body.dateTo) return reply.code(400).send({ error: "dateFrom and dateTo are required" });
      if (body.dateFrom > body.dateTo) return reply.code(400).send({ error: "dateTo must be >= dateFrom" });

      // Insert time off
      const result = rawSqlite.prepare(
        "INSERT INTO time_off_v2 (employee_id, date_from, date_to, type, note) VALUES (?, ?, ?, ?, ?)"
      ).run(body.employeeId, body.dateFrom, body.dateTo, body.type ?? "vacation", body.note ?? null);
      const timeOffId = result.lastInsertRowid as number;

      // Find colliding open slots
      const collidingSlots = rawSqlite.prepare(
        "SELECT id FROM open_slots WHERE employee_id = ? AND date >= ? AND date <= ? AND status = 'open'"
      ).all(body.employeeId, body.dateFrom, body.dateTo) as Array<{ id: number }>;

      if (collidingSlots.length > 0) {
        const slotIds = collidingSlots.map((s) => s.id);
        rawSqlite.prepare(
          `UPDATE open_slots SET status = 'cancelled' WHERE id IN (${slotIds.map(() => "?").join(",")})`
        ).run(...slotIds);
      }

      // Find booked slots in range and cancel their bookings
      const bookedSlots = rawSqlite.prepare(
        "SELECT id FROM open_slots WHERE employee_id = ? AND date >= ? AND date <= ? AND status = 'booked'"
      ).all(body.employeeId, body.dateFrom, body.dateTo) as Array<{ id: number }>;

      if (bookedSlots.length > 0) {
        const bookedIds = bookedSlots.map((s) => s.id);
        const bookings = rawSqlite.prepare(
          `SELECT b.id, b.client_id, b.slot_id, s.date, s.time, s.employee_id, s.service_id
           FROM bookings_v2 b
           JOIN open_slots s ON s.id = b.slot_id
           WHERE b.slot_id IN (${bookedIds.map(() => "?").join(",")}) AND b.status = 'confirmed'`
        ).all(...bookedIds) as Array<{ id: number; client_id: number; slot_id: number; date: string; time: string; employee_id: number; service_id: number | null }>;

        const empUser = await db.select({ name: users.name }).from(users).where(eq(users.id, body.employeeId));
        const empName = empUser[0]?.name ?? "";

        for (const booking of bookings) {
          rawSqlite.prepare(
            "UPDATE bookings_v2 SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?"
          ).run(booking.id);
          rawSqlite.prepare(
            "UPDATE open_slots SET status = 'cancelled', booking_id = NULL WHERE id IN (SELECT slot_id FROM bookings_v2 WHERE id = ?)"
          ).run(booking.id);
          createNotification(
            booking.client_id,
            "booking_cancelled",
            "Termín zrušen",
            `Váš termín dne ${booking.date} v ${booking.time} byl zrušen z důvodu dovolené terapeuta ${empName}. Omlouváme se za komplikace.`
          );
          // Try push notification
          sendPushNotification(booking.client_id, { title: "Termín zrušen", body: `Termín ${booking.date} v ${booking.time} byl zrušen` }).catch(() => {});

          publishSlotRecoveryCancellationEvent({
            sourceModel: "bookings_v2",
            sourceId: booking.id,
            slotId: booking.slot_id,
            clientId: booking.client_id,
            employeeId: booking.employee_id,
            serviceId: booking.service_id,
            startTime: `${booking.date}T${booking.time}:00`,
            cancellationReason: "time_off_v2",
            cancelledBy: id,
          });
        }
      }

      reply.code(201);
      return rawSqlite.prepare("SELECT * FROM time_off_v2 WHERE id = ?").get(timeOffId);
    }
  );

  // DELETE /time-off-v2/:id
  fastify.delete<{ Params: { id: string } }>("/time-off-v2/:id", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["EMPLOYEE", "RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const timeOffId = parseInt(request.params.id);
    const existing = rawSqlite.prepare("SELECT * FROM time_off_v2 WHERE id = ?").get(timeOffId) as TimeOffRow | undefined;
    if (!existing) return reply.code(404).send({ error: "Not found" });
    if (role === "EMPLOYEE" && id !== existing.employee_id) return reply.code(403).send({ error: "Forbidden" });
    rawSqlite.prepare("DELETE FROM time_off_v2 WHERE id = ?").run(timeOffId);
    return { ok: true };
  });

  // ── Slots ─────────────────────────────────────────────────────────────────

  // GET /slots/suggestions — analyze booking history, suggest optimal new slot times
  fastify.get("/slots/suggestions", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const q = request.query as { employeeId?: string; weeks?: string };

    let empId: number | null = null;
    if (q.employeeId) {
      empId = parseInt(q.employeeId);
    }
    if (empId === null) return reply.code(400).send({ error: "employeeId required" });

    const lookbackWeeks = Math.min(Math.max(parseInt(q.weeks ?? "8"), 1), 52);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackWeeks * 7);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    // Count bookings per (day_of_week, time) in the lookback window
    interface DemandRow { day_of_week: number; time: string; count: number }
    const demand = rawSqlite.prepare(`
      SELECT
        CAST(strftime('%w', s.date) AS INTEGER) as day_of_week,
        s.time,
        COUNT(*) as count
      FROM open_slots s
      JOIN bookings_v2 b ON b.slot_id = s.id AND b.status = 'confirmed'
      WHERE s.employee_id = ?
        AND s.date >= ?
      GROUP BY day_of_week, s.time
      ORDER BY count DESC
      LIMIT 20
    `).all(empId, cutoffStr) as DemandRow[];

    // Figure out what slots are already open in the next 2 weeks
    const today = new Date().toISOString().slice(0, 10);
    const twoWeeksOut = new Date();
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    const twoWeeksStr = twoWeeksOut.toISOString().slice(0, 10);

    interface ExistingRow { day_of_week: number; time: string }
    const existing = rawSqlite.prepare(`
      SELECT DISTINCT CAST(strftime('%w', date) AS INTEGER) as day_of_week, time
      FROM open_slots
      WHERE employee_id = ? AND date >= ? AND date <= ? AND status != 'cancelled'
    `).all(empId, today, twoWeeksStr) as ExistingRow[];

    const existingSet = new Set(existing.map((e) => `${e.day_of_week}:${e.time}`));

    // Filter out combos already covered; enrich with demand context
    const DAY_NAMES = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
    const suggestions = demand
      .filter((row) => !existingSet.has(`${row.day_of_week}:${row.time}`))
      .slice(0, 10)
      .map((row) => ({
        dayOfWeek: row.day_of_week,
        dayName: DAY_NAMES[row.day_of_week],
        time: row.time,
        count: row.count,
        label: `${DAY_NAMES[row.day_of_week]} ${row.time} (${row.count}× za posledních ${lookbackWeeks} týdnů)`,
      }));

    return { lookbackWeeks, suggestions };
  });

  // GET /slots/months — days with open slots for a month (calendar dots)
  fastify.get("/slots/months", async (request, reply) => {
    const q = request.query as { employeeId?: string; year?: string; month?: string };
    if (!q.year || !q.month) return reply.code(400).send({ error: "year and month required" });

    const year = parseInt(q.year);
    const monthPadded = parseInt(q.month).toString().padStart(2, "0");
    const from = `${year}-${monthPadded}-01`;
    const lastDay = new Date(year, parseInt(q.month), 0).getDate();
    const to = `${year}-${monthPadded}-${lastDay.toString().padStart(2, "0")}`;

    let query = `
      SELECT date,
             COUNT(*) as total,
             SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open_count,
             SUM(CASE WHEN status='booked' THEN 1 ELSE 0 END) as booked_count
      FROM open_slots
      WHERE date >= ? AND date <= ?
    `;
    const params: (string | number)[] = [from, to];

    if (q.employeeId) {
      query += " AND employee_id = ?";
      params.push(parseInt(q.employeeId));
    }
    query += " GROUP BY date ORDER BY date";

    return rawSqlite.prepare(query).all(...params);
  });

  // GET /slots/available?employeeId=X&date=Y — for clients, only open slots
  fastify.get("/slots/available", async (request, reply) => {
    const q = request.query as { employeeId?: string; date?: string };
    if (!q.date) return reply.code(400).send({ error: "date is required" });

    let query = `
      SELECT s.*, u.name as employee_name, u.avatar_url as employee_avatar
      FROM open_slots s
      JOIN users u ON u.id = s.employee_id
      WHERE s.status = 'open' AND s.date = ?
    `;
    const params: (string | number)[] = [q.date];

    if (q.employeeId) {
      query += " AND s.employee_id = ?";
      params.push(parseInt(q.employeeId));
    }
    query += " ORDER BY s.time";

    return rawSqlite.prepare(query).all(...params);
  });

  // POST /slots/open — open slots for a period from work_schedule
  fastify.post<{ Body: OpenSlotsBody }>("/slots/open", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const body = request.body;
    if (!body.employeeId || !body.from || !body.to) {
      return reply.code(400).send({ error: "employeeId, from and to are required" });
    }

    // Load work schedule
    const schedule = rawSqlite.prepare(
      "SELECT * FROM work_schedule WHERE employee_id = ? ORDER BY day_of_week"
    ).all(body.employeeId) as WorkScheduleRow[];

    if (schedule.length === 0) {
      return reply.code(400).send({ error: "No work schedule defined for this employee. Please set working hours first." });
    }

    // Load time-off blocks in range
    const timeOffs = rawSqlite.prepare(
      "SELECT date_from, date_to FROM time_off_v2 WHERE employee_id = ? AND date_to >= ? AND date_from <= ?"
    ).all(body.employeeId, body.from, body.to) as Array<{ date_from: string; date_to: string }>;

    // Build set of time-off dates
    const timeOffDates = new Set<string>();
    for (const toff of timeOffs) {
      for (const d of dateRange(toff.date_from, toff.date_to)) {
        timeOffDates.add(d);
      }
    }

    const allDates = dateRange(body.from, body.to);
    const insertSlot = rawSqlite.prepare(
      "INSERT OR IGNORE INTO open_slots (employee_id, date, time, status) VALUES (?, ?, ?, 'open')"
    );

    let preview = 0;
    let created = 0;
    let skipped = 0;

    for (const dateStr of allDates) {
      if (timeOffDates.has(dateStr)) continue;

      const dow = getDayOfWeek(dateStr);
      const daySchedule = schedule.find((s) => s.day_of_week === dow);
      if (!daySchedule) continue;

      const workStart = timeToMins(daySchedule.start_time);
      const workEnd = timeToMins(daySchedule.end_time);
      const breakStart = daySchedule.break_start ? timeToMins(daySchedule.break_start) : null;
      const breakEnd = daySchedule.break_end ? timeToMins(daySchedule.break_end) : null;

      // Generate 1-hour slots (fixed duration)
      for (let mins = workStart; mins + 60 <= workEnd; mins += 60) {
        // Skip if overlaps with break [breakStart, breakEnd)
        if (breakStart !== null && breakEnd !== null) {
          if (mins < breakEnd && mins + 60 > breakStart) continue;
        }

        if (intensiveTherapyBlocksHour(body.employeeId, dateStr, mins, mins + 60)) continue;

        const timeStr = minsToTime(mins);
        const existing = rawSqlite.prepare(
          "SELECT id FROM open_slots WHERE employee_id = ? AND date = ? AND time = ? AND status != 'cancelled'"
        ).get(body.employeeId, dateStr, timeStr);

        preview++;
        if (!existing) {
          insertSlot.run(body.employeeId, dateStr, timeStr);
          created++;
        } else {
          skipped++;
        }
      }
    }

    return { preview, created, skipped };
  });

  // GET /slots?employeeId=X&from=Y&to=Z — list slots for calendar
  fastify.get("/slots", async (request, reply) => {
    const { id, role } = request.auth!;
    const q = request.query as { employeeId?: string; from?: string; to?: string };

    if (!["RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

    let empId: number | null = null;
    if (q.employeeId) {
      empId = parseInt(q.employeeId);
    }

    let query = `
      SELECT s.*, u.name as employee_name,
             b.id as b_id, b.client_id, b.status as booking_status, b.note as booking_note,
             c.name as client_name, c.phone as client_phone
      FROM open_slots s
      JOIN users u ON u.id = s.employee_id
      LEFT JOIN bookings_v2 b ON b.id = s.booking_id AND b.status = 'confirmed'
      LEFT JOIN users c ON c.id = b.client_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (empId !== null) {
      query += " AND s.employee_id = ?";
      params.push(empId);
    }
    if (q.from) {
      query += " AND s.date >= ?";
      params.push(q.from);
    }
    if (q.to) {
      query += " AND s.date <= ?";
      params.push(q.to);
    }
    query += " ORDER BY s.date, s.time";

    return rawSqlite.prepare(query).all(...params);
  });

  // DELETE /slots/:id — close slot (only if not booked)
  fastify.delete<{ Params: { id: string } }>("/slots/:id", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const slotId = parseInt(request.params.id);
    const slot = rawSqlite.prepare("SELECT * FROM open_slots WHERE id = ?").get(slotId) as SlotRow | undefined;
    if (!slot) return reply.code(404).send({ error: "Slot not found" });
    if (slot.status === "booked") return reply.code(400).send({ error: "Cannot close a booked slot. Cancel the booking first." });
    rawSqlite.prepare("UPDATE open_slots SET status = 'cancelled' WHERE id = ?").run(slotId);
    return { ok: true };
  });

  // ── Bookings v2 ───────────────────────────────────────────────────────────

  // POST /bookings-v2 — klient rezervuje slot
  fastify.post<{ Body: BookingBody }>("/bookings-v2", async (request, reply) => {
    const { id: authId, role } = request.auth!;
    if (!["CLIENT", "RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const body = request.body;
    if (!body.slotId) return reply.code(400).send({ error: "slotId is required" });

    // Reception/admin can book for a specific client
    const bookingClientId = (role === "RECEPTION" || role === "ADMIN") && body.clientId
      ? body.clientId
      : authId;

    const slot = rawSqlite.prepare("SELECT * FROM open_slots WHERE id = ?").get(body.slotId) as SlotRow | undefined;
    if (!slot) return reply.code(404).send({ error: "Slot not found" });
    if (slot.status !== "open") return reply.code(409).send({ error: "Slot is not available" });

    // ── Credit deduction ──────────────────────────────────────────────────────
    // If a serviceId is provided, look up the price and deduct credits.
    let servicePrice = 0;
    let serviceName = "";
    if (body.serviceId) {
      const [svc] = await db.select().from(services).where(eq(services.id, body.serviceId)).limit(1);
      if (svc) {
        servicePrice = svc.price ?? 0;
        serviceName = svc.name;
      }
    }

    if (servicePrice > 0) {
      // Check client credit balance
      const lastTx = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, bookingClientId))
        .orderBy(desc(creditTransactions.id))
        .limit(1);
      const currentBalance = lastTx[0]?.balance ?? 0;

      if (currentBalance < servicePrice) {
        return reply.code(402).send({
          error: `Nedostatek kreditu. Potřebujete ${servicePrice} Kč, ale máte pouze ${currentBalance} Kč.`,
        });
      }
    }

    // Create booking
    const result = rawSqlite.prepare(
      "INSERT INTO bookings_v2 (slot_id, client_id, status, note) VALUES (?, ?, 'confirmed', ?)"
    ).run(body.slotId, bookingClientId, body.note ?? null);
    const bookingId = result.lastInsertRowid as number;

    // Update slot
    rawSqlite.prepare("UPDATE open_slots SET status = 'booked', booking_id = ? WHERE id = ?").run(bookingId, body.slotId);

    // Deduct credits after successful booking
    if (servicePrice > 0) {
      const lastTx = await db
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.userId, bookingClientId))
        .orderBy(desc(creditTransactions.id))
        .limit(1);
      const currentBalance = lastTx[0]?.balance ?? 0;
      const newBalance = currentBalance - servicePrice;

      await db.insert(creditTransactions).values({
        userId: bookingClientId,
        type: "USE",
        amount: -servicePrice,
        balance: newBalance,
        note: `Rezervace #${bookingId} — ${serviceName || "služba"} (${slot.date} ${slot.time})`,
      });

      // Notify client about credit deduction
      createNotification(
        bookingClientId,
        "credit_deducted",
        "Odečtení kreditu",
        `Z vašeho kreditního účtu bylo odečteno ${servicePrice} Kč za rezervaci ${slot.date} v ${slot.time}.`
      );
    }

    // Notify therapist (in-app)
    const clientUsers = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, bookingClientId));
    const clientUser = clientUsers[0];
    createNotification(
      slot.employee_id,
      "new_booking",
      "Nová rezervace",
      `Klient ${clientUser?.name ?? "Neznámý"} si rezervoval termín: ${slot.date} v ${slot.time}.`
    );

    // Notify client (in-app)
    createNotification(
      bookingClientId,
      "booking_confirmed",
      "Termín potvrzen",
      `Váš termín byl potvrzen: ${slot.date} v ${slot.time}.`
    );

    // Email notification to client (fire and forget)
    if (clientUser?.email) {
      sendEmail({
        to: clientUser.email,
        subject: "Termín potvrzen — Přístav Radosti",
        html: `<p>Dobrý den,</p><p>Váš termín byl úspěšně rezervován:</p><ul><li><strong>Datum:</strong> ${slot.date}</li><li><strong>Čas:</strong> ${slot.time}</li></ul><p>Těšíme se na vás!</p><p>Tým Přístav Radosti</p>`,
        text: `Váš termín byl potvrzen: ${slot.date} v ${slot.time}. Těšíme se na vás!`,
      }).catch(() => {});
    }

    // Push notification to client (fire and forget)
    sendPushNotification(bookingClientId, { title: "Termín potvrzen", body: `Termín ${slot.date} v ${slot.time} byl úspěšně rezervován.` }).catch(() => {});

    reply.code(201);
    return rawSqlite.prepare("SELECT * FROM bookings_v2 WHERE id = ?").get(bookingId);
  });

  // DELETE /bookings-v2/:id — zrušit rezervaci
  fastify.delete<{ Params: { id: string } }>("/bookings-v2/:id", async (request, reply) => {
    const { id: authId, role } = request.auth!;
    const bookingId = parseInt(request.params.id);

    const booking = rawSqlite.prepare(`
      SELECT b.*, s.employee_id, s.date, s.time, s.id as slot_id_ref
      FROM bookings_v2 b
      JOIN open_slots s ON s.id = b.slot_id
      WHERE b.id = ?
    `).get(bookingId) as BookingRow | undefined;

    if (!booking) return reply.code(404).send({ error: "Booking not found" });
    if (role === "CLIENT" && authId !== booking.client_id) return reply.code(403).send({ error: "Forbidden" });
    if (!["CLIENT", "RECEPTION", "ADMIN", "EMPLOYEE"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    if (booking.status === "cancelled") return reply.code(400).send({ error: "Booking already cancelled" });

    if (role === "CLIENT") {
      const policy = loadClientSelfCancelPolicyFromDb();
      const gate = validateClientSelfCancellation(policy, {
        role,
        appointmentStartMs: openSlotStartMs(booking.date, booking.time),
        nowMs: Date.now(),
        cancellationReason: null,
      });
      if (!gate.ok) {
        return reply.code(gate.code).send({ error: gate.message });
      }
    }

    // Cancel booking (free cancellation)
    rawSqlite.prepare(
      "UPDATE bookings_v2 SET status = 'cancelled', cancelled_at = datetime('now'), cancellation_type = 'free' WHERE id = ?"
    ).run(bookingId);

    // Reopen slot
    rawSqlite.prepare(
      "UPDATE open_slots SET status = 'open', booking_id = NULL WHERE id = ?"
    ).run(booking.slot_id);

    // Notify therapist
    createNotification(
      booking.employee_id,
      "booking_cancelled",
      "Termín zrušen",
      `Klient zrušil termín: ${booking.date} v ${booking.time}. Slot je opět volný.`
    );

    publishSlotRecoveryCancellationEvent({
      sourceModel: "bookings_v2",
      sourceId: booking.id,
      slotId: booking.slot_id,
      clientId: booking.client_id,
      employeeId: booking.employee_id,
      serviceId: null,
      startTime: `${booking.date}T${booking.time}:00`,
      cancellationReason: "client_cancel",
      cancelledBy: authId,
    });

    return { ok: true };
  });

  // POST /bookings-v2/:id/cancel-with-fee — storno s poplatkem (RECEPTION/ADMIN)
  fastify.post<{ Params: { id: string }; Body: { fee: number; description?: string } }>(
    "/bookings-v2/:id/cancel-with-fee",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });

      const bookingId = parseInt(request.params.id);
      const { fee, description } = request.body;

      if (!fee || fee <= 0) return reply.code(400).send({ error: "fee must be a positive number" });

      const booking = rawSqlite.prepare(`
        SELECT b.*, s.employee_id, s.date, s.time, s.id as slot_id_ref,
               c.name as client_name
        FROM bookings_v2 b
        JOIN open_slots s ON s.id = b.slot_id
        JOIN users c ON c.id = b.client_id
        WHERE b.id = ?
      `).get(bookingId) as (BookingRow & { client_name: string }) | undefined;

      if (!booking) return reply.code(404).send({ error: "Booking not found" });
      if (booking.status === "cancelled") return reply.code(400).send({ error: "Booking already cancelled" });

      const now = new Date().toISOString();
      const currentMonth = now.slice(0, 7); // "YYYY-MM"
      const itemDescription = description || `Storno poplatek — ${booking.client_name} ${booking.date} ${booking.time}`;

      // Find or create DRAFT invoice for this client in current month
      let invoice = rawSqlite.prepare(`
        SELECT * FROM invoices
        WHERE client_id = ? AND status = 'DRAFT' AND source_month = ?
        LIMIT 1
      `).get(booking.client_id, currentMonth) as any;

      if (!invoice) {
        // Generate invoice number
        const prefix = "INV";
        const year = new Date().getFullYear();
        const lastInv = rawSqlite.prepare(`
          SELECT invoice_number FROM invoices
          WHERE invoice_number LIKE ? || '-' || ? || '-%'
          ORDER BY id DESC LIMIT 1
        `).get(prefix, String(year)) as { invoice_number: string } | undefined;

        let seq = 1;
        if (lastInv) {
          const match = lastInv.invoice_number.match(new RegExp(`${prefix}-\\d{4}-(\\d+)$`));
          if (match) seq = parseInt(match[1], 10) + 1;
        }
        const invoiceNumber = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;

        const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
        const invResult = rawSqlite.prepare(`
          INSERT INTO invoices (invoice_number, client_id, invoice_type, status, total, due_date, source_month, created_at, updated_at)
          VALUES (?, ?, 'GENERAL', 'DRAFT', 0, ?, ?, ?, ?)
        `).run(invoiceNumber, booking.client_id, dueDate, currentMonth, now, now);

        invoice = rawSqlite.prepare("SELECT * FROM invoices WHERE id = ?").get(Number(invResult.lastInsertRowid));
      }

      // Add invoice item
      const itemResult = rawSqlite.prepare(`
        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
        VALUES (?, ?, 1, ?, ?)
      `).run(invoice.id, itemDescription, fee, fee);
      const invoiceItemId = Number(itemResult.lastInsertRowid);

      // Recalculate invoice total
      const sumResult = rawSqlite.prepare(
        "SELECT COALESCE(SUM(total), 0) as sum_total FROM invoice_items WHERE invoice_id = ?"
      ).get(invoice.id) as { sum_total: number };

      rawSqlite.prepare(
        "UPDATE invoices SET total = ?, updated_at = ? WHERE id = ?"
      ).run(sumResult.sum_total, now, invoice.id);

      // Cancel booking
      rawSqlite.prepare(
        "UPDATE bookings_v2 SET status = 'cancelled', cancelled_at = ?, cancellation_type = 'fee', cancellation_fee = ?, invoice_item_id = ? WHERE id = ?"
      ).run(now, fee, invoiceItemId, bookingId);

      // Reopen slot
      rawSqlite.prepare(
        "UPDATE open_slots SET status = 'open', booking_id = NULL WHERE id = ?"
      ).run(booking.slot_id);

      // Notify client
      createNotification(
        booking.client_id,
        "booking_cancelled",
        "Termín zrušen se storno poplatkem",
        `Váš termín ${booking.date} v ${booking.time} byl zrušen. Storno poplatek ${fee} Kč byl přidán k faktuře ${invoice.invoice_number}.`
      );

      // Notify therapist
      createNotification(
        booking.employee_id,
        "booking_cancelled",
        "Termín zrušen",
        `Termín ${booking.date} v ${booking.time} byl zrušen se storno poplatkem ${fee} Kč. Slot je opět volný.`
      );

      publishSlotRecoveryCancellationEvent({
        sourceModel: "bookings_v2",
        sourceId: booking.id,
        slotId: booking.slot_id,
        clientId: booking.client_id,
        employeeId: booking.employee_id,
        serviceId: null,
        startTime: `${booking.date}T${booking.time}:00`,
        cancellationReason: description ?? "cancel_with_fee",
        cancelledBy: request.auth!.id,
      });

      return {
        ok: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        invoiceItemId,
        fee,
      };
    }
  );

  // GET /bookings-v2/my — moje rezervace (klient)
  fastify.get("/bookings-v2/my", async (request, reply) => {
    const { id } = request.auth!;
    return rawSqlite.prepare(`
      SELECT b.*, s.date, s.time, s.employee_id,
             u.name as employee_name, u.avatar_url as employee_avatar
      FROM bookings_v2 b
      JOIN open_slots s ON s.id = b.slot_id
      JOIN users u ON u.id = s.employee_id
      WHERE b.client_id = ?
      ORDER BY s.date DESC, s.time DESC
    `).all(id);
  });

  // GET /bookings-v2 — seznam rezervací terapeuta
  fastify.get("/bookings-v2", async (request, reply) => {
    const { id, role } = request.auth!;
    if (!["EMPLOYEE", "RECEPTION", "ADMIN"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const q = request.query as { employeeId?: string; from?: string; to?: string };

    let empId: number | null = role === "EMPLOYEE" ? id : (q.employeeId ? parseInt(q.employeeId) : null);
    if (role === "EMPLOYEE" && q.employeeId && parseInt(q.employeeId) !== id) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    let query = `
      SELECT b.*, s.date, s.time, s.employee_id,
             u.name as employee_name,
             c.name as client_name, c.email as client_email, c.phone as client_phone
      FROM bookings_v2 b
      JOIN open_slots s ON s.id = b.slot_id
      JOIN users u ON u.id = s.employee_id
      JOIN users c ON c.id = b.client_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (empId !== null) {
      query += " AND s.employee_id = ?";
      params.push(empId);
    }
    if (q.from) {
      query += " AND s.date >= ?";
      params.push(q.from);
    }
    if (q.to) {
      query += " AND s.date <= ?";
      params.push(q.to);
    }
    query += " ORDER BY s.date DESC, s.time DESC";

    return rawSqlite.prepare(query).all(...params);
  });
};

export default bookingV2Routes;
