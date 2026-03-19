/**
 * SHOULD #11 — Pojišťovnová fakturace
 * Routes:
 *   /insurance/companies         — CRUD pojišťoven
 *   /insurance/procedures        — CRUD výkonů
 *   /insurance/procedure-mapping — mapování služeb
 *   /insurance/claims            — výkony/nároky
 *   /insurance/batches           — dávky + DASTA XML generování
 *   /insurance/billing/dashboard — přehled
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import {
  insuranceCompanies,
  insuranceProcedures,
  serviceProcedureMapping,
  insuranceClaims,
  insuranceBatches,
  appointments,
  users,
  services,
} from "../db/schema.js";
import { eq, and, inArray, sql } from "drizzle-orm";

// ─── DASTA XML generator (simplified) ────────────────────────────────────────
function generateDastaXml(opts: {
  icp: string; // IČP poskytovatele
  icz: string; // IČZ
  period: string; // "2024-03"
  insuranceCode: string;
  claims: Array<{
    procedureCode: string;
    procedureName: string;
    date: string;
    diagnosis: string;
    insuranceNumber: string;
    amount: number;
    points: number;
  }>;
}): string {
  const { icp, icz, period, insuranceCode, claims } = opts;
  const [year, month] = period.split("-");
  const now = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);

  const claimsXml = claims
    .map(
      (c, i) => `    <VYKAZ id="${i + 1}">
      <CISLO_POJISTENCE>${c.insuranceNumber}</CISLO_POJISTENCE>
      <DATUM>${c.date}</DATUM>
      <KOD_VYKONU>${c.procedureCode}</KOD_VYKONU>
      <NAZEV_VYKONU>${escapeXml(c.procedureName)}</NAZEV_VYKONU>
      <DIAGNOZA>${c.diagnosis || "Z00"}</DIAGNOZA>
      <BODY>${c.points}</BODY>
      <CASTKA>${c.amount.toFixed(2)}</CASTKA>
    </VYKAZ>`
    )
    .join("\n");

  const total = claims.reduce((s, c) => s + c.amount, 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<DASTA_DAVKA xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" verze="3.02">
  <HLAVICKA>
    <ICP>${icp}</ICP>
    <ICZ>${icz}</ICZ>
    <KOD_ZP>${insuranceCode}</KOD_ZP>
    <OBDOBI_ROK>${year}</OBDOBI_ROK>
    <OBDOBI_MESIC>${month}</OBDOBI_MESIC>
    <DATUM_GENEROVANI>${now}</DATUM_GENEROVANI>
    <POCET_VYKAZU>${claims.length}</POCET_VYKAZU>
    <CELKOVA_CASTKA>${total.toFixed(2)}</CELKOVA_CASTKA>
  </HLAVICKA>
  <VYKAZY>
${claimsXml}
  </VYKAZY>
</DASTA_DAVKA>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const insuranceRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Insurance Companies ──────────────────────────────────────────────────

  // GET /insurance/companies
  fastify.get("/insurance/companies", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    return db.select().from(insuranceCompanies).orderBy(insuranceCompanies.code);
  });

  // GET /insurance/companies/:id
  fastify.get<{ Params: { id: string } }>("/insurance/companies/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const [row] = await db.select().from(insuranceCompanies)
      .where(eq(insuranceCompanies.id, parseInt(request.params.id))).limit(1);
    if (!row) return reply.code(404).send({ error: "Not found" });
    return row;
  });

  // POST /insurance/companies
  fastify.post("/insurance/companies", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const body = request.body as {
      code: string; name: string; contactEmail?: string; contactPhone?: string; contractNotes?: string;
    };
    const [row] = await db.insert(insuranceCompanies).values({
      code: body.code,
      name: body.name,
      contactEmail: body.contactEmail ?? null,
      contactPhone: body.contactPhone ?? null,
      contractNotes: body.contractNotes ?? null,
    }).returning();
    return reply.code(201).send(row);
  });

  // PATCH /insurance/companies/:id
  fastify.patch<{ Params: { id: string } }>("/insurance/companies/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const id = parseInt(request.params.id);
    const body = request.body as Partial<{
      code: string; name: string; contactEmail: string; contactPhone: string; contractNotes: string; isActive: boolean;
    }>;
    const [updated] = await db.update(insuranceCompanies)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(insuranceCompanies.id, id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Not found" });
    return updated;
  });

  // DELETE /insurance/companies/:id
  fastify.delete<{ Params: { id: string } }>("/insurance/companies/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    await db.delete(insuranceCompanies).where(eq(insuranceCompanies.id, parseInt(request.params.id)));
    return { ok: true };
  });

  // ── Insurance Procedures ─────────────────────────────────────────────────

  // GET /insurance/procedures
  fastify.get("/insurance/procedures", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    return db.select().from(insuranceProcedures).orderBy(insuranceProcedures.code);
  });

  // POST /insurance/procedures
  fastify.post("/insurance/procedures", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const body = request.body as {
      code: string; name: string; points?: number; pointPrice?: number; maxPerDay?: number; maxPerMonth?: number;
    };
    const [row] = await db.insert(insuranceProcedures).values({
      code: body.code,
      name: body.name,
      points: body.points ?? 0,
      pointPrice: body.pointPrice ?? 1.0,
      maxPerDay: body.maxPerDay ?? null,
      maxPerMonth: body.maxPerMonth ?? null,
    }).returning();
    return reply.code(201).send(row);
  });

  // PATCH /insurance/procedures/:id
  fastify.patch<{ Params: { id: string } }>("/insurance/procedures/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const id = parseInt(request.params.id);
    const body = request.body as Partial<{
      code: string; name: string; points: number; pointPrice: number; maxPerDay: number; maxPerMonth: number; isActive: boolean;
    }>;
    const [updated] = await db.update(insuranceProcedures)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(insuranceProcedures.id, id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Not found" });
    return updated;
  });

  // DELETE /insurance/procedures/:id
  fastify.delete<{ Params: { id: string } }>("/insurance/procedures/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    await db.delete(insuranceProcedures).where(eq(insuranceProcedures.id, parseInt(request.params.id)));
    return { ok: true };
  });

  // ── Service → Procedure Mapping ─────────────────────────────────────────

  // GET /insurance/procedure-mapping
  fastify.get("/insurance/procedure-mapping", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const rows = await db.select().from(serviceProcedureMapping);
    return rows;
  });

  // POST /insurance/procedure-mapping
  fastify.post("/insurance/procedure-mapping", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const body = request.body as { serviceId: number; procedureId: number };
    // Remove existing mapping for this service first (1:1 for simplicity)
    await db.delete(serviceProcedureMapping).where(eq(serviceProcedureMapping.serviceId, body.serviceId));
    const [row] = await db.insert(serviceProcedureMapping).values({
      serviceId: body.serviceId,
      procedureId: body.procedureId,
    }).returning();
    return reply.code(201).send(row);
  });

  // DELETE /insurance/procedure-mapping/:id
  fastify.delete<{ Params: { id: string } }>("/insurance/procedure-mapping/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    await db.delete(serviceProcedureMapping).where(eq(serviceProcedureMapping.id, parseInt(request.params.id)));
    return { ok: true };
  });

  // ── Insurance Claims ─────────────────────────────────────────────────────

  // GET /insurance/claims
  fastify.get("/insurance/claims", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const q = request.query as { status?: string; insuranceCompanyId?: string; period?: string };

    let claimRows = await db.select().from(insuranceClaims);

    if (q.status) claimRows = claimRows.filter((c) => c.status === q.status);

    // Enrich
    const apptIds = [...new Set(claimRows.map((c) => c.appointmentId))];
    const appts = apptIds.length > 0
      ? await db.select().from(appointments).where(inArray(appointments.id, apptIds))
      : [];
    const apptMap = Object.fromEntries(appts.map((a) => [a.id, a]));

    const procIds = [...new Set(claimRows.map((c) => c.procedureId))];
    const procs = procIds.length > 0
      ? await db.select().from(insuranceProcedures).where(inArray(insuranceProcedures.id, procIds))
      : [];
    const procMap = Object.fromEntries(procs.map((p) => [p.id, p]));

    // filter by insurance company / period if provided
    let result = claimRows.map((c) => {
      const appt = apptMap[c.appointmentId];
      return {
        ...c,
        appointment: appt ?? null,
        procedure: procMap[c.procedureId] ?? null,
      };
    });

    if (q.period && q.period.length === 7) {
      result = result.filter((c) => c.appointment?.startTime?.startsWith(q.period!));
    }

    if (q.insuranceCompanyId) {
      const icId = parseInt(q.insuranceCompanyId);
      // filter by client's insurance company
      const clientIds = [...new Set(result.map((c) => c.appointment?.clientId).filter(Boolean))] as number[];
      if (clientIds.length > 0) {
        const clientsData = await db.select({
          id: users.id,
          insuranceCompanyId: users.insuranceCompanyId,
          insuranceNumber: users.insuranceNumber,
          name: users.name,
        }).from(users).where(inArray(users.id, clientIds));
        const clientMap = Object.fromEntries(clientsData.map((u) => [u.id, u]));
        result = result.filter((c) => {
          const client = clientMap[c.appointment?.clientId ?? -1];
          return client?.insuranceCompanyId === icId;
        });
      } else {
        result = [];
      }
    }

    return result;
  });

  // POST /insurance/claims — assign procedure to appointment
  fastify.post("/insurance/claims", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION", "EMPLOYEE"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const body = request.body as {
      appointmentId: number; procedureId: number; diagnosis?: string;
    };
    // Compute amount from procedure points
    const [proc] = await db.select().from(insuranceProcedures)
      .where(eq(insuranceProcedures.id, body.procedureId)).limit(1);
    if (!proc) return reply.code(400).send({ error: "Procedure not found" });

    const amount = proc.points * proc.pointPrice;

    const [row] = await db.insert(insuranceClaims).values({
      appointmentId: body.appointmentId,
      procedureId: body.procedureId,
      diagnosis: body.diagnosis ?? null,
      amount,
      status: "UNBILLED",
    }).returning();
    return reply.code(201).send(row);
  });

  // PATCH /insurance/claims/:id
  fastify.patch<{ Params: { id: string } }>("/insurance/claims/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (!["ADMIN", "RECEPTION"].includes(role)) return reply.code(403).send({ error: "Forbidden" });
    const id = parseInt(request.params.id);
    const body = request.body as Partial<{
      status: "UNBILLED" | "GENERATED" | "SENT" | "PAID" | "REJECTED"; diagnosis: string; procedureId: number; batchId: number;
    }>;
    const [updated] = await db.update(insuranceClaims)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(insuranceClaims.id, id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Not found" });
    return updated;
  });

  // ── Insurance Batches ────────────────────────────────────────────────────

  // GET /insurance/batches
  fastify.get("/insurance/batches", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const batches = await db.select().from(insuranceBatches)
      .orderBy(insuranceBatches.createdAt);

    // Enrich with company name
    const compIds = [...new Set(batches.map((b) => b.insuranceCompanyId))];
    const comps = compIds.length > 0
      ? await db.select().from(insuranceCompanies).where(inArray(insuranceCompanies.id, compIds))
      : [];
    const compMap = Object.fromEntries(comps.map((c) => [c.id, c]));

    return batches.map((b) => ({ ...b, insuranceCompany: compMap[b.insuranceCompanyId] ?? null }));
  });

  // GET /insurance/batches/:id/xml — download XML
  fastify.get<{ Params: { id: string } }>("/insurance/batches/:id/xml", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const [batch] = await db.select().from(insuranceBatches)
      .where(eq(insuranceBatches.id, parseInt(request.params.id))).limit(1);
    if (!batch) return reply.code(404).send({ error: "Not found" });
    if (!batch.xmlContent) return reply.code(404).send({ error: "No XML generated" });

    const filename = `davka-${batch.period}-${batch.id}.xml`;
    reply
      .header("Content-Type", "application/xml; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(batch.xmlContent);
  });

  // PATCH /insurance/batches/:id — update status
  fastify.patch<{ Params: { id: string } }>("/insurance/batches/:id", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });
    const id = parseInt(request.params.id);
    const body = request.body as { status: string };
    const [updated] = await db.update(insuranceBatches)
      .set({ status: body.status as any, updatedAt: new Date().toISOString() })
      .where(eq(insuranceBatches.id, id))
      .returning();
    if (!updated) return reply.code(404).send({ error: "Not found" });

    // If marking as PAID, update all claims in this batch
    if (body.status === "PAID") {
      await db.update(insuranceClaims)
        .set({ status: "PAID", updatedAt: new Date().toISOString() })
        .where(eq(insuranceClaims.batchId, id));
    } else if (body.status === "REJECTED") {
      await db.update(insuranceClaims)
        .set({ status: "REJECTED", updatedAt: new Date().toISOString() })
        .where(eq(insuranceClaims.batchId, id));
    }

    return updated;
  });

  // POST /insurance/batches/generate — generate DASTA XML batch
  fastify.post("/insurance/batches/generate", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const body = request.body as {
      insuranceCompanyId: number;
      period: string; // "YYYY-MM"
      icp?: string;
      icz?: string;
    };

    const icp = body.icp ?? "12345678";
    const icz = body.icz ?? "87654321";

    // Get company
    const [company] = await db.select().from(insuranceCompanies)
      .where(eq(insuranceCompanies.id, body.insuranceCompanyId)).limit(1);
    if (!company) return reply.code(400).send({ error: "Insurance company not found" });

    // Find UNBILLED claims for this period and this insurance company
    const allClaims = await db.select().from(insuranceClaims)
      .where(eq(insuranceClaims.status, "UNBILLED"));

    const apptIds = [...new Set(allClaims.map((c) => c.appointmentId))];
    const appts = apptIds.length > 0
      ? await db.select().from(appointments).where(inArray(appointments.id, apptIds))
      : [];
    const apptMap = Object.fromEntries(appts.map((a) => [a.id, a]));

    // Filter by period
    const periodClaims = allClaims.filter((c) => {
      const appt = apptMap[c.appointmentId];
      return appt?.startTime?.startsWith(body.period);
    });

    if (periodClaims.length === 0) {
      return reply.code(400).send({ error: "No unbilled claims for this period" });
    }

    // Get clients with insurance data
    const clientIds = [...new Set(appts.map((a) => a.clientId))];
    const clientsData = await db.select({
      id: users.id,
      insuranceCompanyId: users.insuranceCompanyId,
      insuranceNumber: users.insuranceNumber,
      name: users.name,
    }).from(users).where(inArray(users.id, clientIds));
    const clientMap = Object.fromEntries(clientsData.map((u) => [u.id, u]));

    // Filter claims by insurance company
    const filteredClaims = periodClaims.filter((c) => {
      const appt = apptMap[c.appointmentId];
      const client = clientMap[appt?.clientId ?? -1];
      return client?.insuranceCompanyId === body.insuranceCompanyId;
    });

    if (filteredClaims.length === 0) {
      return reply.code(400).send({ error: "No unbilled claims for this company in this period" });
    }

    // Get procedures
    const procIds = [...new Set(filteredClaims.map((c) => c.procedureId))];
    const procs = await db.select().from(insuranceProcedures)
      .where(inArray(insuranceProcedures.id, procIds));
    const procMap = Object.fromEntries(procs.map((p) => [p.id, p]));

    // Build XML items
    const xmlClaims = filteredClaims.map((c) => {
      const appt = apptMap[c.appointmentId];
      const client = clientMap[appt?.clientId ?? -1];
      const proc = procMap[c.procedureId];
      return {
        procedureCode: proc?.code ?? "",
        procedureName: proc?.name ?? "",
        date: appt?.startTime?.slice(0, 10) ?? "",
        diagnosis: c.diagnosis ?? "Z00",
        insuranceNumber: client?.insuranceNumber ?? "",
        amount: c.amount,
        points: proc?.points ?? 0,
      };
    });

    const xml = generateDastaXml({
      icp, icz,
      period: body.period,
      insuranceCode: company.code,
      claims: xmlClaims,
    });

    const totalAmount = filteredClaims.reduce((s, c) => s + c.amount, 0);

    // Insert batch
    const [batch] = await db.insert(insuranceBatches).values({
      insuranceCompanyId: body.insuranceCompanyId,
      period: body.period,
      xmlContent: xml,
      status: "GENERATED",
      totalAmount,
      claimsCount: filteredClaims.length,
    }).returning();

    // Update claims — set batchId and status to GENERATED
    const claimIds = filteredClaims.map((c) => c.id);
    await db.update(insuranceClaims)
      .set({ batchId: batch.id, status: "GENERATED", updatedAt: new Date().toISOString() })
      .where(inArray(insuranceClaims.id, claimIds));

    return { batch, claimsCount: filteredClaims.length, totalAmount };
  });

  // ── Billing Dashboard ────────────────────────────────────────────────────

  // GET /insurance/billing/dashboard
  fastify.get("/insurance/billing/dashboard", async (request, reply) => {
    const { role } = request.auth!;
    if (role !== "ADMIN") return reply.code(403).send({ error: "Forbidden" });

    const all = await db.select().from(insuranceClaims);
    const unbilled = all.filter((c) => c.status === "UNBILLED");
    const generated = all.filter((c) => c.status === "GENERATED");
    const sent = all.filter((c) => c.status === "SENT");
    const paid = all.filter((c) => c.status === "PAID");
    const rejected = all.filter((c) => c.status === "REJECTED");

    const batches = await db.select().from(insuranceBatches);

    return {
      claims: {
        total: all.length,
        unbilled: unbilled.length,
        generated: generated.length,
        sent: sent.length,
        paid: paid.length,
        rejected: rejected.length,
        unbilledAmount: unbilled.reduce((s, c) => s + c.amount, 0),
        generatedAmount: generated.reduce((s, c) => s + c.amount, 0),
        paidAmount: paid.reduce((s, c) => s + c.amount, 0),
      },
      batches: {
        total: batches.length,
        generated: batches.filter((b) => b.status === "GENERATED").length,
        sent: batches.filter((b) => b.status === "SENT").length,
        paid: batches.filter((b) => b.status === "PAID").length,
      },
    };
  });
};

export default insuranceRoutes;
