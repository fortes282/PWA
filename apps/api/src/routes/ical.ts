/**
 * iCal export — GET /appointments/export/ical
 * Vrátí termíny jako .ics soubor (RFC 5545)
 * RECEPTION/ADMIN: všechny; EMPLOYEE: vlastní; CLIENT: vlastní
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";
import { icalSchemas } from "../utils/swagger-schemas.js";

function escapeIcal(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcalDate(isoStr: string): string {
  // Convert ISO datetime to ICAL format: 20260315T090000Z
  return isoStr.replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace(" ", "T");
}

const icalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Querystring: { from?: string; to?: string; employeeId?: string };
  }>("/appointments/export/ical", { schema: icalSchemas.export }, async (request, reply) => {
    const { role, id: userId } = request.auth!;

    let whereClause = "WHERE a.status NOT IN ('CANCELLED')";
    const params: any[] = [];

    if (role === "CLIENT") {
      whereClause += " AND a.client_id = ?";
      params.push(userId);
    } else if (role === "EMPLOYEE") {
      whereClause += " AND a.employee_id = ?";
      params.push(userId);
    } else {
      // ADMIN/RECEPTION can filter by employeeId
      const empId = request.query.employeeId;
      if (empId) {
        whereClause += " AND a.employee_id = ?";
        params.push(parseInt(empId));
      }
    }

    if (request.query.from) {
      whereClause += " AND a.start_time >= ?";
      params.push(request.query.from);
    }
    if (request.query.to) {
      whereClause += " AND a.start_time <= ?";
      params.push(request.query.to + "T23:59:59");
    }

    const appts = rawSqlite.prepare(`
      SELECT a.id, a.start_time, a.end_time, a.status, a.notes, a.price,
             s.name as service_name,
             uc.name as client_name,
             ue.name as employee_name,
             r.name as room_name
      FROM appointments a
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN users uc ON uc.id = a.client_id
      LEFT JOIN users ue ON ue.id = a.employee_id
      LEFT JOIN rooms r ON r.id = a.room_id
      ${whereClause}
      ORDER BY a.start_time ASC
      LIMIT 500
    `).all(...params) as any[];

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pristav Radosti//Appointments//CS",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:Pristav Radosti - Termíny`,
      "X-WR-TIMEZONE:Europe/Prague",
    ];

    for (const appt of appts) {
      const summary = `${appt.service_name ?? "Termín"}${appt.client_name ? ` — ${appt.client_name}` : ""}`;
      const description = [
        appt.employee_name ? `Terapeut: ${appt.employee_name}` : null,
        appt.client_name ? `Klient: ${appt.client_name}` : null,
        appt.price ? `Cena: ${appt.price} Kč` : null,
        appt.notes ? `Poznámka: ${appt.notes}` : null,
      ].filter(Boolean).join("\\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:pristav-appt-${appt.id}@pristav-radosti.cz`);
      lines.push(`DTSTART:${toIcalDate(appt.start_time)}`);
      lines.push(`DTEND:${toIcalDate(appt.end_time)}`);
      lines.push(`SUMMARY:${escapeIcal(summary)}`);
      if (description) lines.push(`DESCRIPTION:${escapeIcal(description)}`);
      if (appt.room_name) lines.push(`LOCATION:${escapeIcal(appt.room_name)}`);
      lines.push(`STATUS:${appt.status === "CONFIRMED" ? "CONFIRMED" : appt.status === "COMPLETED" ? "COMPLETED" : "TENTATIVE"}`);
      lines.push(`DTSTAMP:${toIcalDate(new Date().toISOString())}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icalContent = lines.join("\r\n");

    reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="pristav-terminy.ics"`)
      .send(icalContent);
  });
};

export default icalRoutes;
