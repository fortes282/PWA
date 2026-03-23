"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Activity, Database, HardDrive, Clock, Cpu, BarChart3, RefreshCw, Download, Server, Zap, Layers } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

function formatBytes(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminMonitoring() {
  const shouldReduce = useReducedMotion();
  const { data: metrics, mutate: mutateMetrics, isLoading: metricsLoading } = useSWR<any>("/health/metrics", fetcher, { refreshInterval: 30000 });
  const { data: healthDetail, mutate: mutateHealth, isLoading: healthLoading } = useSWR<any>("/health/detailed", fetcher, { refreshInterval: 30000 });
  const { data: backupData, mutate: mutateBackups } = useSWR<any>("/admin/backups", fetcher);
  const [backingUp, setBackingUp] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupMsg("");
    try {
      const result = await api.post<any>("/admin/backup", {});
      if (result.success) {
        setBackupMsg(`✅ Záloha vytvořena (${(result.sizeBytes / (1024 * 1024)).toFixed(1)} MB)`);
      } else {
        setBackupMsg(`❌ ${result.error || "Chyba při zálohování"}`);
      }
      mutateBackups();
    } catch {
      setBackupMsg("❌ Chyba při zálohování");
    } finally {
      setBackingUp(false);
    }
  };

  const handleRefresh = () => {
    mutateMetrics();
    mutateHealth();
    mutateBackups();
  };

  const isLoading = metricsLoading || healthLoading;

  const systemCards = [
    {
      icon: <Clock size={20} className="text-green-600 dark:text-green-400" />,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      label: "Uptime",
      value: metrics ? formatUptime(metrics.uptimeSeconds) : "—",
    },
    {
      icon: <Zap size={20} className="text-blue-600 dark:text-blue-400" />,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      label: "Celkem požadavků",
      value: metrics ? metrics.totalRequests.toLocaleString("cs") : "—",
    },
    {
      icon: <Cpu size={20} className="text-purple-600 dark:text-purple-400" />,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      label: "Paměť (RSS)",
      value: metrics ? formatBytes(metrics.memory.rss) : "—",
    },
    {
      icon: <Layers size={20} className="text-orange-600 dark:text-orange-400" />,
      iconBg: "bg-orange-100 dark:bg-orange-900/30",
      label: "Heap used / total",
      value: metrics ? `${formatBytes(metrics.memory.heapUsed)} / ${formatBytes(metrics.memory.heapTotal)}` : "—",
    },
  ];

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <Server className="inline mr-2" size={24} />
              Monitoring
            </h1>
            <motion.button
              onClick={handleRefresh}
              className="btn-secondary flex items-center gap-2"
              disabled={isLoading}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Obnovit
            </motion.button>
          </motion.div>

          {/* System Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {systemCards.map((card, i) => (
              <motion.div
                key={card.label}
                initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                className="card"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 ${card.iconBg} rounded-lg`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{card.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Database Status */}
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
              className="card"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Database size={18} /> Databáze
              </h2>
              {healthDetail ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Stav</span>
                    <span className={`font-medium ${healthDetail.db?.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {healthDetail.db?.ok ? "✅ OK" : "❌ Chyba"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Latence</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {healthDetail.db?.latencyMs != null ? `${healthDetail.db.latencyMs} ms` : "—"}
                    </span>
                  </div>
                  {healthDetail.dbSize && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Velikost DB</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{healthDetail.dbSize}</span>
                    </div>
                  )}
                  {healthDetail.tableStats && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Tabulky</p>
                      <div className="grid grid-cols-2 gap-1 text-sm">
                        {Object.entries(healthDetail.tableStats as Record<string, number>)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 10)
                          .map(([table, count], idx) => (
                            <motion.div
                              key={table}
                              initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 + idx * 0.02 }}
                              className="flex justify-between px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded"
                            >
                              <span className="text-gray-600 dark:text-gray-400 truncate">{table}</span>
                              <span className="font-mono text-gray-900 dark:text-gray-100 ml-2">{(count as number).toLocaleString("cs")}</span>
                            </motion.div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Načítání...</p>
              )}
            </motion.div>

            {/* Top Routes */}
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
              className="card"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <BarChart3 size={18} /> Nejčastější endpointy
              </h2>
              {metrics?.topRoutes?.length > 0 ? (
                <div className="space-y-2">
                  {metrics.topRoutes.map((r: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.2 + i * 0.03 }}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${r.method === "GET" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : r.method === "POST" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400"}`}>
                        {r.method}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 truncate flex-1 font-mono text-xs">
                        {r.route}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {r.count}× | {r.avgMs}ms
                      </span>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Zatím žádné metriky</p>
              )}
            </motion.div>
          </div>

          {/* Backup Section */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
            className="card mb-6"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <HardDrive size={18} /> Zálohy databáze
            </h2>
            <div className="flex items-center gap-4 mb-4">
              <motion.button
                onClick={handleBackup}
                disabled={backingUp}
                className="btn-primary flex items-center gap-2"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                {backingUp ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                {backingUp ? "Zálohování..." : "Vytvořit zálohu"}
              </motion.button>
              <AnimatePresence>
                {backupMsg && (
                  <motion.span
                    key="backup-msg"
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {backupMsg}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            {backupData?.backups?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-500 dark:text-gray-400">Soubor</th>
                      <th className="text-left py-2 text-gray-500 dark:text-gray-400">Velikost</th>
                      <th className="text-left py-2 text-gray-500 dark:text-gray-400">Vytvořeno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupData.backups.slice(0, 10).map((b: any, i: number) => (
                      <motion.tr
                        key={b.name}
                        initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.03 }}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{b.name}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{b.sizeMB} MB</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">
                          {new Date(b.created).toLocaleString("cs")}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Žádné zálohy</p>
            )}
          </motion.div>

          {/* Active Requests & Errors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.25 }}
              className="card"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Activity size={18} /> Aktivní požadavky
              </h2>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {metrics?.activeRequests ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">právě zpracovávaných</p>
            </motion.div>
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.3 }}
              className="card"
            >
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Activity size={18} /> Celkové chyby
              </h2>
              <p className={`text-3xl font-bold ${(metrics?.totalErrors ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {metrics?.totalErrors ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">od posledního restartu</p>
            </motion.div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
