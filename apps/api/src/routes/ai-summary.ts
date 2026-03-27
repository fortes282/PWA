/**
 * AI Summary — Intensive Block Summaries
 * Aggregates all data for an intensive block (appointments, homework,
 * questionnaires, medical reports) into a structured summary.
 * AI integration placeholder — currently returns aggregated data only.
 */
import type { FastifyPluginAsync } from "fastify";
import { rawSqlite } from "../db/index.js";

function ensureAiSummaryTable() {
  rawSqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL,
      summary_json TEXT NOT NULL,
      generated_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_summaries_block ON ai_summaries(block_id);
  `);
}

function aggregateBlockData(blockId: number) {
  // Block info
  const block = rawSqlite.prepare(
    `SELECT ib.*, u.name as employee_name
     FROM intensive_blocks ib
     LEFT JOIN users u ON u.id = ib.employee_id
     WHERE ib.id = ?`
  ).get(blockId) as any;

  if (!block) return null;

  // Enrollees
  const enrollees = rawSqlite.prepare(
    `SELECT ibe.*, u.name as client_name, u.email as client_email
     FROM intensive_block_enrollments ibe
     JOIN users u ON u.id = ibe.client_id
     WHERE ibe.block_id = ? AND ibe.status = 'ENROLLED'`
  ).all(blockId) as any[];

  const clientIds = enrollees.map((e: any) => e.client_id);
  if (clientIds.length === 0) {
    return { block, enrollees, appointments: [], homework: [], questionnaires: [], healthRecords: [] };
  }

  const placeholders = clientIds.map(() => "?").join(",");

  // Appointments in the block date range for enrolled clients
  const appointments = rawSqlite.prepare(
    `SELECT a.*, u.name as client_name, e.name as employee_name, s.name as service_name
     FROM appointments a
     LEFT JOIN users u ON u.id = a.client_id
     LEFT JOIN users e ON e.id = a.employee_id
     LEFT JOIN services s ON s.id = a.service_id
     WHERE a.client_id IN (${placeholders})
       AND a.start_time >= ? AND a.end_time <= ?
     ORDER BY a.start_time ASC`
  ).all(...clientIds, block.start_date, block.end_date + "T23:59:59");

  // Homework for enrolled clients
  const homework = rawSqlite.prepare(
    `SELECT h.*, u.name as client_name
     FROM homework h
     LEFT JOIN users u ON u.id = h.client_id
     WHERE h.client_id IN (${placeholders})
     ORDER BY h.created_at DESC`
  ).all(...clientIds);

  // Questionnaire responses (if table exists)
  let questionnaires: any[] = [];
  try {
    questionnaires = rawSqlite.prepare(
      `SELECT qr.*, u.name as client_name
       FROM questionnaire_responses qr
       LEFT JOIN users u ON u.id = qr.client_id
       WHERE qr.client_id IN (${placeholders})
       ORDER BY qr.created_at DESC`
    ).all(...clientIds);
  } catch {
    // Table may not exist yet
  }

  // Health records for enrolled clients
  const healthRecords = rawSqlite.prepare(
    `SELECT hr.*, u.name as client_name
     FROM health_records hr
     LEFT JOIN users u ON u.id = hr.client_id
     WHERE hr.client_id IN (${placeholders})`
  ).all(...clientIds);

  return {
    block,
    enrollees,
    appointments,
    homework,
    questionnaires,
    healthRecords,
    stats: {
      totalEnrollees: enrollees.length,
      totalAppointments: appointments.length,
      completedAppointments: (appointments as any[]).filter((a: any) => a.status === "COMPLETED").length,
      totalHomework: homework.length,
      completedHomework: (homework as any[]).filter((h: any) => h.status === "COMPLETED").length,
    },
  };
}

const aiSummaryRoutes: FastifyPluginAsync = async (fastify) => {
  ensureAiSummaryTable();

  // POST /ai-summary/intensive/:blockId — generate summary (EMPLOYEE/ADMIN)
  fastify.post<{ Params: { blockId: string } }>(
    "/ai-summary/intensive/:blockId",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      if (!["EMPLOYEE", "ADMIN"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const blockId = parseInt(request.params.blockId);
      const data = aggregateBlockData(blockId);
      if (!data) return reply.code(404).send({ error: "Intensive block not found" });

      const summaryJson = JSON.stringify(data);

      // Cache the summary
      const result = rawSqlite.prepare(
        `INSERT INTO ai_summaries (block_id, summary_json, generated_by)
         VALUES (?, ?, ?)
         RETURNING *`
      ).get(blockId, summaryJson, userId);

      return reply.code(201).send({
        ...(result as any),
        summary: data,
      });
    }
  );

  // GET /ai-summary/intensive/:blockId — get cached summary (EMPLOYEE/ADMIN)
  fastify.get<{ Params: { blockId: string } }>(
    "/ai-summary/intensive/:blockId",
    async (request, reply) => {
      const { role } = request.auth!;
      if (!["EMPLOYEE", "ADMIN"].includes(role)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const blockId = parseInt(request.params.blockId);

      // Return most recent cached summary
      const cached = rawSqlite.prepare(
        `SELECT s.*, u.name as generated_by_name
         FROM ai_summaries s
         LEFT JOIN users u ON u.id = s.generated_by
         WHERE s.block_id = ?
         ORDER BY s.created_at DESC
         LIMIT 1`
      ).get(blockId) as any;

      if (!cached) {
        return reply.code(404).send({ error: "No summary found. Use POST to generate one." });
      }

      return {
        ...cached,
        summary: JSON.parse(cached.summary_json),
      };
    }
  );
};

export default aiSummaryRoutes;
