"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";

function MonthlyReportTab() {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const blob = await api.getBlob(`/reports/monthly/export/csv?year=${year}&month=${month}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly-report-${year}-${String(month).padStart(2, "0")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  const { data: report, isLoading } = useSWR<any>(
    `/reports/monthly?year=${year}&month=${month}`,
    (url: string) => api.get<any>(url)
  );

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">Rok</label>
          <input
            type="number"
            className="input w-24"
            value={year}
            min={2020}
            max={2030}
            onChange={(e) => setYear(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Měsíc</label>
          <select
            className="input w-32"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {[
              [1, "Leden"], [2, "Únor"], [3, "Březen"], [4, "Duben"],
              [5, "Květen"], [6, "Červen"], [7, "Červenec"], [8, "Srpen"],
              [9, "Září"], [10, "Říjen"], [11, "Listopad"], [12, "Prosinec"]
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            {exportingCsv ? "Exportuji…" : "↓ Exportovat CSV"}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Načítám...</p>}

      {report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(report.revenue?.total ?? 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Celkové výnosy</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-gray-900">{report.appointments?.total ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Termínů celkem</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-blue-600">{report.appointments?.completionRate ?? 0}%</p>
              <p className="text-xs text-gray-500 mt-1">Úspěšnost</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-purple-600">{report.newClients ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Noví klienti</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Přehled termínů</h3>
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ["Dokončeno", report.appointments?.completed, "text-green-600"],
                    ["Potvrzeno", report.appointments?.confirmed, "text-blue-600"],
                    ["Čeká", report.appointments?.pending, "text-yellow-600"],
                    ["Zrušeno", report.appointments?.cancelled, "text-gray-500"],
                    ["No-show", report.appointments?.noShow, "text-red-600"],
                  ].map(([label, val, cls]) => (
                    <tr key={label as string} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-600">{label}</td>
                      <td className={`py-2 text-right font-semibold ${cls}`}>{val ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Výnosy dle služeb</h3>
              {(report.revenue?.byService ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">Žádná data</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left py-1">Služba</th>
                      <th className="text-right py-1">Počet</th>
                      <th className="text-right py-1">Výnosy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.revenue?.byService ?? []).map((s: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-gray-600">#{s.serviceId}</td>
                        <td className="py-2 text-right text-gray-700">{s.count}</td>
                        <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {(report.topClients ?? []).length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Top klienti</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left py-1">Klient</th>
                      <th className="text-right py-1">Termínů</th>
                      <th className="text-right py-1">Výnosy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.topClients ?? []).map((c: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-gray-600">#{c.clientId}</td>
                        <td className="py-2 text-right text-gray-700">{c.count}</td>
                        <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(report.topEmployees ?? []).length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Top terapeuti</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left py-1">Terapeut</th>
                      <th className="text-right py-1">Termínů</th>
                      <th className="text-right py-1">Výnosy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.topEmployees ?? []).map((e: any, i: number) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 text-gray-600">#{e.employeeId}</td>
                        <td className="py-2 text-right text-gray-700">{e.count}</td>
                        <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(e.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <p className="text-xs text-gray-500">
              Průměrná hodnota sezení: <span className="font-semibold text-gray-800">{formatCurrency(report.avgSessionValue ?? 0)}</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const fetcher = (url: string) => api.get<any>(url);

function Bar({ value, max, color = "bg-primary-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// CSS-based donut chart (SVG)
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="text-center text-xs text-gray-400 py-6">Žádná data</div>;

  let offset = 0;
  const R = 40;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * R;

  const arcs = segments.map((seg) => {
    const fraction = seg.value / total;
    const dashArray = `${fraction * circumference} ${circumference}`;
    const rotation = offset * 360 - 90;
    offset += fraction;
    return { ...seg, dashArray, rotation, fraction };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="16"
            strokeDasharray={arc.dashArray}
            strokeDashoffset="0"
            transform={`rotate(${arc.rotation} ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#111827">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">
          termínů
        </text>
      </svg>
      <div className="space-y-1.5">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-xs text-gray-600">{arc.label}</span>
            <span className="text-xs font-semibold text-gray-800 ml-auto pl-3">
              {arc.value} ({Math.round(arc.fraction * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminStats() {
  const [activeTab, setActiveTab] = useState<"overview" | "monthly">("overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [statsDays, setStatsDays] = useState("30");

  const url = `/stats${from || to ? "?" + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }) : ""}`;
  const { data: stats } = useSWR(url, fetcher);
  const { data: topClients } = useSWR<any[]>("/stats/top-clients?limit=5", fetcher);
  const { data: roomsUtil } = useSWR<any>(`/stats/rooms-utilization?days=${statsDays}`, fetcher);
  const { data: empPerf } = useSWR<any>(`/stats/employees-performance?days=${statsDays}`, fetcher);

  const maxOccupancy = stats
    ? Math.max(...Object.values(stats.occupancyByDay as Record<string, number>), 1)
    : 1;

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistiky</h1>

          {/* Tab switcher */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "overview" ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Přehled
            </button>
            <button
              onClick={() => setActiveTab("monthly")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "monthly" ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              Měsíční zprávy
            </button>
          </div>

          {activeTab === "monthly" && <MonthlyReportTab />}

          {activeTab === "overview" && <>

          {/* Date filter */}
          <div className="card mb-6 flex flex-wrap gap-4 items-end">
            <div>
              <label className="label">Od</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Do</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn-secondary" onClick={() => { setFrom(""); setTo(""); }}>Reset</button>
            {(from || to) && (
              <p className="text-xs text-gray-500">Filtrovaný výsledek</p>
            )}
          </div>

          {stats && (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Celkem termínů", value: stats.totalAppts, color: "text-gray-900" },
                  { label: "Dokončeno", value: stats.completedAppts, color: "text-green-600" },
                  { label: "No-show", value: stats.noShowAppts, color: "text-red-600" },
                  { label: "No-show rate", value: `${stats.noShowRate}%`, color: stats.noShowRate > 20 ? "text-red-600" : "text-orange-500" },
                ].map((s) => (
                  <div key={s.label} className="card text-center">
                    <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Revenue + clients */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">Výnosy (dokončené)</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.revenue)}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">Klientů celkem / aktivních</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {stats.totalClients}
                    <span className="text-sm text-gray-400 font-normal"> / {stats.activeClients}</span>
                  </p>
                </div>
                <div className="card">
                  <p className="text-xs text-gray-500 mb-1">Terapeutů</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>
                </div>
              </div>

              {/* Appointment status donut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-4">Rozložení termínů</h2>
                  <DonutChart
                    segments={[
                      { label: "Dokončeno", value: stats.completedAppts, color: "#16a34a" },
                      { label: "Potvrzeno", value: Math.max(0, stats.confirmedAppts - stats.completedAppts), color: "#2563eb" },
                      { label: "Čeká", value: stats.pendingAppts, color: "#f59e0b" },
                      { label: "No-show", value: stats.noShowAppts, color: "#dc2626" },
                      { label: "Zrušeno", value: stats.cancelledAppts, color: "#9ca3af" },
                    ].filter((s) => s.value > 0)}
                  />
                </div>

                {/* Top services */}
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-4">Nejpoužívanější služby</h2>
                  {stats.topServices?.length === 0 ? (
                    <p className="text-xs text-gray-400">Žádná data</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.topServices.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{s.name}</p>
                          </div>
                          <div className="w-24">
                            <Bar
                              value={s.count}
                              max={stats.topServices[0]?.count ?? 1}
                              color="bg-primary-400"
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-8 text-right">
                            {s.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top employees */}
              {stats.topEmployees?.some((e: any) => e.completed > 0) && (
                <div className="card mb-6">
                  <h2 className="font-semibold text-gray-900 mb-4">Terapeuti — dokončené sezení</h2>
                  <div className="space-y-2">
                    {stats.topEmployees.map((e: any, i: number) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                        <span className="text-sm text-gray-700 w-32 truncate">{e.name}</span>
                        <Bar value={e.completed} max={stats.topEmployees[0]?.completed ?? 1} color="bg-green-400" />
                        <span className="text-xs font-semibold text-gray-700 w-8 text-right">
                          {e.completed}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Occupancy by day — last 14 days */}
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">
                  Obsazenost — posledních 14 dní
                </h2>
                {Object.keys(stats.occupancyByDay).length === 0 ? (
                  <p className="text-xs text-gray-400">Žádná data pro toto období</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(stats.occupancyByDay as Record<string, number>)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([day, count]) => (
                        <div key={day} className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 w-24 flex-shrink-0">{day}</span>
                          <Bar value={count as number} max={maxOccupancy} />
                          <span className="text-xs font-semibold text-gray-700 w-6 text-right">
                            {count as number}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Top 5 clients by activity */}
              {(topClients ?? []).length > 0 && (
                <div className="card">
                  <h2 className="font-semibold text-gray-900 mb-4">Top klienti (dle aktivity)</h2>
                  <div className="space-y-2">
                    {(topClients ?? []).map((c: any, i: number) => (
                      <div key={c.clientId} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-5">#{i + 1}</span>
                          <div>
                            <p className="font-medium text-gray-900">{c.clientName ?? `Klient #${c.clientId}`}</p>
                            <p className="text-xs text-gray-400">{c.completedCount} termínů · skóre {c.behaviorScore?.toFixed(0)}</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{formatCurrency(c.totalRevenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Revenue by month — last 12 months */}
              {stats.revenueByMonth && Object.keys(stats.revenueByMonth).length > 0 && (
                <div className="card col-span-1 md:col-span-2">
                  <h2 className="font-semibold text-gray-900 mb-4">Výnosy po měsících — posledních 12 měsíců</h2>
                  {(() => {
                    const entries = Object.entries(stats.revenueByMonth as Record<string, number>)
                      .sort(([a], [b]) => a.localeCompare(b));
                    const maxRev = Math.max(...entries.map(([, v]) => v as number), 1);
                    const total12 = entries.reduce((s, [, v]) => s + (v as number), 0);
                    return (
                      <>
                        <div className="text-xs text-gray-500 mb-3">
                          Celkem za 12 měsíců: <span className="font-semibold text-gray-800">{formatCurrency(total12)}</span>
                        </div>
                        <div className="space-y-2">
                          {entries.map(([month, rev]) => (
                            <div key={month} className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 w-20 flex-shrink-0">{month}</span>
                              <Bar value={rev as number} max={maxRev} color="bg-emerald-500" />
                              <span className="text-xs font-semibold text-gray-700 w-24 text-right">
                                {formatCurrency(rev as number)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}

          {/* Rooms + Employees period selector */}
          <div className="card mt-6 mb-4 flex flex-wrap gap-4 items-center">
            <h2 className="font-semibold text-gray-900 mr-auto">Obsazenost místností & výkon</h2>
            <label className="text-sm text-gray-600">Období:</label>
            <select
              className="input w-auto text-sm py-1.5"
              value={statsDays}
              onChange={(e) => setStatsDays(e.target.value)}
            >
              <option value="7">7 dní</option>
              <option value="30">30 dní</option>
              <option value="90">90 dní</option>
              <option value="365">1 rok</option>
            </select>
          </div>

          {/* Rooms utilization */}
          {roomsUtil && (
            <div className="card mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Obsazenost místností</h2>
                <span className="text-xs text-gray-400">Posledních {roomsUtil.periodDays} dní</span>
              </div>
              {roomsUtil.rooms?.length === 0 ? (
                <p className="text-sm text-gray-400">Žádné místnosti</p>
              ) : (
                <div className="space-y-4">
                  {roomsUtil.rooms?.map((room: any) => (
                    <div key={room.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{room.name}</span>
                          {!room.isActive && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">neaktivní</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{room.totalAppointments} termínů</span>
                          <span className="font-semibold text-gray-800">{room.utilizationPct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            room.utilizationPct >= 80 ? "bg-green-500" :
                            room.utilizationPct >= 50 ? "bg-blue-500" :
                            room.utilizationPct >= 20 ? "bg-yellow-400" : "bg-gray-300"
                          }`}
                          style={{ width: `${room.utilizationPct}%` }}
                        />
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span className="text-green-600">✓ {room.completedAppointments} dokončeno</span>
                        <span className="text-red-400">✗ {room.cancelledAppointments} zrušeno</span>
                        <span className="ml-auto">{room.avgPerDay}/den průměr</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Employees performance */}
          {empPerf && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Výkon terapeutů</h2>
                <span className="text-xs text-gray-400">Posledních {empPerf.periodDays} dní</span>
              </div>
              {empPerf.employees?.length === 0 ? (
                <p className="text-sm text-gray-400">Žádní terapeuti</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-4 text-gray-500 font-medium">Terapeut</th>
                        <th className="text-center py-2 px-2 text-gray-500 font-medium">Termínů</th>
                        <th className="text-center py-2 px-2 text-gray-500 font-medium">Dokončeno</th>
                        <th className="text-center py-2 px-2 text-gray-500 font-medium">Zrušeno</th>
                        <th className="text-center py-2 px-2 text-gray-500 font-medium">Úspěšnost</th>
                        <th className="text-right py-2 pl-2 text-gray-500 font-medium">Průměr/den</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empPerf.employees?.map((emp: any) => (
                        <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-800">{emp.name}</p>
                            <p className="text-xs text-gray-400">{emp.email}</p>
                          </td>
                          <td className="text-center py-3 px-2 font-semibold text-gray-700">{emp.totalAppointments}</td>
                          <td className="text-center py-3 px-2 text-green-600">{emp.completedAppointments}</td>
                          <td className="text-center py-3 px-2 text-red-400">{emp.cancelledAppointments}</td>
                          <td className="text-center py-3 px-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              emp.completionRate >= 80 ? "bg-green-100 text-green-700" :
                              emp.completionRate >= 60 ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {emp.completionRate}%
                            </span>
                          </td>
                          <td className="text-right py-3 pl-2 text-gray-600">{emp.avgPerDay}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          </>}
        </div>
      </Layout>
    </RouteGuard>
  );
}
