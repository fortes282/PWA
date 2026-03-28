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
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

// ── Badges ────────────────────────────────────────────────────────────────────
interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  earned: (stats: { sessions: number; score: number; points: number; reports: number }) => boolean;
  color: string; // tailwind bg class for earned state
}

const BADGE_DEFS: BadgeDef[] = [
  { id: "first",     emoji: "🌟", title: "První sezení",       desc: "Absolvujte první sezení",           earned: s => s.sessions >= 1,  color: "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400" },
  { id: "regular",   emoji: "🏃", title: "Pravidelný",         desc: "5 absolvovaných sezení",            earned: s => s.sessions >= 5,  color: "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400" },
  { id: "loyal10",   emoji: "💎", title: "Věrný klient",       desc: "10 absolvovaných sezení",           earned: s => s.sessions >= 10, color: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400" },
  { id: "master25",  emoji: "🏆", title: "Terapeutický mistr", desc: "25 absolvovaných sezení",           earned: s => s.sessions >= 25, color: "bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400" },
  { id: "legend50",  emoji: "👑", title: "Legenda Přístavu",   desc: "50 absolvovaných sezení",           earned: s => s.sessions >= 50, color: "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400" },
  { id: "punctual",  emoji: "⏰", title: "Dochvilný",          desc: "Skóre dochvilnosti ≥ 90",           earned: s => s.score >= 90,    color: "bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400" },
  { id: "perfect",   emoji: "✨", title: "Zlaté srdce",        desc: "Perfektní skóre 100",               earned: s => s.score >= 100,   color: "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300" },
  { id: "pts50",     emoji: "🎖️", title: "Sbírač bodů",        desc: "50 věrnostních bodů",               earned: s => s.points >= 50,   color: "bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400" },
  { id: "pts150",    emoji: "🥇", title: "Zlatý klient",       desc: "150 věrnostních bodů",              earned: s => s.points >= 150,  color: "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-300" },
  { id: "docs",      emoji: "📋", title: "Dokumentovaný",      desc: "3 terapeutické zprávy",             earned: s => s.reports >= 3,   color: "bg-teal-50 dark:bg-teal-900/30 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-400" },
];

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
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
  const shouldReduce = useReducedMotion();
  const max = maxVal ?? Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{d[valueKey] ?? 0}</span>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-t relative" style={{ height: 64 }}>
            <motion.div
              className="w-full rounded-t absolute bottom-0"
              initial={shouldReduce ? undefined : { height: 0 }}
              animate={{ height: `${((d[valueKey] ?? 0) / max) * 64}px` }}
              transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.1 + i * 0.06 }}
              style={{ backgroundColor: color }}
            />
          </div>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function ClientProgress() {
  const shouldReduce = useReducedMotion();
  const { user } = useAuth();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

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

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleDateString("cs-CZ", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  const attendanceData = Array.isArray(progressData?.attendance)
    ? progressData.attendance
    : months.map((m) => ({
        label: m.label,
        attended: completed.filter((a: any) => a.startTime?.startsWith?.(m.key)).length,
        planned: (appointments ?? []).filter((a: any) => a.startTime?.startsWith?.(m.key)).length,
      }));

  const ratingsData = Array.isArray(progressData?.ratings) ? progressData.ratings : [];

  const creditsArr: any[] = Array.isArray(credits) ? credits : (credits as any)?.items ?? [];
  const totalSpent = creditsArr
    .filter((t: any) => t.type === "USE")
    .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const totalPurchased = creditsArr
    .filter((t: any) => t.type === "PURCHASE")
    .reduce((s: number, t: any) => s + t.amount, 0);
  const currentBalance = creditsArr[0]?.balance ?? 0;

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

      doc.setFillColor(99, 102, 241);
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Přístav Radosti", margin, 13);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Progress Report — Klientský přehled", margin, 22);

      doc.setFontSize(9);
      doc.text(currentMonthLabel, pageWidth - margin, 13, { align: "right" });

      y = 40;
      doc.setTextColor(30, 30, 30);

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
        doc.setFillColor(99, 102, 241);
        if (h > 0) doc.rect(x + 2, y + barMaxH - h, colW - 6, h, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(x + 2, y, colW - 6, barMaxH, "S");
        doc.setTextColor(80, 80, 80);
        doc.text(d.label ?? "", x + colW / 2, y + barMaxH + 5, { align: "center" });
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "bold");
        doc.text(String(d.attended ?? 0), x + colW / 2, y - 1, { align: "center" });
        doc.setFont("helvetica", "normal");
      }
      y += barMaxH + 14;

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
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Můj pokrok</h1>
            </div>
            <div className="flex gap-2">
              <motion.button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <AnimatePresence mode="wait">
                  {shareSuccess ? (
                    <motion.span
                      key="check"
                      initial={shouldReduce ? {} : { opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0, scale: 0.7 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="flex items-center gap-1.5"
                    >
                      <Check size={14} className="text-green-500" /> Zkopírováno
                    </motion.span>
                  ) : (
                    <motion.span
                      key="share"
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="flex items-center gap-1.5"
                    >
                      <Share2 size={14} /> Sdílet
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
              <motion.button
                onClick={handleExportPDF}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <Download size={14} />
                {pdfLoading ? "Generuji…" : "Stáhnout PDF"}
              </motion.button>
            </div>
          </motion.div>

          {/* Period info */}
          <motion.p
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.2 }}
            className="text-sm text-gray-500 dark:text-gray-400 mb-5 -mt-3"
          >
            Přehled za: <span className="text-gray-600 dark:text-gray-300 font-medium">{currentMonthLabel}</span>
          </motion.p>

          {/* Behavior score */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.07 }}
            className="card mb-6 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star size={20} className="text-yellow-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Skóre dochvilnosti</h2>
            </div>
            <motion.p
              initial={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.15 }}
              className={`text-5xl font-bold ${SCORE_COLOR(score)} mb-1`}
            >
              {score}
            </motion.p>
            <p className={`text-sm font-medium ${SCORE_COLOR(score)}`}>{SCORE_LABEL(score)}</p>
            <div className="mt-4 bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400"
                }`}
                initial={shouldReduce ? undefined : { width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 26, delay: 0.2 }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Skóre se zvyšuje dochvilností a snižuje no-show nebo pozdním rušením
            </p>
          </motion.div>

          {/* Badges */}
          {(() => {
            const stats = { sessions: totalCompleted, score, points: loyalty?.balance ?? 0, reports: reports?.length ?? 0 };
            const earnedBadges = BADGE_DEFS.filter(b => b.earned(stats));
            const lockedBadges = BADGE_DEFS.filter(b => !b.earned(stats));
            return (
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                className="card mb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Award size={18} className="text-yellow-500" />
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Moje odznaky</h2>
                  <span className="ml-auto flex items-center gap-2">
                    {earnedBadges.length > 0 && (
                      <img src="/brand/mascot-celebrate.svg" alt="" className="w-10 h-10" aria-hidden="true" />
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">{earnedBadges.length}/{BADGE_DEFS.length}</span>
                  </span>
                </div>
                {earnedBadges.length === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Absolvujte první sezení a získejte svůj první odznak!</p>
                )}
                {earnedBadges.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {earnedBadges.map((b, i) => (
                      <motion.div
                        key={b.id}
                        title={b.desc}
                        initial={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.12 + i * 0.04 }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${b.color}`}
                      >
                        <span>{b.emoji}</span>
                        <span>{b.title}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
                {lockedBadges.length > 0 && (
                  <>
                    <p className="text-xs text-gray-400 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">Ještě nezískaný</p>
                    <div className="flex flex-wrap gap-2">
                      {lockedBadges.map((b, i) => (
                        <motion.div
                          key={b.id}
                          title={b.desc}
                          initial={shouldReduce ? {} : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.18 + i * 0.03 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-400 dark:text-gray-400"
                        >
                          <span className="opacity-40">{b.emoji}</span>
                          <span>{b.title}</span>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            );
          })()}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { icon: <Calendar size={20} className="text-primary-500 mx-auto mb-2" />, value: totalCompleted, label: "Absolvovaných sezení" },
              { icon: <FileText size={20} className="text-primary-500 mx-auto mb-2" />, value: reports?.length ?? 0, label: "Terapeutických zpráv" },
              { icon: <TrendingUp size={20} className="text-green-500 mx-auto mb-2" />, value: currentBalance.toFixed(0), label: "Kredit zbývá" },
              { icon: <Activity size={20} className="text-orange-500 mx-auto mb-2" />, value: totalCancelled, label: "Zrušených termínů" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.13 + i * 0.05 }}
                className="card text-center"
              >
                {s.icon}
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Attendance chart */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.18 }}
            className="card mb-6"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Docházka — posledních 6 měsíců</h2>
            <SimpleBarChart
              data={attendanceData}
              valueKey="attended"
              labelKey="label"
              color="#6366f1"
            />
            {attendanceData.some((d: any) => (d.planned ?? 0) > (d.attended ?? 0)) && (
              <div className="mt-3 flex gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> Absolvováno
                </span>
              </div>
            )}
          </motion.div>

          {/* Ratings chart */}
          {ratingsData.some((r: any) => r.avgRating !== null) && (
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
              className="card mb-6"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Hodnocení sezení (1–5 ★)</h2>
              <SimpleBarChart
                data={ratingsData.map((r: any) => ({ ...r, displayRating: r.avgRating ?? 0 }))}
                valueKey="displayRating"
                labelKey="label"
                maxVal={5}
                color="#f59e0b"
              />
            </motion.div>
          )}

          {/* Milestones */}
          {(progressData?.milestones?.length ?? 0) > 0 && (
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.22 }}
              className="card mb-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <Award size={18} className="text-yellow-500" />
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Milníky terapie</h2>
              </div>
              <div className="space-y-2">
                {(progressData.milestones as any[]).map((m: any, i: number) => (
                  <motion.div
                    key={m.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.24 + i * 0.04 }}
                    className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-6 text-center">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{m.date}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.status === "FINAL" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                    }`}>
                      {m.status === "FINAL" ? "Finální" : "Návrh"}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Latest recommendation */}
          {progressData?.latestRecommendation && (
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.24 }}
              className="card mb-6 border-l-4 border-primary-400"
            >
              <div className="flex items-center gap-2 mb-2">
                <Target size={16} className="text-primary-500" />
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Doporučení terapeuta</h2>
              </div>
              {progressData.latestReportTitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ze zprávy: {progressData.latestReportTitle}</p>
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{progressData.latestRecommendation}</p>
            </motion.div>
          )}

          {/* Credit summary */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.26 }}
            className="card mb-6"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Přehled kreditů</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Celkem zakoupeno</span>
                <span className="font-medium text-green-600 dark:text-green-400">+{totalPurchased.toFixed(0)} Kč</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Celkem využito</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">−{totalSpent.toFixed(0)} Kč</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-700 dark:text-gray-300">Aktuální zůstatek</span>
                <span className="text-primary-600 dark:text-primary-400">{currentBalance.toFixed(0)} Kč</span>
              </div>
            </div>
          </motion.div>

          {/* Loyalty points */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.28 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Award size={18} className="text-yellow-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Věrnostní body</h2>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <motion.p
                  initial={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.32 }}
                  className="text-3xl font-bold text-yellow-600 dark:text-yellow-400"
                >
                  {loyalty?.balance ?? 0}
                </motion.p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">celkem bodů</p>
              </div>
              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                <p>+10 za dokončené sezení</p>
                <p>+5 za zaplacení faktury</p>
              </div>
            </div>
            {(loyalty?.history?.length ?? 0) > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1.5">
                {(loyalty.history as any[]).slice(0, 5).map((h: any, i: number) => (
                  <motion.div
                    key={h.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.34 + i * 0.03 }}
                    className="flex justify-between text-xs"
                  >
                    <span className="text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{h.reason}</span>
                    <span className="font-semibold text-yellow-600 dark:text-yellow-400 ml-2">+{h.points}</span>
                  </motion.div>
                ))}
              </div>
            )}
            {(loyalty?.history?.length ?? 0) === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Zatím žádné body. Absolvujte sezení nebo zaplaťte fakturu.</p>
            )}
          </motion.div>

          {/* Health Goals */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.3 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Target size={18} className="text-blue-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Moje cíle</h2>
            </div>
            {(goals?.length ?? 0) === 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Zatím žádné cíle. Váš terapeut je může přidat.</p>
            )}
            <div className="space-y-2">
              {(goals ?? []).map((g: any, i: number) => (
                <motion.div
                  key={g.id}
                  initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.32 + i * 0.04 }}
                  className="flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  {g.status === "achieved"
                    ? <CheckCircle2 size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    : g.status === "abandoned"
                    ? <AlertCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    : <Circle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{g.title}</p>
                    {g.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{g.description}</p>}
                    {g.targetDate && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cíl do: {g.targetDate}</p>}
                    {g.employeeNotes && <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 italic">{g.employeeNotes}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    g.status === "achieved" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                    g.status === "abandoned" ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400" :
                    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  }`}>
                    {g.status === "achieved" ? "Dosaženo" : g.status === "abandoned" ? "Opuštěno" : "Aktivní"}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Recent reports */}
          {(reports?.length ?? 0) > 0 && (
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.33 }}
              className="card"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Poslední zprávy</h2>
              <div className="space-y-2">
                {(reports ?? []).slice(0, 3).map((r: any, i: number) => (
                  <motion.div
                    key={r.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.35 + i * 0.04 }}
                    className="flex items-start gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <FileText size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.createdAt)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Quick links — Můj progres hub */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.38 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <a href="/client/reports" className="card flex items-center gap-3 hover:ring-2 hover:ring-primary-400 transition-all">
              <FileText size={20} className="text-primary-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Terapeutické zprávy</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Všechny zprávy od terapeutů</p>
              </div>
            </a>
            <a href="/client/questionnaires" className="card flex items-center gap-3 hover:ring-2 hover:ring-primary-400 transition-all">
              <Target size={20} className="text-indigo-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Dotazníky</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Vyplněné i čekající</p>
              </div>
            </a>
            <a href="/client/homework" className="card flex items-center gap-3 hover:ring-2 hover:ring-primary-400 transition-all">
              <Activity size={20} className="text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Domácí cvičení</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Aktuální úkoly</p>
              </div>
            </a>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
