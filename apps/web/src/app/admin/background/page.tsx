"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Activity, AlertTriangle, Award, RefreshCw, Server, Database, Clock, Star, MessageSquare, FileText } from "lucide-react";
import ClientTimeline from "@/components/ClientTimeline";

const fetcher = (url: string) => api.get<any>(url);

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
};

const SCORE_BG = (score: number) => {
  if (score >= 80) return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
  if (score >= 60) return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
  if (score >= 40) return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
  return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
};

const BEHAVIOR_TYPE_LABELS: Record<string, string> = {
  UNJUSTIFIED_CANCEL: "Neoprávněné storno",
  LATE_CANCEL: "Pozdní zrušení",
  TIMELY_CANCEL: "Včasné zrušení",
  ON_TIME: "Dochvilnost",
  POSITIVE_FEEDBACK: "Pozitivní zpětná vazba",
};

const BEHAVIOR_TYPES = Object.keys(BEHAVIOR_TYPE_LABELS) as Array<keyof typeof BEHAVIOR_TYPE_LABELS>;

function AuditLogTab() {
  const shouldReduce = useReducedMotion();
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const loadAudit = async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 1 : page;
      const url = `/audit?limit=${LIMIT}&page=${p}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ""}`;
      const data = await api.get<{ items: any[]; pagination: any }>(url);
      if (reset) {
        setItems(data.items);
        setPage(1);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setPage((prev) => prev + 1);
      }
      setTotal(data.pagination?.total ?? 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAudit(true); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filtrovat podle akce…"
          className="input max-w-xs"
        />
        <motion.button
          onClick={() => loadAudit(true)}
          className="btn-secondary text-sm flex items-center gap-1"
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Obnovit
        </motion.button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Celkem záznamů: {total}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="py-2 pr-4">Čas</th>
              <th className="py-2 pr-4">Akce</th>
              <th className="py-2 pr-4">Uživatel</th>
              <th className="py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td colSpan={4} className="text-gray-500 dark:text-gray-400 text-center py-6">Žádné záznamy</td></tr>
            )}
            {items.map((item: any, i: number) => (
              <motion.tr
                key={item.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: Math.min(i * 0.015, 0.4) }}
                className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <td className="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString("cs-CZ") : "—"}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-primary-700 dark:text-primary-400">{item.action}</td>
                <td className="py-2 pr-4 text-xs text-gray-600 dark:text-gray-400">{item.userId ?? "—"}</td>
                <td className="py-2 text-xs text-gray-500 dark:text-gray-400 max-w-xs truncate">
                  {item.details ? JSON.stringify(item.details) : ""}
                  {item.targetType && <span className="ml-1 text-gray-500 dark:text-gray-400">[{item.targetType}{item.targetId ? ` #${item.targetId}` : ""}]</span>}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length < total && (
        <div className="text-center mt-4">
          <motion.button
            onClick={() => loadAudit(false)}
            disabled={loading}
            className="btn-secondary text-sm"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            {loading ? "Načítám…" : `Načíst další (${total - items.length} zbývá)`}
          </motion.button>
        </div>
      )}
    </div>
  );
}

