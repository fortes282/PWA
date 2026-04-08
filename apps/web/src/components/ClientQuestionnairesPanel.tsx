"use client";

import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { ClipboardList, Plus, Trash2, TrendingUp } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any[]>(url);

// ── Simple inline SVG trend chart ────────────────────────────────────────────
function TrendChart({ points }: { points: { total_score: number; created_at: string; interpretation?: string }[] }) {
  if (points.length < 2) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 italic">Méně než 2 měření — trend nelze zobrazit.</p>
    );
  }

  const W = 280;
  const H = 80;
  const PAD = 10;

  const scores = points.map(p => p.total_score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const range = maxS - minS || 1;

  const xStep = (W - PAD * 2) / (points.length - 1);
  const toY = (s: number) => PAD + H - PAD - ((s - minS) / range) * (H - PAD * 2);
  const toX = (i: number) => PAD + i * xStep;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.total_score).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg width={W} height={H} className="w-full overflow-visible">
        {/* Grid lines */}
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e5e7eb" strokeWidth="1" />
        {/* Line */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(p.total_score)}
            r="4"
            fill="#6366f1"
            className="cursor-pointer"
          >
            <title>{new Date(p.created_at).toLocaleDateString("cs-CZ")}: {p.total_score}</title>
          </circle>
        ))}
        {/* Labels */}
        <text x={PAD} y={H - 1} fontSize="8" fill="#9ca3af">{new Date(points[0].created_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}</text>
        <text x={W - PAD} y={H - 1} fontSize="8" fill="#9ca3af" textAnchor="end">{new Date(points[points.length - 1].created_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}</text>
      </svg>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
        <span>Min: {minS}</span>
        <span>Max: {maxS}</span>
        <span>Poslední: <strong className="text-gray-700 dark:text-gray-300">{scores[scores.length - 1]}</strong></span>
      </div>
      {points[points.length - 1].interpretation && (
        <p className="text-xs text-primary dark:text-primary-400 mt-1 font-medium">
          {points[points.length - 1].interpretation}
        </p>
      )}
    </div>
  );
}

interface Props {
  clientId: string | number;
  readOnly?: boolean;
}

export default function ClientQuestionnairesPanel({ clientId, readOnly = false }: Props) {
  const { data: assignments, mutate } = useSWR<any[]>(
    `/questionnaire-assignments?clientId=${clientId}`,
    fetcher
  );
  const { data: templates } = useSWR<any[]>("/questionnaire-templates", fetcher);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [assigning, setAssigning] = useState(false);

  const shouldReduceMotion = useReducedMotion();
  const [trendAssignment, setTrendAssignment] = useState<any>(null);
  const { data: trendData } = useSWR<any[]>(
    trendAssignment
      ? `/questionnaire-responses/trend?templateId=${trendAssignment.template_id}&clientId=${clientId}`
      : null,
    fetcher
  );

  const handleAssign = async () => {
    if (!selectedTemplateId) return;
    setAssigning(true);
    try {
      await api.post("/questionnaire-assignments", {
        templateId: parseInt(selectedTemplateId),
        clientId: Number(clientId),
        deadline: deadline || undefined,
      });
      mutate();
      setShowAssignModal(false);
      setSelectedTemplateId("");
      setDeadline("");
    } catch (e: any) {
      alert(e.message || "Chyba při přiřazování");
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Odebrat dotazník klientovi?")) return;
    await api.delete(`/questionnaire-assignments/${id}`);
    mutate();
  };

  const STATUS_LABELS: Record<string, string> = { PENDING: "Čeká", COMPLETED: "Vyplněno" };
  const STATUS_CLASSES: Record<string, string> = { PENDING: "badge-yellow", COMPLETED: "badge-green" };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" />
          Dotazníky
        </h2>
        {!readOnly && (
          <motion.button
            onClick={() => setShowAssignModal(true)}
            whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
            className="btn-outline text-xs py-1 px-2 flex items-center gap-1"
          >
            <Plus size={12} /> Přiřadit
          </motion.button>
        )}
      </div>

      {!assignments ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Načítám…</p>
      ) : assignments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Žádné přiřazené dotazníky</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a: any) => (
            <div key={a.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.template_name}</span>
                    <span className={`badge text-xs ${STATUS_CLASSES[a.status] || "badge-gray"}`}>
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                    {a.response_count > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{a.response_count}× vyplněno</span>
                    )}
                  </div>
                  {a.last_score !== null && a.last_score !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Poslední skóre: <strong>{a.last_score}</strong>
                      {a.last_interpretation && ` — ${a.last_interpretation}`}
                    </p>
                  )}
                  {a.deadline && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Deadline: {new Date(a.deadline).toLocaleDateString("cs-CZ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {a.response_count > 0 && (
                    <motion.button
                      onClick={() => setTrendAssignment(trendAssignment?.id === a.id ? null : a)}
                      whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                      className={`p-1.5 rounded transition-colors ${trendAssignment?.id === a.id ? "text-primary bg-primary-50" : "text-gray-500 dark:text-gray-400 hover:text-primary"}`}
                      title="Zobrazit trend"
                    >
                      <TrendingUp size={14} />
                    </motion.button>
                  )}
                  {!readOnly && (
                    <motion.button
                      onClick={() => handleDelete(a.id)}
                      whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                      className="p-1.5 text-red-400 hover:text-red-600"
                      title="Odebrat"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Trend chart inline */}
              {trendAssignment?.id === a.id && (
                <div className="mt-3 border-t dark:border-gray-700 pt-3">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <TrendingUp size={12} /> Trend skóre
                  </p>
                  {!trendData ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Načítám…</p>
                  ) : (
                    <TrendChart points={trendData} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assign modal */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <motion.div
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
              initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Přiřadit dotazník klientovi</h3>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Šablona dotazníku</label>
                <select
                  className="input w-full"
                  value={selectedTemplateId}
                  onChange={e => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">— vyberte šablonu —</option>
                  {(templates || []).map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Deadline (volitelný)</label>
                <input
                  type="date"
                  className="input w-full"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <motion.button
                  onClick={handleAssign}
                  disabled={!selectedTemplateId || assigning}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  className="btn-primary flex-1"
                >
                  {assigning ? "Přiřazuji…" : "Přiřadit"}
                </motion.button>
                <motion.button
                  onClick={() => setShowAssignModal(false)}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  className="btn-outline flex-1"
                >
                  Zrušit
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
