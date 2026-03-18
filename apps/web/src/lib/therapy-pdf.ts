import jsPDF from "jspdf";

interface TemplateField {
  id: string;
  label: string;
  type: "text" | "textarea" | "scale" | "checkbox";
  min?: number;
  max?: number;
}

interface TherapyReportData {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  data: Record<string, unknown>;
  client: { id: number; name: string; phone?: string } | null;
  therapist: { id: number; name: string } | null;
  template: {
    id: number;
    name: string;
    category: string;
    structure: TemplateField[];
  } | null;
}

export function generateTherapyReportPDF(report: TherapyReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 0;

  const addPage = () => {
    doc.addPage();
    y = margin;
  };

  const checkPageBreak = (needed = 10) => {
    if (y + needed > 285) addPage();
  };

  // ── Header ────────────────────────────────────────────────────────────────
  // Blue top bar
  doc.setFillColor(37, 99, 235); // blue-600
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Přístav Radosti", margin, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Centrum neurorehabilitace a podpory", margin, 19);
  doc.text("www.pristav-radosti.cz", margin, 24);

  // Report title on the right
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(report.title, 80);
  doc.text(titleLines, 210 - margin, 14, { align: "right" });

  y = 34;

  // ── Meta info box ─────────────────────────────────────────────────────────
  doc.setFillColor(243, 244, 246); // gray-100
  doc.roundedRect(margin, y, contentW, 24, 2, 2, "F");

  doc.setTextColor(55, 65, 81); // gray-700
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Klient:", margin + 4, y + 6);
  doc.text("Terapeut:", margin + 4, y + 12);
  doc.text("Datum:", margin + 4, y + 18);

  doc.setFont("helvetica", "normal");
  doc.text(report.client?.name ?? "—", margin + 28, y + 6);
  doc.text(report.therapist?.name ?? "—", margin + 28, y + 12);
  doc.text(new Date(report.createdAt).toLocaleDateString("cs-CZ"), margin + 28, y + 18);

  const half = contentW / 2;
  doc.setFont("helvetica", "bold");
  doc.text("Typ zprávy:", margin + half + 4, y + 6);
  doc.text("Stav:", margin + half + 4, y + 12);

  doc.setFont("helvetica", "normal");
  doc.text(report.template?.name ?? "—", margin + half + 28, y + 6);
  doc.text(report.status === "FINAL" ? "Finální" : "Koncept", margin + half + 28, y + 12);

  if (report.client?.phone) {
    doc.setFont("helvetica", "bold");
    doc.text("Telefon:", margin + half + 4, y + 18);
    doc.setFont("helvetica", "normal");
    doc.text(report.client.phone, margin + half + 28, y + 18);
  }

  y += 30;

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Content: filled fields ────────────────────────────────────────────────
  const fields: TemplateField[] = report.template?.structure ?? [];

  for (const field of fields) {
    const value = report.data[field.id];
    if (value === undefined || value === null || value === "") continue;

    checkPageBreak(18);

    // Field label
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text(field.label, margin, y);
    y += 5;

    // Field value
    doc.setTextColor(31, 41, 55); // gray-800
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    if (field.type === "scale") {
      const num = Number(value);
      // Draw scale visualization
      const stars = "★".repeat(num) + "☆".repeat((field.max ?? 5) - num);
      doc.text(`${stars}  (${num}/${field.max ?? 5})`, margin + 2, y);
      y += 6;
    } else if (field.type === "checkbox") {
      doc.text(value ? "☑ Ano" : "☐ Ne", margin + 2, y);
      y += 6;
    } else {
      const text = String(value);
      const wrapped = doc.splitTextToSize(text, contentW - 4);
      for (const line of wrapped) {
        checkPageBreak(6);
        doc.text(line, margin + 2, y);
        y += 5.5;
      }
      y += 1;
    }

    // Separator line
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  }

  // If no template, show raw data
  if (fields.length === 0 && report.data) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    const raw = JSON.stringify(report.data, null, 2);
    const wrapped = doc.splitTextToSize(raw, contentW);
    for (const line of wrapped) {
      checkPageBreak(6);
      doc.text(line, margin, y);
      y += 5.5;
    }
  }

  // ── Signature block ───────────────────────────────────────────────────────
  checkPageBreak(30);
  y = Math.max(y, 240);

  doc.setDrawColor(156, 163, 175); // gray-400
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 60, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128);
  doc.text("Podpis terapeuta", margin, y + 5);
  doc.text(report.therapist?.name ?? "", margin, y + 10);

  doc.line(pageW - margin - 60, y, pageW - margin, y);
  doc.text("Datum a místo", pageW - margin - 60, y + 5);
  doc.text(new Date().toLocaleDateString("cs-CZ"), pageW - margin - 60, y + 10);

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Přístav Radosti · Terapeutická zpráva · strana ${i}/${pageCount}`,
      pageW / 2,
      294,
      { align: "center" }
    );
  }

  const filename = `terapeuticka-zprava-${report.id}-${report.client?.name?.replace(/\s+/g, "-") ?? "klient"}.pdf`;
  doc.save(filename);
}
