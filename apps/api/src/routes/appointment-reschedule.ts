/**
 * Appointment Reschedule (Drag-Drop Support)
 * PATCH /appointments/:id/reschedule — move appointment to new date/time/room.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

const appointmentRescheduleRoutes: FastifyPluginAsync = async (fastify) => {
  // PATCH /appointments/:id/reschedule — move appointment (RECEPTION/ADMIN)
  fastify.patch<{ Params: { id: string } }>(
    "/appointments/:id/reschedule",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      if (!["RECEPTION", "ADMIN"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden — only reception or admin" });
      }

      const id = parseInt(request.params.id);
      const body = request.body as any;
      const { startTime, endTime, roomId } = body;

      if (!startTime || !endTime) {
        return reply.code(400).send({ error: "startTime and endTime are required" });
      }

      // Validate date format
      if (isNaN(Date.parse(startTime)) || isNaN(Date.parse(endTime))) {
        return reply.code(400).send({ error: "Invalid date format for startTime or endTime" });
      }

      if (new Date(startTime) >= new Date(endTime)) {
        return reply.code(400).send({ error: "startTime must be before endTime" });
      }

      // Load existing appointment
      const appointment = rawSqlite.prepare(
        "SELECT * FROM appointments WHERE id = ?"
      ).get(id) as any;

      if (!appointment) {
        return reply.code(404).send({ error: "Appointment not found" });
      }

      if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
        return reply.code(400).send({ error: `Cannot reschedule ${appointment.status} appointment` });
      }

      const targetRoomId = roomId !== undefined ? roomId : appointment.room_id;
      const targetEmployeeId = appointment.employee_id;

      // Check for employee time conflicts (excluding current appointment)
      const employeeConflict = rawSqlite.prepare(
        `SELECT id FROM appointments
         WHERE employee_id = ? AND id != ?
           AND status NOT IN ('CANCELLED')
           AND start_time < ? AND end_time > ?`
      ).get(targetEmployeeId, id, endTime, startTime);

      if (employeeConflict) {
        return reply.code(409).send({ error: "Time conflict with another appointment for this employee" });
      }

      // Check for room conflicts if room is set
      if (targetRoomId) {
        const roomConflict = rawSqlite.prepare(
          `SELECT id FROM appointments
           WHERE room_id = ? AND id != ?
             AND status NOT IN ('CANCELLED')
             AND start_time < ? AND end_time > ?`
        ).get(targetRoomId, id, endTime, startTime);

        if (roomConflict) {
          return reply.code(409).send({ error: "Time conflict with another appointment in this room" });
        }
      }

      // Store original values for audit
      const originalStart = appointment.start_time;
      const originalEnd = appointment.end_time;
      const originalRoom = appointment.room_id;

      // Perform the reschedule
      const updates = ["start_time = ?", "end_time = ?", "updated_at = datetime('now')"];
      const values: any[] = [startTime, endTime];

      if (roomId !== undefined) {
        updates.push("room_id = ?");
        values.push(roomId);
      }

      values.push(id);
      const updated = rawSqlite.prepare(
        `UPDATE appointments SET ${updates.join(", ")} WHERE id = ? RETURNING *`
      ).get(...values);

      // Create notification for client
      const dateStr = new Date(startTime).toLocaleString("cs-CZ");
      rawSqlite.prepare(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES (?, 'APPOINTMENT_UPDATED', 'Přesunutý termín', ?)`
      ).run(
        appointment.client_id,
        `Váš termín byl přesunut na ${dateStr}.`
      );

      return {
        ...(updated as any),
        rescheduledBy: userId,
        previousStartTime: originalStart,
        previousEndTime: originalEnd,
        previousRoomId: originalRoom,
      };
    }
  );
};

export default appointmentRescheduleRoutes;
