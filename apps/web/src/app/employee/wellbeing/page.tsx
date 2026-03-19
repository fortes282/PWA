"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Heart, TrendingUp, TrendingDown, Minus, CheckCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

const QUESTIONS = [
  "Jak se cítíte po pracovním týdnu? (fyzicky)",
  "Jak se cítíte emocionálně?",
  "Máte pocit, že zvládáte pracovní zátěž?",
  "Jak hodnotíte kvalitu svého spánku?",
  "Máte energii na volnočasové aktivity?",
] as const;

const SCORE_LABELS = ["", "Velmi špatně", "Špatně", "Průměrně", "Dobře", "Výborně"];
const SCORE_COLORS = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-emerald-500"];

function ScoreBar({ value }: { value: number }) {
  const pct = ((value - 1) / 4) * 100;
  const color =
    value < 2.5 ? "bg-red-400" : value < 3.5 ? "bg-yellow-400" : "bg-emerald-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** SVG Line chart for wellbeing trend */
function LineChart({ data }: { data: { week: string; averageScore: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-400 py-4 text-center">Žádná data</p>;

  const W = 560;
  const H = 160;
  const PAD = { top: 16, right: 20, bottom: 30, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxScore = 5;
  const minScore = 1;
  const range = maxScore - minScore;

  const pts = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: PAD.top + ((maxScore - d.averageScore) / range) * chartH,
    score: d.averageScore,
    week: d.week,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Gradient area fill
  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x} ${PAD.top + chartH} L ${pts[0].x} ${PAD.top + chartH} Z`;

  // Y gridlines
  const gridLines = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} aria-label="Wellbeing trend chart">
        <defs>
          <linearGradient id="wbGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {gridLines.map((v) => {
          const y = PAD.top + ((maxScore - v) / range) * chartH;
          return (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}</text>
            </g>
          );
        })}

        {/* Alert zone (< 2.5) */}
        {(() => {
          const alertY = PAD.top + ((maxScore - 2.5) / range) * chartH;
          return (
            <rect
              x={PAD.left} y={alertY} width={chartW}
              height={PAD.top + chartH - alertY}
              fill="#fee2e2" opacity={0.4}
            />
          );
        })()}

        {/* Area fill */}
        <path d={areaD} fill="url(#wbGrad)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x} cy={p.y} r={5}
              fill={p.score < 2.5 ? "#ef4444" : p.score < 3.5 ? "#f59e0b" : "#10b981"}
              stroke="white" strokeWidth={2}
            />
            <title>{p.week}: {p.score.toFixed(1)}</title>
          </g>
        ))}

        {/* X labels (show every 2nd) */}
        {pts.map((p, i) =>
          i % 2 === 0 ? (
            <text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
              {p.week.replace(/^\d{4}-/, "")}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

export default function WellbeingPage() {
  const { data, mutate, isLoading } = useSWR<any>("/wellbeing/my-history", fetcher);
  const [scores, setScores] = useState<number[]>([3, 3, 3, 3, 3]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/wellbeing/survey", {
        q1: scores[0], q2: scores[1], q3: scores[2], q4: scores[3], q5: scores[4],
      });
      setSubmitted(true);
      mutate();
    } catch (err: any) {
      setError(err?.message ?? "Chyba při ukládání");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Heart size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Můj wellbeing</h1>
          </div>

          {/* Survey form */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Týdenní self-check
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Týden: <span className="font-medium">{data?.currentWeek ?? "…"}</span>
            </p>

            {(data?.hasCurrentWeek || submitted) ? (
              <div className="flex items-center gap-3 py-4 text-emerald-600">
                <CheckCircle size={20} />
                <span className="font-medium">Self-check za tento týden byl vyplněn. Děkujeme!</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {QUESTIONS.map((q, idx) => (
                  <div key={idx}>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {idx + 1}. {q}
                    </p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setScores((prev) => { const n = [...prev]; n[idx] = v; return n; })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all
                            ${scores[idx] === v
                              ? `${SCORE_COLORS[v]} text-white border-transparent`
                              : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary-300"
                            }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">{SCORE_LABELS[scores[idx]]}</p>
                  </div>
                ))}

                {error && <p className="text-sm text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full py-2.5 disabled:opacity-50"
                >
                  {submitting ? "Ukládám…" : "Odeslat self-check"}
                </button>
              </form>
            )}
          </div>

          {/* Stats */}
          {!isLoading && data && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="card text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Průměrné skóre (12 týdnů)</p>
                  <p className={`text-3xl font-bold ${
                    data.avgScore === null ? "text-gray-400"
                      : data.avgScore < 2.5 ? "text-red-500"
                      : data.avgScore < 3.5 ? "text-yellow-500"
                      : "text-emerald-500"
                  }`}>
                    {data.avgScore !== null ? data.avgScore.toFixed(1) : "–"}
                  </p>
                  <ScoreBar value={data.avgScore ?? 3} />
                </div>
                <div className="card text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trend</p>
                  <div className="flex justify-center mt-1">
                    {data.trend === "improving" && <TrendingUp size={32} className="text-emerald-500" />}
                    {data.trend === "declining" && <TrendingDown size={32} className="text-red-500" />}
                    {data.trend === "stable" && <Minus size={32} className="text-yellow-500" />}
                  </div>
                  <p className={`text-sm font-medium mt-1 ${
                    data.trend === "improving" ? "text-emerald-600"
                      : data.trend === "declining" ? "text-red-500"
                      : "text-yellow-600"
                  }`}>
                    {data.trend === "improving" ? "Zlepšuje se" : data.trend === "declining" ? "Zhoršuje se" : "Stabilní"}
                  </p>
                </div>
              </div>

              {/* Line chart */}
              {data.history?.length > 0 && (
                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Trend za posledních 12 týdnů
                  </h2>
                  <LineChart data={data.history} />
                  <p className="text-xs text-gray-400 mt-2">🔴 Červená zóna = skóre pod 2.5 (riziko vyhoření)</p>
                </div>
              )}

              {/* Wellbeing tips */}
              {data.tips?.length > 0 && (
                <div className="card bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
                  <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-400 mb-2">
                    💡 Tipy pro váš wellbeing
                  </h2>
                  <ul className="space-y-2">
                    {data.tips.map((tip: string, i: number) => (
                      <li key={i} className="text-sm text-primary-800 dark:text-primary-300 flex gap-2">
                        <span className="flex-shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
