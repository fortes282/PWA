import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { users, appointments, invoices, medicalReports } from "../db/schema.js";
import { searchSchemas } from "../utils/swagger-schemas.js";

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /search?q=<query>&limit=10 — ADMIN/RECEPTION/EMPLOYEE
  fastify.get("/search", { schema: searchSchemas.search }, async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }

    const q = request.query as { q?: string; limit?: string };
    if (!q.q || q.q.trim().length < 2) {
      return reply.code(400).send({ error: "Query must be at least 2 characters" });
    }

    const query = q.q.trim().toLowerCase();
    const limit = Math.min(Math.max(parseInt(q.limit ?? "10"), 1), 50);
    const results: Array<{ type: string; id: number; label: string; meta: Record<string, unknown> }> = [];

    // Search users (name, email)
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      if (results.length >= limit) break;
      if (u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)) {
        results.push({
          type: "user",
          id: u.id,
          label: u.name,
          meta: { email: u.email, role: u.role },
        });
      }
    }

    // Search appointments (notes)
    const allAppts = await db.select().from(appointments);
    for (const a of allAppts) {
      if (results.length >= limit) break;
      if (a.notes && a.notes.toLowerCase().includes(query)) {
        results.push({
          type: "appointment",
          id: a.id,
          label: `Termín #${a.id} - ${a.startTime.slice(0, 10)}`,
          meta: { startTime: a.startTime, status: a.status, notes: a.notes },
        });
      }
    }

    // Search invoices (invoiceNumber)
    const allInvoices = await db.select().from(invoices);
    for (const inv of allInvoices) {
      if (results.length >= limit) break;
      if (inv.invoiceNumber.toLowerCase().includes(query)) {
        results.push({
          type: "invoice",
          id: inv.id,
          label: inv.invoiceNumber,
          meta: { status: inv.status, total: inv.total },
        });
      }
    }

    // Search medical reports (title, diagnosis)
    const allMedical = await db.select().from(medicalReports);
    for (const m of allMedical) {
      if (results.length >= limit) break;
      if (
        m.title.toLowerCase().includes(query) ||
        (m.diagnosis && m.diagnosis.toLowerCase().includes(query))
      ) {
        results.push({
          type: "medical",
          id: m.id,
          label: m.title,
          meta: { diagnosis: m.diagnosis, clientId: m.clientId },
        });
      }
    }

    return { results: results.slice(0, limit) };
  });
};

export default searchRoutes;
