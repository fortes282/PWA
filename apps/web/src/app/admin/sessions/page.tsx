"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Shield, LogIn, LogOut, Users, Clock, AlertTriangle, RefreshCw } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "právě teď";
  if (mins < 60) return `před ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `před ${hours}h`;
  const days = Math.floor(hours / 24);
  return `před ${days}d`;
}

function parseUA(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return ua.slice(0, 30) + "…";
}

export default function AdminSessions() {
  const [activeTab, setActiveTab] = useState<"sessions" | "history">("sessions");
  const { data: sessions, mutate: mutateSessions } = useSWR<any[]>("/admin/active-sessions", fetcher as any, { refreshInterval: 30000 });
  const { data: historyData, mutate: mutateHistory } = useSWR<any>("/admin/login-history?limit=100", fetcher);
  const [revoking, setRevoking] = useState<number | null>(null);

  const handleRevoke = async (sessionId: number) => {
    if (!confirm("Opravdu chcete zrušit tuto relaci?")) return;
    setRevoking(sessionId);
    try {
      await api.delete(`/admin/active-sessions/${sessionId}`);
      mutateSessions();
    } catch { /* ignore */ }
    setRevoking(null);
  };


  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            <Shield className="inline mr-2" size={24} />
            Relace & Přihlášení
          </h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("sessions")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "sessions" ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-b-2 border-primary-600" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <span className="flex items-center gap-2"><Users size={14} /> Aktivní relace</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "history" ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-b-2 border-primary-600" : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
            >
              <span className="flex items-center gap-2"><Clock size={14} /> Historie přihlášení</span>
            </button>
          </div>

          {/* Active Sessions Tab */}
          {activeTab === "sessions" && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <LogIn size={18} /> Aktivní relace ({sessions?.length ?? 0})
                </h2>
                <button onClick={() => mutateSessions()} className="btn-secondary text-sm flex items-center gap-1">
                  <RefreshCw size={12} /> Obnovit
                </button>
              </div>
              {sessions && sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Uživatel</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Role</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Přihlášen</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Vyprší</th>
                        <th className="text-right py-2 text-gray-500 dark:text-gray-500">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s: any) => (
                        <tr key={s.sessionId} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{s.userName}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">{s.userEmail}</div>
                          </td>
                          <td className="py-2">
                            <span className={`badge-${s.userRole === "ADMIN" ? "danger" : s.userRole === "RECEPTION" ? "warning" : s.userRole === "EMPLOYEE" ? "info" : "success"}`}>
                              {s.userRole}
                            </span>
                          </td>
                          <td className="py-2 text-gray-600 dark:text-gray-500">{timeAgo(s.createdAt)}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-500">{timeAgo(s.expiresAt)}</td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => handleRevoke(s.sessionId)}
                              disabled={revoking === s.sessionId}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs flex items-center gap-1 ml-auto"
                            >
                              <LogOut size={12} /> Zrušit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Žádné aktivní relace</p>
              )}
            </div>
          )}

          {/* Login History Tab */}
          {activeTab === "history" && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Clock size={18} /> Posledních 100 přihlášení
                </h2>
                <button onClick={() => mutateHistory()} className="btn-secondary text-sm flex items-center gap-1">
                  <RefreshCw size={12} /> Obnovit
                </button>
              </div>
              {historyData?.items?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Stav</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Uživatel</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Role</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">IP</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Prohlížeč</th>
                        <th className="text-left py-2 text-gray-500 dark:text-gray-500">Čas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.items.map((h: any) => (
                        <tr key={h.id} className={`border-b border-gray-100 dark:border-gray-800 ${!h.success ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                          <td className="py-2">
                            {h.success ? (
                              <span className="text-green-600 dark:text-green-400 flex items-center gap-1"><LogIn size={14} /> OK</span>
                            ) : (
                              <span className="text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle size={14} /> Neúspěch</span>
                            )}
                          </td>
                          <td className="py-2">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{h.userName ?? "—"}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">{h.userEmail ?? "—"}</div>
                          </td>
                          <td className="py-2 text-gray-600 dark:text-gray-500">{h.userRole ?? "—"}</td>
                          <td className="py-2 font-mono text-xs text-gray-600 dark:text-gray-500">{h.ip ?? "—"}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-500">{parseUA(h.userAgent)}</td>
                          <td className="py-2 text-gray-600 dark:text-gray-500">{timeAgo(h.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Žádná historie přihlášení</p>
              )}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