export default function AdminBackground() {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"behavior" | "audit">("behavior");
  const { data: clients } = useSWR<any[]>("/clients", fetcher as any);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const { data: healthDetail, mutate: mutateHealth } = useSWR<any>("/health/detailed", fetcher);
  const { data: ratingsSummary } = useSWR<any[]>("/ratings/summary", fetcher as any);
  const { data: processorStatus, mutate: mutateProcessor } = useSWR<any>("/auto-processor/status", fetcher);
  const [processorRunning, setProcessorRunning] = useState(false);
  const { data: behavior, mutate: mutateBehavior } = useSWR(
    selectedClient ? `/behavior/${selectedClient}` : null,
    fetcher
  );
  const [recordType, setRecordType] = useState("UNJUSTIFIED_CANCEL");
  const [recordNote, setRecordNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleRunUnjustifiedCancels = async () => {
    setProcessorRunning(true);
    try {
      await api.post("/auto-processor/no-shows", {});
      await api.post("/auto-processor/invoice-overdue", {});
      mutateProcessor();
    } catch { /* ignore */ } finally {
      setProcessorRunning(false);
    }
  };

  const handleRecord = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      await api.post("/behavior/record", {
        userId: selectedClient,
        type: recordType,
        note: recordNote || undefined,
      });
      setRecordNote("");
      mutateBehavior();
    } finally {
      setSaving(false);
    }
  };

  const sortedClients = [...(clients ?? [])].sort(
    (a, b) => (a.behaviorScore ?? 100) - (b.behaviorScore ?? 100)
  );

  const atRisk = sortedClients.filter((c) => (c.behaviorScore ?? 100) < 60);
  const excellent = sortedClients.filter((c) => (c.behaviorScore ?? 100) >= 90);

  const summaryCards = [
    {
      icon: <AlertTriangle size={18} className="text-red-500" />,
      label: "Rizikové klienty",
      value: atRisk.length,
      valueColor: "text-red-600 dark:text-red-400",
      sub: "skóre < 60",
      border: "border border-red-100 dark:border-red-900/40",
    },
    {
      icon: <Award size={18} className="text-green-500" />,
      label: "Výborní klienti",
      value: excellent.length,
      valueColor: "text-green-600 dark:text-green-400",
      sub: "skóre ≥ 90",
      border: "border border-green-100 dark:border-green-900/40",
    },
    {
      icon: <Activity size={18} className="text-primary-500" />,
      label: "Průměr",
      value: clients && clients.length > 0
        ? Math.round(clients.reduce((s, c) => s + (c.behaviorScore ?? 100), 0) / clients.length)
        : "—",
      valueColor: "text-gray-900 dark:text-gray-100",
      sub: "průměrné skóre",
      border: "",
    },
  ];

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.h1
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4"
          >
            Automatizace — Správa
          </motion.h1>

          {/* Tabs */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.04 }}
            className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700"
          >
            {(["behavior", "audit"] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab
                    ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-500"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <span className="flex items-center gap-2">
                  {tab === "behavior" ? <Activity size={14} /> : <FileText size={14} />}
                  {tab === "behavior" ? "Skóre dochvilnosti" : "Audit Log"}
                </span>
              </motion.button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">
            {/* Audit Log Tab */}
            {activeTab === "audit" && (
              <motion.div
                key="audit-tab"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Audit Log</h2>
                <AuditLogTab />
              </motion.div>
            )}

            {/* Behavior Tab */}
            {activeTab === "behavior" && (
              <motion.div
                key="behavior-tab"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              >
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {summaryCards.map((card, i) => (
                    <motion.div
                      key={card.label}
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                      className={`card ${card.border}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {card.icon}
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{card.label}</span>
                      </div>
                      <p className={`text-3xl font-bold ${card.valueColor}`}>{card.value}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.sub}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Client list */}
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                  >
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Všichni klienti</h2>
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {sortedClients.map((c, i) => (
                        <motion.button
                          key={c.id}
                          initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 + i * 0.025 }}
                          onClick={() => setSelectedClient(c.id === selectedClient ? null : c.id)}
                          className={`w-full text-left card border transition-all ${
                            selectedClient === c.id
                              ? "border-primary-300 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/30"
                              : `${SCORE_BG(c.behaviorScore ?? 100)} hover:shadow-md`
                          }`}
                          whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{c.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-bold ${SCORE_COLOR(c.behaviorScore ?? 100)}`}>
                                {c.behaviorScore ?? 100}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">skóre</p>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                      {sortedClients.length === 0 && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Žádní klienti</p>
                      )}
                    </div>
                  </motion.div>

                  {/* Behavior detail + record */}
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.12 }}
                  >
                    <AnimatePresence mode="wait">
                      {!selectedClient ? (
                        <motion.div
                          key="empty-state"
                          initial={shouldReduce ? {} : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={shouldReduce ? {} : { opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="card text-center text-gray-500 dark:text-gray-400 py-12"
                        >
                          <Activity size={32} className="mx-auto mb-3 opacity-30" />
                          <p>Vyberte klienta pro detail a záznam události</p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={`client-${selectedClient}`}
                          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        >
                          <div className="card mb-4">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                                {clients?.find((c) => c.id === selectedClient)?.name}
                              </h2>
                              <motion.button
                                onClick={() => mutateBehavior()}
                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                whileTap={shouldReduce ? undefined : { scale: 0.9, rotate: 180 }}
                                transition={{ duration: 0.3 }}
                              >
                                <RefreshCw size={14} />
                              </motion.button>
                            </div>
                            <div className="text-center mb-4">
                              <p className={`text-4xl font-bold ${SCORE_COLOR(behavior?.score ?? 100)}`}>
                                {behavior?.score ?? 100}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">aktuální skóre</p>
                            </div>

                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                              Historie událostí
                            </h3>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {(behavior?.events ?? []).length === 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">Žádné události</p>
                              )}
                              {(behavior?.events ?? [])
                                .sort((a: any, b: any) => b.createdAt?.localeCompare(a.createdAt ?? "") ?? 0)
                                .map((ev: any, i: number) => (
                                  <motion.div
                                    key={ev.id}
                                    initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.02 }}
                                    className="flex items-center justify-between text-xs py-1 border-b border-gray-50 dark:border-gray-800"
                                  >
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {BEHAVIOR_TYPE_LABELS[ev.type] ?? ev.type}
                                      {ev.note ? ` — ${ev.note}` : ""}
                                    </span>
                                    <span className={ev.points >= 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
                                      {ev.points >= 0 ? "+" : ""}{ev.points}
                                    </span>
                                  </motion.div>
                                ))}
                            </div>
                          </div>

                          {/* Record event */}
                          <div className="card border border-primary-100 dark:border-primary-800">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Zaznamenat událost</h3>
                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Typ události</label>
                                <select
                                  value={recordType}
                                  onChange={(e) => setRecordType(e.target.value)}
                                  className="input"
                                >
                                  {BEHAVIOR_TYPES.map((t) => (
                                    <option key={t} value={t}>{BEHAVIOR_TYPE_LABELS[t]}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Poznámka (volitelně)</label>
                                <input
                                  type="text"
                                  value={recordNote}
                                  onChange={(e) => setRecordNote(e.target.value)}
                                  className="input"
                                  placeholder="Doplňující info…"
                                />
                              </div>
                              <motion.button
                                onClick={handleRecord}
                                disabled={saving}
                                className="btn-primary w-full"
                                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                              >
                                {saving ? "Ukládám…" : "Zaznamenat"}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>

                {/* System Health Panel */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
                  className="card mt-8"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Server size={18} className="text-gray-500 dark:text-gray-400" />
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100">System Health</h2>
                    </div>
                    <motion.button
                      onClick={() => mutateHealth()}
                      className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-gray-600 dark:hover:text-gray-200"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      <RefreshCw size={12} /> Obnovit
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {healthDetail && (
                      <motion.div
                        key="health-content"
                        initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduce ? {} : { opacity: 0, y: 6 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {[
                            { icon: <Database size={16} className="text-gray-500 dark:text-gray-400 mx-auto mb-1" />, value: `${healthDetail.dbSize ?? 0} MB`, label: "Velikost DB" },
                            { icon: <Activity size={16} className="text-primary-400 mx-auto mb-1" />, value: healthDetail.tableStats?.users ?? 0, label: "Uživatelů" },
                            { icon: <Clock size={16} className="text-blue-400 mx-auto mb-1" />, value: healthDetail.tableStats?.appointments ?? 0, label: "Rezervací" },
                            { icon: <AlertTriangle size={16} className={`mx-auto mb-1 ${(healthDetail.pendingReminders ?? 0) > 0 ? "text-yellow-500" : "text-gray-300 dark:text-gray-400"}`} />, value: healthDetail.pendingReminders ?? 0, label: "Připomínek 24h" },
                          ].map((item, i) => (
                            <motion.div
                              key={item.label}
                              initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center"
                            >
                              {item.icon}
                              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{item.value}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                            </motion.div>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${healthDetail.status === "ok" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}`}>
                            {healthDetail.status === "ok" ? "● OK" : "● Degraded"}
                          </span>
                          <span>DB latence: {healthDetail.db?.latencyMs ?? "?"}ms</span>
                          <span>Uptime: {Math.floor((healthDetail.uptime ?? 0) / 60)} min</span>
                          <span>Verze: {healthDetail.version}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!healthDetail && <p className="text-xs text-gray-500 dark:text-gray-400">Načítám health data…</p>}
                </motion.div>

                {/* Auto-Processor Panel */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
                  className="card"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="text-blue-500" size={20} />
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Auto-Processor</h2>
                    </div>
                    <motion.button
                      onClick={handleRunUnjustifiedCancels}
                      disabled={processorRunning}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      <RefreshCw size={14} className={processorRunning ? "animate-spin" : ""} />
                      {processorRunning ? "Zpracovávám…" : "Spustit nyní"}
                    </motion.button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Označí prošlé rezervace jako Neoprávněné storno (penalty −20 bodů) a faktury po splatnosti jako Overdue.
                  </p>
                  <AnimatePresence>
                    {processorStatus?.unjustifiedCancelProcessor && (
                      <motion.div
                        key="processor-status"
                        initial={shouldReduce ? {} : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduce ? {} : { opacity: 0, y: 4 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs space-y-1"
                      >
                        <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Poslední spuštění:</span> {new Date(processorStatus.unjustifiedCancelProcessor.ranAt).toLocaleString("cs-CZ")}</p>
                        <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Nalezeno:</span> {processorStatus.unjustifiedCancelProcessor.found} rezervací</p>
                        <p className="text-gray-700 dark:text-gray-300"><span className="font-medium">Zpracováno:</span> {processorStatus.unjustifiedCancelProcessor.processed}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!processorStatus?.unjustifiedCancelProcessor && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Zatím nebylo spuštěno.</p>
                  )}
                </motion.div>

                {/* Employee Ratings Panel */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.25 }}
                  className="card"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="text-yellow-500" size={20} />
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Hodnocení terapeutů</h2>
                  </div>
                  {!ratingsSummary && <p className="text-sm text-gray-500 dark:text-gray-400">Načítám…</p>}
                  {ratingsSummary && ratingsSummary.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Žádná hodnocení zatím nebyla přidána.</p>
                  )}
                  {ratingsSummary && ratingsSummary.length > 0 && (
                    <div className="space-y-2">
                      {ratingsSummary.map((r: any, i: number) => (
                        <motion.div
                          key={r.employee_id}
                          initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                          className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-5">{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.employee_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{r.total_ratings} hodnocení</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span key={s} className={s <= Math.round(r.avg_rating) ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}>★</span>
                            ))}
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">{r.avg_rating}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Client timeline for selected client */}
                <AnimatePresence>
                  {selectedClient && (
                    <motion.div
                      key="client-timeline"
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="card"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <MessageSquare className="text-blue-500" size={20} />
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Časová osa klienta</h2>
                      </div>
                      <ClientTimeline clientId={selectedClient} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
