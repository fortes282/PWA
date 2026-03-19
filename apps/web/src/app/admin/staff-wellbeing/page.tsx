"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { AlertTriangle, Users, Clock, TrendingUp } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-500">–</span>;
  const color =
    score < 2.5 ? "text-red-600 bg-red-50 dark:bg-red-900/20"
      : score < 3.5 ? "text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20"
      : "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

/** SVG Line chart for team trend */
function TeamLineChart({ data }: { data: { week: string; avg_score: number; respondents: number }[] }) {
  if (!data.length) return <p className="text-sm text-gray-500 py-4 text-center">Žádná data</p>;

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
    y: PAD.top + ((maxScore - d.avg_score) / range) * chartH,
    score: d.avg_score,
    week: d.week,
    respondents: d.respondents,
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD =
    pathD +
    ` L ${pts[pts.length - 1].x} ${PAD.top + chartH} L ${pts[0].x} ${PAD.top + chartH} Z`;

  const gridLines = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} aria-label="Team wellbeing trend">
        <defs>
          <linearGradient id="teamGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((v) => {
          const y = PAD.top + ((maxScore - v) / range) * chartH;
          return (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + chartW} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">{v}</text>
            </g>
          );
        })}

        {/* Alert zone */}
        {(() => {
          const alertY = PAD.top + ((maxScore - 2.5) / range) * chartH;
          return (
            <rect x={PAD.left} y={alertY} width={chartW} height={PAD.top + chartH - alertY} fill="#fee2e2" opacity={0.4} />
          );
        })()}

        <path d={areaD} fill="url(#teamGrad)" />
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill={p.score < 2.5 ? "#ef4444" : p.score < 3.5 ? "#f59e0b" : "#10b981"} stroke="white" strokeWidth={2} />
            <title>{p.week}: {p.score.toFixed(1)} (n={p.respondents})</title>
          </g>
        ))}

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

export default function StaffWellbeingPage() {
  const { data, isLoading } = useSWR<any>("/wellbeing/team-overview", fetcher, { refreshInterval: 60_000 });

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Wellbeing týmu</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500 -mt-4">
            Anonymizovaný přehled wellbeingu terapeutů. Individuální data nejsou viditelná.
          </p>

          {isLoading && (
            <p className="text-sm text-gray-500">Načítám data…</p>
          )}

          {!isLoading && data && (
            <>
              {/* Alerts */}
              {data.alertCount > 0 && (
                <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-700 dark:text-red-400">
                        ⚠️ {data.alertCount} {data.alertCount === 1 ? "terapeut" : data.alertCount < 5 ? "terapeuti" : "terapeutů"} s kriticky nízkým skóre
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                        Skóre pod 2.5 po dobu 2 a více týdnů. Doporučujeme konzultaci se supervizorem.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Overview cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card text-center">
                  <Users size={20} className="mx-auto mb-1 text-gray-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-500">Terapeutů celkem</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.totalEmployees}</p>
                  <p className="text-xs text-gray-500">z toho {data.respondentsLast4Weeks} vyplnilo</p>
                </div>

                <div className="card text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Průměrné skóre týmu</p>
                  <div className="flex justify-center">
                    <ScoreBadge score={data.teamAvgScore} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">za posledních 4 týdny</p>
                </div>

                <div className="card text-center">
                  <AlertTriangle size={20} className={`mx-auto mb-1 ${data.belowThresholdCount > 0 ? "text-orange-400" : "text-gray-300"}`} />
                  <p className="text-xs text-gray-500 dark:text-gray-500">Pod hranicí (skóre &lt;3)</p>
                  <p className={`text-2xl font-bold ${data.belowThresholdCount > 0 ? "text-orange-500" : "text-gray-500"}`}>
                    {data.belowThresholdCount}
                  </p>
                </div>

                <div className="card text-center">
                  <Clock size={20} className="mx-auto mb-1 text-gray-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-500">Přesčas (prům./týden)</p>
                  <p className={`text-2xl font-bold ${data.overtime?.avgHoursPerWeek > 4 ? "text-red-500" : "text-gray-900 dark:text-gray-100"}`}>
                    {data.overtime?.avgHoursPerWeek?.toFixed(1) ?? "0"}h
                  </p>
                </div>
              </div>

              {/* Team trend chart */}
              {data.weeklyTrend?.length > 0 && (
                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Trend týmového wellbeing (12 týdnů)
                  </h2>
                  <TeamLineChart data={data.weeklyTrend} />
                  <p className="text-xs text-gray-500 mt-2">🔴 Červená zóna = průměr pod 2.5</p>
                </div>
              )}

              {/* Overtime + Caseload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Clock size={16} className="text-gray-500" /> Přesčasy (minulý týden)
                  </h2>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-800">
                      <span className="text-sm text-gray-600 dark:text-gray-500">Celkem přesčas</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {data.overtime?.totalHoursLastWeek?.toFixed(1) ?? "0"}h
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-800">
                      <span className="text-sm text-gray-600 dark:text-gray-500">Průměr na terapeuta</span>
                      <span className={`text-sm font-semibold ${data.overtime?.avgHoursPerWeek > 4 ? "text-red-500" : "text-gray-900 dark:text-gray-100"}`}>
                        {data.overtime?.avgHoursPerWeek?.toFixed(1) ?? "0"}h
                      </span>
                    </div>
                    {data.overtime?.avgHoursPerWeek > 8 && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle size={12} /> Průměr přesahuje 8h — zvažte přerozdělení zátěže
                      </p>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Users size={16} className="text-gray-500" /> Caseload (posledních 30 dní)
                  </h2>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-800">
                      <span className="text-sm text-gray-600 dark:text-gray-500">Klientů / terapeut</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {data.caseload?.avgClientsPerTherapist?.toFixed(1) ?? "0"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-gray-50 dark:border-gray-800">
                      <span className="text-sm text-gray-600 dark:text-gray-500">Prům. délka sezení</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {data.caseload?.avgSessionDurationMin?.toFixed(0) ?? "0"} min
                      </span>
                    </div>
                    {data.caseload?.avgClientsPerTherapist > 20 && (
                      <p className="text-xs text-orange-500 flex items-center gap-1">
                        <AlertTriangle size={12} /> Vysoký počet klientů — možné riziko přetížení
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {data.weeklyTrend?.length === 0 && (
                <div className="card text-center py-8">
                  <p className="text-gray-500 text-sm">Zatím nejsou k dispozici žádná data self-checků.</p>
                  <p className="text-xs text-gray-300 mt-1">Data se zobrazí po prvním vyplnění dotazníku terapeuty.</p>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
