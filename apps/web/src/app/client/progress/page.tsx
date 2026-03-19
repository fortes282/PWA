"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef } from "react";
import {
  TrendingUp, Activity, FileText, Calendar, Star, Award,
  Target, CheckCircle2, Circle, AlertCircle, Download, Share2, Check
} from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
};

const SCORE_LABEL = (score: number) => {
  if (score >= 90) return "Výborný";
  if (score >= 75) return "Dobrý";
  if (score >= 60) return "Průměrný";
  if (score >= 40) return "Zhoršený";
  return "Kritický";
};

function SimpleBarChart({ data, valueKey, labelKey, maxVal, color = "#6366f1" }: {
  data: any[];
  valueKey: string;
  labelKey: string;
  maxVal?: number;
  color?: string;
}) {
  const max = maxVal ?? Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500 font-medium">{d[valueKey] ?? 0}</span>
          <div className="w-full bg-gray-100 rounded-t" style={{ height: 64 }}>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${((d[valueKey] ?? 0) / max) * 64}px`,
                marginTop: `${64 - ((d[valueKey] ?? 0) / max) * 64}px`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="text-[10px] text-gray-500 text-center leading-tight">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function ClientProgress() {
  const { user } = useAuth();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Use /appointments/stats for lightweight summary
  const { data: apptStats } = useSWR<any>("/appointments/stats", fetcher as any);
  const { data: appointments } = useSWR<any[]>(
    user ? `/appointments` : null,
    fetcher as any
  );
  const { data: credits } = useSWR<any[]>("/credits/history", fetcher as any);
  const { data: reports } = useSWR<any[]>("/medical-reports", fetcher as any);
  const { data: me } = useSWR<any>(user ? `/users/${user.id}` : null, fetcher);
  const { data: loyalty } = useSWR<any>(user ? "/loyalty/points" : null, fetcher as any);
  const { data: goals } = useSWR<any[]>(user ? `/clients/${user.id}/health-goals` : null, fetcher as any);
  const { data: progressData } = useSWR<any>(
    user ? `/reports/progress/${user.id}` : null,
    fetcher as any
  );

  const completed = (appointments ?? []).filter((a: any) => a.status === "COMPLETED");
  const totalCompleted = apptStats?.completed ?? completed.length;
  const totalCancelled = apptStats?.cancelled ?? (appointments ?? []).filter((a: any) => a.status === "CANCELLED").length;
  const score = me?.behaviorScore ?? 100;

  // Sessions per month (last 6 months) — use progressData if available, fallback to local calc
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleDateString("cs-CZ", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  const attendanceData = progressData?.attendance ?? months.map((m) => ({
    label: m.label,
    attended: completed.filter((a: any) => a.startTime.startsWith(m.key)).length,
    planned: (appointments ?? []).filter((a: any) => a.startTime.startsWith(m.key)).length,
  }));

  const ratingsData = progressData?.ratings ?? [];

  // Credit usage
  const totalSpent = (credits ?? [])
    .filter((t: any) => t.type === "USE")
    .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const totalPurchased = (credits ?? [])
    .filter((t: any) => t.type === "PURCHASE")
    .reduce((s: number, t: any) => s + t.amount, 0);
  const currentBalance = credits?.[0]?.balance ?? 0;

  const currentMonthLabel = now.toLocaleDateString("cs-CZ", { month: "long", year: "numeric" });

  async function handleExportPDF() {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      // Header branding
      doc.setFillColor(99, 102, 241); // indigo
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Přístav Radosti", margin, 13);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Progress Report — Klientský přehled", margin, 22);

      // Period top-right
      doc.setFontSize(9);
      doc.text(currentMonthLabel, pageWidth - margin, 13, { align: "right" });

      y = 40;
      doc.setTextColor(30, 30, 30);

      // Client info
      const clientName = me?.name ?? user?.name ?? "Klient";
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(clientName, margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Vygenerováno: ${formatDate(new Date().toISOString())}`, margin, y);
      y += 12;

      // Summary stats
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Přehled terapie", margin, y);
      y += 7;

      const stats = [
        ["Absolvovaných sezení:", String(totalCompleted)],
        ["Zrušených termínů:", String(totalCancelled)],
        ["Terapeutických zpráv:", String(reports?.length ?? 0)],
        ["Skóre dochvilnosti:", `${score}/100 (${SCORE_LABEL(score)})`],
        ["Aktuální kredit:", `${currentBalance.toFixed(0)} Kč`],
      ];
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      for (const [label, val] of stats) {
        doc.setTextColor(80, 80, 80);
        doc.text(label, margin, y);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text(val, margin + 70, y);
        doc.setFont("helvetica", "normal");
        y += 6;
      }
      y += 6;

      // Attendance per month
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text("Docházka — posledních 6 měsíců", margin, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const colW = (pageWidth - 2 * margin) / attendanceData.length;
      const barMaxH = 20;
      const maxAttended = Math.max(...attendanceData.map((d: any) => d.attended ?? 0), 1);

      for (let i = 0; i < attendanceData.length; i++) {
        const d = attendanceData[i];
        const x = margin + i * colW;
        const h = ((d.attended ?? 0) / maxAttended) * barMaxH;
        // bar
        doc.setFillColor(99, 102, 241);
        if (h > 0) doc.rect(x + 2, y + barMaxH - h, colW - 6, h, "F");
        // background
        doc.setDrawColor(200, 200, 200);
        doc.rect(x + 2, y, colW - 6, barMaxH, "S");
        // label
        doc.setTextColor(80, 80, 80);
        doc.text(d.label ?? "", x + colW / 2, y + barMaxH + 5, { align: "center" });
        // value
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text(String(d.attended ?? 0), x + colW / 2, y - 1, { align: "center" });
        doc.setFont("helvetica", "normal");
      }
      y += barMaxH + 14;

      // Milestones
      const milestones = progressData?.milestones ?? [];
      if (milestones.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text("Milníky terapie", margin, y);
        y += 7;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        for (const [i, m] of milestones.entries()) {
          doc.setTextColor(80, 80, 80);
          doc.text(`${i + 1}. ${m.title}`, margin, y);
          doc.setTextColor(120, 120, 120);
          doc.text(m.date, pageWidth - margin, y, { align: "right" });
          y += 5.5;
          if (y > 270) { doc.addPage(); y = 20; }
        }
        y += 5;
      }

      // Recommendation
      const rec = progressData?.latestRecommendation;
      if (rec) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text("Doporučení terapeuta", margin, y);
        y += 7;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60, 60, 60);
        const lines = doc.splitTextToSize(rec, pageWidth - 2 * margin);
        doc.text(lines, margin, y);
        y += lines.length * 5 + 5;
      }

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text("© Přístav Radosti — důvěrný dokument", margin, 290);
      doc.text(`Strana 1`, pageWidth - margin, 290, { align: "right" });

      doc.save(`progress-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.pdf`);
    } catch (err) {
      console.error("PDF export error", err);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Můj progress report — Přístav Radosti",
          text: `Přehled mé terapeutické cesty za ${currentMonthLabel}`,
          url,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      } catch {}
    }
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto" ref={reportRef}>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Můj pokrok</h1>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {shareSuccess ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
                {shareSuccess ? "Zkopírováno" : "Sdílet"}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
              >
                <Download size={14} />
                {pdfLoading ? "Generuji…" : "Stáhnout PDF"}
              </button>
            </div>
          </div>

          {/* Period info */}
          <p className="text-sm text-gray-500 mb-5 -mt-3">
            Přehled za: <span className="text-gray-600 font-medium">{currentMonthLabel}</span>
          </p>

          {/* Behavior score */}
          <div className="card mb-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star size={20} className="text-yellow-500" />
              <h2 className="font-semibold text-gray-900">Skóre dochvilnosti</h2>
            </div>
            <p className={`text-5xl font-bold ${SCORE_COLOR(score)} mb-1`}>{score}</p>
            <p className={`text-sm font-medium ${SCORE_COLOR(score)}`}>{SCORE_LABEL(score)}</p>
            <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Skóre se zvyšuje dochvilností a snižuje no-show nebo pozdním rušením
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card text-center">
              <Calendar size={20} className="text-primary-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalCompleted}</p>
              <p className="text-xs text-gray-500 mt-1">Absolvovaných sezení</p>
            </div>
            <div className="card text-center">
              <FileText size={20} className="text-primary-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{reports?.length ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Terapeutických zpráv</p>
            </div>
            <div className="card text-center">
              <TrendingUp size={20} className="text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{currentBalance.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Kredit zbývá</p>
            </div>
            <div className="card text-center">
              <Activity size={20} className="text-orange-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalCancelled}</p>
              <p className="text-xs text-gray-500 mt-1">Zrušených termínů</p>
            </div>
          </div>

          {/* Attendance chart */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Docházka — posledních 6 měsíců</h2>
            <SimpleBarChart
              data={attendanceData}
              valueKey="attended"
              labelKey="label"
              color="#6366f1"
            />
            {attendanceData.some((d: any) => (d.planned ?? 0) > (d.attended ?? 0)) && (
              <div className="mt-3 flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Absolvováno
                </span>
              </div>
            )}
          </div>

          {/* Ratings chart (if data exists) */}
          {ratingsData.some((r: any) => r.avgRating !== null) && (
            <div className="card mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Hodnocení sezení (1–5 ★)</h2>
              <SimpleBarChart
                data={ratingsData.map((r: any) => ({ ...r, displayRating: r.avgRating ?? 0 }))}
                valueKey="displayRating"
                labelKey="label"
                maxVal={5}
                color="#f59e0b"
              />
            </div>
          )}

          {/* Milestones */}
          {(progressData?.milestones?.length ?? 0) > 0 && (
            <div className="card mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Award size={18} className="text-yellow-500" />
                <h2 className="font-semibold text-gray-900">Milníky terapie</h2>
              </div>
              <div className="space-y-2">
                {(progressData.milestones as any[]).map((m: any, i: number) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                    <span className="text-xs text-gray-500 w-6 text-center">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.date}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.status === "FINAL" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {m.status === "FINAL" ? "Finální" : "Návrh"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Latest recommendation */}
          {progressData?.latestRecommendation && (
            <div className="card mb-6 border-l-4 border-primary-400">
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-primary-500" />
                <h2 className="font-semibold text-gray-900">Doporučení terapeuta</h2>
              </div>
              {progressData.latestReportTitle && (
                <p className="text-xs text-gray-500 mb-1">Ze zprávy: {progressData.latestReportTitle}</p>
              )}
              <p className="text-sm text-gray-700 leading-relaxed">{progressData.latestRecommendation}</p>
            </div>
          )}

          {/* Credit summary */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Přehled kreditů</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Celkem zakoupeno</span>
                <span className="font-medium text-green-600">+{totalPurchased.toFixed(0)} Kč</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Celkem využito</span>
                <span className="font-medium text-gray-700">−{totalSpent.toFixed(0)} Kč</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Aktuální zůstatek</span>
                <span className="text-primary-600">{currentBalance.toFixed(0)} Kč</span>
              </div>
            </div>
          </div>

          {/* Loyalty points widget */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Award size={18} className="text-yellow-500" />
              <h2 className="font-semibold text-gray-900">Věrnostní body</h2>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-3xl font-bold text-yellow-600">{loyalty?.balance ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">celkem bodů</p>
              </div>
              <div className="text-right text-xs text-gray-500">
                <p>+10 za dokončené sezení</p>
                <p>+5 za zaplacení faktury</p>
              </div>
            </div>
            {(loyalty?.history?.length ?? 0) > 0 && (
              <div className="border-t border-gray-100 pt-3 space-y-1.5">
                {(loyalty.history as any[]).slice(0, 5).map((h: any) => (
                  <div key={h.id} className="flex justify-between text-xs">
                    <span className="text-gray-500 truncate max-w-[200px]">{h.reason}</span>
                    <span className="font-semibold text-yellow-600 ml-2">+{h.points}</span>
                  </div>
                ))}
              </div>
            )}
            {(loyalty?.history?.length ?? 0) === 0 && (
              <p className="text-xs text-gray-500">Zatím žádné body. Absolvujte sezení nebo zaplaťte fakturu.</p>
            )}
          </div>

          {/* Health Goals */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} className="text-blue-500" />
              <h2 className="font-semibold text-gray-900">Moje cíle</h2>
            </div>
            {(goals?.length ?? 0) === 0 && (
              <p className="text-xs text-gray-500">Zatím žádné cíle. Váš terapeut je může přidat.</p>
            )}
            <div className="space-y-2">
              {(goals ?? []).map((g: any) => (
                <div key={g.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                  {g.status === "achieved"
                    ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    : g.status === "abandoned"
                    ? <AlertCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    : <Circle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{g.title}</p>
                    {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                    {g.targetDate && <p className="text-xs text-gray-500 mt-0.5">Cíl do: {g.targetDate}</p>}
                    {g.employeeNotes && <p className="text-xs text-primary-600 mt-0.5 italic">{g.employeeNotes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    g.status === "achieved" ? "bg-green-100 text-green-700" :
                    g.status === "abandoned" ? "bg-gray-100 text-gray-500" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {g.status === "achieved" ? "Dosaženo" : g.status === "abandoned" ? "Opuštěno" : "Aktivní"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent reports */}
          {(reports?.length ?? 0) > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Poslední zprávy</h2>
              <div className="space-y-2">
                {(reports ?? []).slice(0, 3).map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                    <FileText size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(r.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
