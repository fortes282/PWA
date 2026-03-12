/**
 * PDF generation for medical reports and invoices.
 * Uses simple text-based PDF (no external library needed for basic PDFs).
 * Returns application/pdf binary.
 */
import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/index.js";
import { medicalReports, invoices, invoiceItems, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ─── Minimal PDF builder ──────────────────────────────────────────────────────
// We produce a valid single-page PDF without external dependencies.
function buildPdf(lines: string[]): Buffer {
  const lineHeight = 20;
  const marginX = 50;
  const marginY = 50;
  const pageWidth = 595;  // A4
  const pageHeight = 842;

  // Build content stream
  const streamLines: string[] = [
    "BT",
    "/F1 12 Tf",
    `${lineHeight} TL`,
  ];

  let y = pageHeight - marginY;
  for (const line of lines) {
    if (line === "---") {
      // Horizontal rule simulation
      streamLines.push("ET");
      streamLines.push(`${marginX} ${y} m ${pageWidth - marginX} ${y} l S`);
      y -= lineHeight;
      streamLines.push("BT");
      streamLines.push("/F1 12 Tf");
      continue;
    }
    if (line.startsWith("##")) {
      // Heading - bold size 16
      const text = line.replace(/^#+\s*/, "");
      streamLines.push(`/F1 16 Tf`);
      streamLines.push(`${marginX} ${y} Td`);
      streamLines.push(`(${escapePdf(text)}) Tj`);
      y -= lineHeight + 6;
      streamLines.push(`/F1 12 Tf`);
      streamLines.push(`${marginX} ${y} Td`);
    } else if (line.startsWith("#")) {
      const text = line.replace(/^#+\s*/, "");
      streamLines.push(`/F1 18 Tf`);
      streamLines.push(`${marginX} ${y} Td`);
      streamLines.push(`(${escapePdf(text)}) Tj`);
      y -= lineHeight + 10;
      streamLines.push(`/F1 12 Tf`);
      streamLines.push(`${marginX} ${y} Td`);
    } else {
      streamLines.push(`${marginX} ${y} Td`);
      streamLines.push(`(${escapePdf(line)}) Tj`);
      y -= lineHeight;
    }

    if (y < marginY + lineHeight) {
      // Prevent overflow (basic)
      y = marginY + lineHeight;
    }
  }

  streamLines.push("ET");
  const contentStream = streamLines.join("\n");
  const contentBytes = Buffer.from(contentStream, "latin1");
  const contentLen = contentBytes.length;

  // Build PDF structure
  const pdfParts: Buffer[] = [];
  const offsets: number[] = [];

  const header = Buffer.from("%PDF-1.4\n");
  pdfParts.push(header);
  let offset = header.length;

  // Obj 1: catalog
  offsets[1] = offset;
  const obj1 = Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  pdfParts.push(obj1);
  offset += obj1.length;

  // Obj 2: pages
  offsets[2] = offset;
  const obj2 = Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  pdfParts.push(obj2);
  offset += obj2.length;

  // Obj 3: page
  offsets[3] = offset;
  const obj3 = Buffer.from(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`
  );
  pdfParts.push(obj3);
  offset += obj3.length;

  // Obj 4: content stream
  offsets[4] = offset;
  const streamHeader = `4 0 obj\n<< /Length ${contentLen} >>\nstream\n`;
  const streamFooter = `\nendstream\nendobj\n`;
  const obj4 = Buffer.concat([
    Buffer.from(streamHeader),
    contentBytes,
    Buffer.from(streamFooter),
  ]);
  pdfParts.push(obj4);
  offset += obj4.length;

  // Obj 5: font
  offsets[5] = offset;
  const obj5 = Buffer.from(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n"
  );
  pdfParts.push(obj5);
  offset += obj5.length;

  // xref table
  const xrefOffset = offset;
  const xref = [
    "xref\n",
    `0 6\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`),
    "trailer\n",
    "<< /Size 6 /Root 1 0 R >>\n",
    "startxref\n",
    `${xrefOffset}\n`,
    "%%EOF\n",
  ].join("");
  pdfParts.push(Buffer.from(xref));

  return Buffer.concat(pdfParts);
}

function escapePdf(text: string): string {
  // Replace non-latin1 chars with '?' and escape PDF special chars
  return text
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\\/g, "\\\\");
}

// ─── Routes ───────────────────────────────────────────────────────────────────
const pdfRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /pdf/medical-report/:id
  fastify.get<{ Params: { id: string } }>(
    "/pdf/medical-report/:id",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      const reportId = parseInt(request.params.id);

      const [report] = await db
        .select()
        .from(medicalReports)
        .where(eq(medicalReports.id, reportId))
        .limit(1);
      if (!report) return reply.code(404).send({ error: "Not found" });

      // Access check
      if (role === "CLIENT" && report.clientId !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      if (role === "EMPLOYEE" && report.employeeId !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const [client] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, report.clientId))
        .limit(1);
      const [employee] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, report.employeeId))
        .limit(1);

      const lines = [
        "# Pristav Radosti — Neurologicka rehabilitace",
        "---",
        `## ${report.title}`,
        "",
        `Klient: ${client?.name ?? "?"}  |  Terapeut: ${employee?.name ?? "?"}`,
        `Datum: ${report.createdAt.slice(0, 10)}`,
        "---",
        "Obsah zpravy:",
        ...report.content.split("\n").map((l) => `  ${l}`),
      ];

      if (report.diagnosis) {
        lines.push("", "Diagnoza:", `  ${report.diagnosis}`);
      }
      if (report.recommendations) {
        lines.push("", "Doporuceni:", `  ${report.recommendations}`);
      }
      lines.push("", "---", `Vygenerovano: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`);

      const pdfBuf = buildPdf(lines);

      reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="zprava-${report.id}.pdf"`
        )
        .send(pdfBuf);
    }
  );

  // GET /pdf/invoice/:id
  fastify.get<{ Params: { id: string } }>(
    "/pdf/invoice/:id",
    async (request, reply) => {
      const { id: userId, role } = request.auth!;
      const invId = parseInt(request.params.id);

      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invId))
        .limit(1);
      if (!inv) return reply.code(404).send({ error: "Not found" });
      if (role === "CLIENT" && inv.clientId !== userId) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const items = await db
        .select()
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invId));

      const [client] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, inv.clientId))
        .limit(1);

      const statusMap: Record<string, string> = {
        DRAFT: "Koncept",
        SENT: "Odeslana",
        PAID: "Zaplacena",
        OVERDUE: "Po splatnosti",
        CANCELLED: "Stornována",
      };

      const lines = [
        "# Pristav Radosti — Faktura",
        "---",
        `## ${inv.invoiceNumber}`,
        "",
        `Klient: ${client?.name ?? "?"} (${client?.email ?? "?"})`,
        `Stav: ${statusMap[inv.status] ?? inv.status}`,
        `Splatnost: ${inv.dueDate}`,
        inv.paidAt ? `Zaplaceno: ${inv.paidAt.slice(0, 10)}` : "",
        "---",
        "Polozky:",
        ...items.map(
          (it) =>
            `  ${it.description}  |  ${it.quantity}x ${it.unitPrice} Kc  =  ${it.total} Kc`
        ),
        "---",
        `Celkem: ${inv.total} Kc`,
        "",
        `Vygenerovano: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`,
      ];

      const pdfBuf = buildPdf(lines);

      reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="faktura-${inv.invoiceNumber}.pdf"`
        )
        .send(pdfBuf);
    }
  );
};

export default pdfRoutes;
