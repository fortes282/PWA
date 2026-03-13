"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";

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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const url = `/stats${from || to ? "?" + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }) : ""}`;
  const { data: stats } = useSWR(url, fetcher);

  const maxOccupancy = stats
    ? Math.max(...Object.values(stats.occupancyByDay as Record<string, number>), 1)
    : 1;

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistiky</h1>

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
            </>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
