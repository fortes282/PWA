"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate } from "swr";
import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RiskAppointment {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  risk_score: number;
  client_id: number;
  client_name: string;
  client_email: string;
  employee_id: number;
  employee_name: string;
  service_name: string;
}

interface InactiveClient {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  last_appointment: string | null;
  last_reengagement_at: string | null;
  total_appointments: number;
}

interface InactiveStats {
  inactive30: number;
  inactive60: number;
  inactive90: number;
}

interface WaitlistStats {
  total: number;
  waiting: number;
  notified: number;
  booked: number;
  avgWaitDays: number | null;
  fillRate: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function riskColor(score: number) {
  if (score >= 80) return "bg-red-100 text-red-800 border-red-200";
  if (score >= 60) return "bg-orange-100 text-orange-800 border-orange-200";
  if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-green-100 text-green-800 border-green-200";
}

function riskLabel(score: number) {
  if (score >= 80) return "Kritické";
  if (score >= 60) return "Vysoké";
  if (score >= 40) return "Střední";
  return "Nízké";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AIWaitlistPage() {
  const [activeTab, setActiveTab] = useState<"risk" | "inactive" | "waitlist">("risk");
  const [inactiveDays, setInactiveDays] = useState(30);
  const [autoOfferLoading, setAutoOfferLoading] = useState(false);
  const [autoOfferResult, setAutoOfferResult] = useState<{ checked: number; notified: number } | null>(null);

  const { data: riskData, isLoading: riskLoading } = useSWR<{ appointments: RiskAppointment[] }>(
    "/analytics/cancellation-risk?minScore=0&limit=100",
    (url: string) => api.get<{ appointments: RiskAppointment[] }>(url)
  );

  const { data: inactiveData, isLoading: inactiveLoading } = useSWR<{ clients: InactiveClient[]; stats: InactiveStats }>(
    `/analytics/inactive-clients?days=${inactiveDays}`,
    (url: string) => api.get<{ clients: InactiveClient[]; stats: InactiveStats }>(url)
  );

  const { data: waitlistStatsData, isLoading: waitlistLoading } = useSWR<WaitlistStats>(
    "/waitlist/stats",
    (url: string) => api.get<WaitlistStats>(url)
  );

  const highRisk = riskData?.appointments.filter((a) => a.risk_score > 70) ?? [];
  const allRisk = riskData?.appointments ?? [];

  async function handleAutoOffer() {
    setAutoOfferLoading(true);
    setAutoOfferResult(null);
    try {
      const res = await api.post<{ checked: number; notified: number }>("/waitlist/auto-offer", {});
      setAutoOfferResult(res);
      mutate("/analytics/cancellation-risk?minScore=0&limit=100");
    } catch {
      alert("Chyba při spuštění auto-nabídky");
    } finally {
      setAutoOfferLoading(false);
    }
  }

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Prediktivní Waitlist</h1>
              <p className="text-sm text-gray-500 mt-1">
                Cancellation risk scoring, auto-nabídky, re-engagement
              </p>
            </div>
            <button
              onClick={handleAutoOffer}
              disabled={autoOfferLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {autoOfferLoading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
              Spustit Auto-Nabídku
            </button>
          </div>

          {/* Auto-offer result */}
          {autoOfferResult && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              ✓ Auto-nabídka dokončena: zkontrolováno {autoOfferResult.checked} termínů,
              notifikováno {autoOfferResult.notified} klientů z waitlistu
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard
              label="Vysoké riziko"
              value={highRisk.length}
              sub="termínů (>70)"
              color="text-red-600"
            />
            <SummaryCard
              label="Na waitlistu"
              value={waitlistStatsData?.waiting ?? "—"}
              sub="čeká na termín"
              color="text-indigo-600"
            />
            <SummaryCard
              label="Neaktivní 30+"
              value={inactiveData?.stats.inactive30 ?? "—"}
              sub="klientů"
              color="text-orange-600"
            />
            <SummaryCard
              label="Fill rate"
              value={waitlistStatsData?.fillRate != null ? `${waitlistStatsData.fillRate}%` : "—"}
              sub="waitlist→termín"
              color="text-green-600"
            />
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex gap-4">
              {(["risk", "inactive", "waitlist"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "risk" && "Cancellation Risk"}
                  {tab === "inactive" && "Neaktivní Klienti"}
                  {tab === "waitlist" && "Waitlist Statistiky"}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab: Cancellation Risk */}
          {activeTab === "risk" && (
            <div>
              {riskLoading ? (
                <Loading />
              ) : allRisk.length === 0 ? (
                <Empty text="Žádné nadcházející termíny k zobrazení." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Termín</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Klient</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Terapeut</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Služba</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Risk Score</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Riziko</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allRisk.map((a) => (
                        <tr key={a.id} className={a.risk_score > 70 ? "bg-red-50/40" : ""}>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">{formatDateTime(a.start_time)}</td>
                          <td className="px-4 py-3">
                            <div>{a.client_name}</div>
                            <div className="text-xs text-gray-400">{a.client_email}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{a.employee_name}</td>
                          <td className="px-4 py-3">{a.service_name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${riskColor(a.risk_score)}`}>
                              {Math.round(a.risk_score)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium ${a.risk_score > 70 ? "text-red-600" : a.risk_score > 50 ? "text-orange-500" : "text-gray-500"}`}>
                              {riskLabel(a.risk_score)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Neaktivní Klienti */}
          {activeTab === "inactive" && (
            <div>
              {/* Filter */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm text-gray-600">Neaktivní déle než:</span>
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    onClick={() => setInactiveDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      inactiveDays === d
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {d} dní
                  </button>
                ))}
              </div>

              {/* Stats badges */}
              {inactiveData?.stats && (
                <div className="flex gap-3 mb-4">
                  <Badge label="30+ dní" value={inactiveData.stats.inactive30} color="orange" />
                  <Badge label="60+ dní" value={inactiveData.stats.inactive60} color="red" />
                  <Badge label="90+ dní" value={inactiveData.stats.inactive90} color="red" />
                </div>
              )}

              {inactiveLoading ? (
                <Loading />
              ) : !inactiveData?.clients.length ? (
                <Empty text="Žádní neaktivní klienti." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Klient</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Poslední termín</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Dní od termínu</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Celkem termínů</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Poslední re-engagement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {inactiveData.clients.map((c) => {
                        const days = daysSince(c.last_appointment);
                        return (
                          <tr key={c.id}>
                            <td className="px-4 py-3">
                              <div className="font-medium">{c.name}</div>
                              <div className="text-xs text-gray-400">{c.email}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {c.last_appointment ? formatDate(c.last_appointment) : "Nikdy"}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {days != null ? (
                                <span className={`font-medium ${days > 90 ? "text-red-600" : days > 60 ? "text-orange-500" : "text-yellow-600"}`}>
                                  {days}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">{c.total_appointments}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">
                              {c.last_reengagement_at ? formatDate(c.last_reengagement_at) : "Nikdy"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab: Waitlist Stats */}
          {activeTab === "waitlist" && (
            <div>
              {waitlistLoading ? (
                <Loading />
              ) : !waitlistStatsData ? (
                <Empty text="Žádná data." />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <StatCard label="Celkem na waitlistu" value={waitlistStatsData.total} />
                  <StatCard label="Čekající" value={waitlistStatsData.waiting} color="indigo" />
                  <StatCard label="Notifikováno" value={waitlistStatsData.notified} color="yellow" />
                  <StatCard label="Rezervováno" value={waitlistStatsData.booked} color="green" />
                  <StatCard
                    label="Průměrná čekací doba"
                    value={waitlistStatsData.avgWaitDays != null ? `${waitlistStatsData.avgWaitDays} dní` : "—"}
                  />
                  <StatCard
                    label="Fill Rate"
                    value={waitlistStatsData.fillRate != null ? `${waitlistStatsData.fillRate}%` : "—"}
                    color="green"
                    sub="waitlist → termín"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    indigo: "text-indigo-600",
    green: "text-green-600",
    yellow: "text-yellow-600",
    red: "text-red-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="text-sm text-gray-500 mb-2">{label}</div>
      <div className={`text-3xl font-bold ${color ? colorMap[color] : "text-gray-800"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function Badge({ label, value, color }: { label: string; value: number; color: "orange" | "red" }) {
  const cls = color === "red" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700";
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${cls}`}>
      <span className="font-bold text-sm">{value}</span> {label}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <svg className="animate-spin h-6 w-6 text-indigo-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-center py-12 text-sm text-gray-400">{text}</div>
  );
}
