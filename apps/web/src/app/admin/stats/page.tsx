"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminStats() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const url = `/stats${from || to ? "?" + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }) : ""}`;
  const { data: stats } = useSWR(url, fetcher);

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Statistiky</h1>

          <div className="card mb-6 flex gap-4 items-end">
            <div>
              <label className="label">Od</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Do</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button className="btn-secondary" onClick={() => { setFrom(""); setTo(""); }}>Reset</button>
          </div>

          {stats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Celkem termínů", value: stats.totalAppts },
                  { label: "Potvrzeno", value: stats.confirmedAppts },
                  { label: "Zrušeno", value: stats.cancelledAppts },
                  { label: "No-show", value: stats.noShowAppts },
                ].map((s) => (
                  <div key={s.label} className="card text-center">
                    <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="card">
                  <p className="text-sm text-gray-500 mb-1">Výnosy (dokončené)</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(stats.revenue)}</p>
                </div>
                <div className="card">
                  <p className="text-sm text-gray-500 mb-1">Klientů celkem</p>
                  <p className="text-3xl font-bold text-primary-600">{stats.totalClients}</p>
                </div>
              </div>

              {/* Occupancy by day */}
              <div className="card">
                <h2 className="font-semibold mb-4">Obsazenost (posledních 7 dní)</h2>
                <div className="space-y-2">
                  {Object.entries(stats.occupancyByDay as Record<string, number>)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, count]) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24">{day}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className="bg-primary-500 h-full rounded-full transition-all"
                            style={{ width: `${Math.min((count / 10) * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-700 w-6">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
