"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { Shield, Users, Trash2, Activity, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`card border-l-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <span className="text-gray-500">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function GdprDashboardPage() {
  const shouldReduce = useReducedMotion();
  const { data: stats, isLoading, mutate } = useSWR("/gdpr/stats", fetcher, { refreshInterval: 30_000 });
  const { data: erasureRequests, mutate: mutateErasure } = useSWR("/gdpr/erasure-requests", fetcher);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const { toast } = useToast();

  const handleErasure = async (clientId: number, requestId: number) => {
    if (!confirm(`Opravdu chcete anonymizovat/smazat data klienta ID ${clientId}? Tato akce je nevratná.`)) return;
    setProcessingId(requestId);
    try {
      await api.post("/gdpr/erasure", { clientId, notes: `Vyřízeno z GDPR dashboardu, request #${requestId}` });
      toast("success", "Data byla úspěšně anonymizována.");
      mutate();
      mutateErasure();
    } catch (e: unknown) {
      toast("error", "Chyba: " + (e instanceof Error ? e.message : "Neznámá chyba"));
    } finally {
      setProcessingId(null);
    }
  };

  const statCards = [
    { icon: <Users size={16} />, label: "Klientů celkem", value: isLoading ? "…" : stats?.totalClients ?? 0, color: "border-blue-400" },
    { icon: <CheckCircle size={16} />, label: "Se souhlasem", value: isLoading ? "…" : stats?.consentGranted ?? 0, sub: isLoading ? "" : `${stats?.consentRate ?? 0} % klientů`, color: "border-green-400" },
    { icon: <Clock size={16} />, label: "Čeká na výmaz", value: isLoading ? "…" : stats?.pendingErasure ?? 0, color: "border-amber-400" },
    { icon: <Trash2 size={16} />, label: "Vymazáno", value: isLoading ? "…" : stats?.completedErasure ?? 0, color: "border-gray-300" },
  ];

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Shield size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">GDPR Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Přehled souhlasů, žádostí o výmaz a přístupů ke zdravotním datům</p>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
              >
                <StatCard
                  icon={card.icon}
                  label={card.label}
                  value={card.value}
                  sub={card.sub}
                  color={card.color}
                />
              </motion.div>
            ))}
          </div>

          {/* Pending erasure requests */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trash2 size={18} className="text-amber-500" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Žádosti o výmaz dat</h2>
              <AnimatePresence>
                {erasureRequests?.requests?.filter((r: any) => r.status === "PENDING").length > 0 && (
                  <motion.span
                    initial={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="badge badge-amber ml-2"
                  >
                    {erasureRequests.requests.filter((r: any) => r.status === "PENDING").length} čeká
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {!erasureRequests?.requests?.length ? (
              <p className="text-sm text-gray-500 py-2">Žádné žádosti o výmaz.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-2 pr-4">Klient</th>
                      <th className="pb-2 pr-4">Požadoval</th>
                      <th className="pb-2 pr-4">Datum</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Akce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {erasureRequests.requests.map((r: any, i: number) => (
                      <motion.tr
                        key={r.id}
                        initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.02 }}
                        className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                      >
                        <td className="py-2 pr-4">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{r.client_name ?? `ID ${r.client_id}`}</span>
                        </td>
                        <td className="py-2 pr-4 text-gray-500">{r.admin_name ?? `ID ${r.requested_by}`}</td>
                        <td className="py-2 pr-4 text-gray-500">{r.created_at?.slice(0, 10)}</td>
                        <td className="py-2 pr-4">
                          <span className={`badge ${r.status === "PENDING" ? "badge-amber" : "badge-green"}`}>
                            {r.status === "PENDING" ? "Čeká" : "Vyřízeno"}
                          </span>
                        </td>
                        <td className="py-2">
                          {r.status === "PENDING" && (
                            <motion.button
                              onClick={() => handleErasure(r.client_id, r.id)}
                              disabled={processingId === r.id}
                              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            >
                              {processingId === r.id ? "Zpracovávám…" : "Anonymizovat"}
                            </motion.button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Recent health record access log */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
            className="card"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-blue-500" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Přístupy ke zdravotním datům (posledních 50)</h2>
            </div>

            {!stats?.recentAccessLogs?.length ? (
              <p className="text-sm text-gray-500 py-2">Žádné záznamy přístupů.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-800">
                      <th className="pb-2 pr-3">Přistupující</th>
                      <th className="pb-2 pr-3">Klient</th>
                      <th className="pb-2 pr-3">Akce</th>
                      <th className="pb-2 pr-3">IP adresa</th>
                      <th className="pb-2">Kdy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentAccessLogs.map((log: any, i: number) => (
                      <motion.tr
                        key={log.id}
                        initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.015 }}
                        className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                      >
                        <td className="py-1.5 pr-3 font-medium text-gray-700 dark:text-gray-300">
                          {log.accessor_name ?? `ID ${log.accessor_id}`}
                        </td>
                        <td className="py-1.5 pr-3 text-gray-500">{log.client_name ?? `ID ${log.client_id}`}</td>
                        <td className="py-1.5 pr-3">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                            log.action === "READ" ? "bg-blue-100 text-blue-700" :
                            log.action === "UPDATE" ? "bg-amber-100 text-amber-700" :
                            log.action === "CREATE" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3 text-gray-500 font-mono">{log.ip_address ?? "—"}</td>
                        <td className="py-1.5 text-gray-500">{log.created_at?.slice(0, 16)?.replace("T", " ")}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
