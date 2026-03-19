"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { ClipboardList, CheckCircle, Clock, AlertCircle, ChevronLeft } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

function ScoreBar({ score, max, thresholds }: { score: number; max: number; thresholds: any[] }) {
  const pct = Math.min(100, (score / max) * 100);
  let color = "bg-green-400";
  if (thresholds) {
    for (const t of thresholds) {
      if (score <= t.max) {
        color = t.color === "red" ? "bg-red-500" : t.color === "orange" ? "bg-orange-400" : t.color === "yellow" ? "bg-yellow-400" : "bg-green-400";
        break;
      }
    }
  }
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Skóre: <strong>{score}</strong></span>
        <span>Max: {max}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuestionnaireForm({ assignment, onSubmitted }: { assignment: any; onSubmitted: () => void }) {
  const questions: any[] = assignment.questions || [];
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const setAnswer = (qid: number, value: any) => {
    setAnswers(prev => ({ ...prev, [String(qid)]: value }));
  };

  const allAnswered = questions.every(q => {
    if (q.type === "text") return true; // text is optional
    return answers[String(q.id)] !== undefined && answers[String(q.id)] !== "";
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const resp = await api.post<any>("/questionnaire-responses", {
        assignmentId: assignment.id,
        answers,
      });
      setResult(resp);
      onSubmitted();
    } catch (e: any) {
      setError(e.message || "Chyba při odesílání");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const thresholds = assignment.scoringRules?.thresholds || [];
    const maxScore = thresholds.length > 0 ? thresholds[thresholds.length - 1].max : 100;
    return (
      <div className="card text-center space-y-4 py-8">
        <CheckCircle size={48} className="text-green-500 mx-auto" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dotazník vyplněn!</h3>
        <div className="max-w-xs mx-auto">
          <p className="text-3xl font-bold text-primary-600">{result.total_score}</p>
          <p className="text-sm text-gray-500 mt-1">{result.interpretation}</p>
          <ScoreBar score={result.total_score} max={maxScore} thresholds={thresholds} />
        </div>
        <p className="text-sm text-gray-500">Výsledky byly odeslány vašemu terapeutovi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onSubmitted} className="p-1 text-gray-500 hover:text-gray-700">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">{assignment.template_name}</h2>
          {assignment.template_description && (
            <p className="text-sm text-gray-500">{assignment.template_description}</p>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm p-3 rounded-lg">{error}</div>}

      <div className="space-y-6">
        {questions.map((q: any, idx: number) => (
          <div key={q.id} className="card">
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-3">
              <span className="text-primary-500 mr-2">{idx + 1}.</span>
              {q.text}
            </p>

            {/* Scale 0-3 (PHQ-9, GAD-7 style) */}
            {q.type === "scale0-3" && (
              <div className="grid grid-cols-2 gap-2">
                {(q.options || ["0", "1", "2", "3"]).map((opt: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setAnswer(q.id, i)}
                    className={`p-3 rounded-lg border text-sm text-left transition-colors min-h-[44px] ${
                      answers[String(q.id)] === i
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-semibold mr-1">{i}</span> — {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Scale 0-10 (VAS) */}
            {q.type === "scale0-10" && (
              <div>
                <div className="flex gap-1 flex-wrap">
                  {Array.from({ length: 11 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setAnswer(q.id, i)}
                      className={`w-10 h-10 rounded-lg border text-sm font-semibold transition-colors ${
                        answers[String(q.id)] === i
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700"
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Žádná bolest</span>
                  <span>Nejhorší bolest</span>
                </div>
              </div>
            )}

            {/* Scale 1-5 */}
            {q.type === "scale1-5" && (
              <div className="grid grid-cols-1 gap-2">
                {(q.options || ["1", "2", "3", "4", "5"]).map((opt: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setAnswer(q.id, i + 1)}
                    className={`p-3 rounded-lg border text-sm text-left transition-colors min-h-[44px] ${
                      answers[String(q.id)] === i + 1
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Options (Barthel) */}
            {q.type === "options" && (
              <div className="grid grid-cols-1 gap-2">
                {(q.options || []).map((opt: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setAnswer(q.id, i)}
                    className={`p-3 rounded-lg border text-sm text-left transition-colors min-h-[44px] ${
                      answers[String(q.id)] === i
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Yes/No */}
            {q.type === "yesno" && (
              <div className="flex gap-3">
                {["Ano", "Ne"].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setAnswer(q.id, i === 0 ? 1 : 0)}
                    className={`flex-1 p-3 rounded-lg border text-sm font-medium transition-colors min-h-[44px] ${
                      answers[String(q.id)] === (i === 0 ? 1 : 0)
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Free text */}
            {q.type === "text" && (
              <textarea
                className="input w-full text-sm"
                rows={3}
                placeholder="Vaše odpověď…"
                value={answers[String(q.id)] || ""}
                onChange={e => setAnswer(q.id, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || submitting}
        className="btn-primary w-full"
      >
        {submitting ? "Odesílám…" : "Odeslat dotazník"}
      </button>
    </div>
  );
}

export default function ClientQuestionnaires() {
  const { data: assignments, mutate } = useSWR<any[]>("/questionnaire-assignments", fetcher);
  const [filling, setFilling] = useState<any>(null);

  if (filling) {
    return (
      <RouteGuard allowedRoles={["CLIENT"]}>
        <Layout>
          <div className="max-w-2xl mx-auto">
            <QuestionnaireForm assignment={filling} onSubmitted={() => { setFilling(null); mutate(); }} />
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  const pending = assignments?.filter(a => a.status === "PENDING") || [];
  const completed = assignments?.filter(a => a.status === "COMPLETED") || [];

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <ClipboardList size={24} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dotazníky</h1>
              <p className="text-sm text-gray-500 dark:text-gray-500">Dotazníky přiřazené vaším terapeutem</p>
            </div>
          </div>

          {/* Pending */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <AlertCircle size={16} className="text-yellow-500" />
                K vyplnění ({pending.length})
              </h2>
              {pending.map((a: any) => (
                <div key={a.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{a.template_name}</h3>
                      {a.template_description && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{a.template_description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        od {a.assigned_by_name}
                        {a.deadline && ` · Do ${new Date(a.deadline).toLocaleDateString("cs-CZ")}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setFilling(a)}
                      className="btn-primary text-sm py-1.5 px-3 whitespace-nowrap"
                    >
                      Vyplnit
                    </button>
                  </div>
                  {a.deadline && new Date(a.deadline) < new Date() && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                      <Clock size={12} />
                      Deadline překročen
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                Vyplněné ({completed.length})
              </h2>
              {completed.map((a: any) => (
                <div key={a.id} className="card opacity-75">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-gray-700 dark:text-gray-300">{a.template_name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">od {a.assigned_by_name}</p>
                    </div>
                    <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!assignments || assignments.length === 0) && (
            <div className="card text-center py-12">
              <ClipboardList size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-500">Zatím nemáte žádné přiřazené dotazníky</p>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
