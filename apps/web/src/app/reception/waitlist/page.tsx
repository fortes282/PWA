"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Clock, CheckCircle, Bell, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Čeká",
  NOTIFIED: "Upozorněn",
  BOOKED: "Rezervováno",
  CANCELLED: "Zrušeno",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: "badge-yellow",
  NOTIFIED: "bg-blue-100 text-blue-700",
  BOOKED: "badge-green",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function ReceptionWaitlist() {
  const shouldReduce = useReducedMotion();
  const { data: waitlist, mutate } = useSWR("/waitlist", fetcher);
  const { data: suggestions } = useSWR<any[]>("/waitlist/suggestions?limit=10", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);
  const { data: services } = useSWR("/services", fetcher);
  const { data: employees } = useSWR("/employees", fetcher);

  const [filterStatus, setFilterStatus] = useState<string>("WAITING");
  const [activeTab, setActiveTab] = useState<"list" | "suggestions">("list");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientId: "", serviceId: "", employeeId: "" });
  const [saving, setSaving] = useState(false);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  const filtered = (waitlist ?? []).filter((w: any) =>
    filterStatus === "ALL" || w.status === filterStatus
  ).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

  const handleNotify = async (id: number) => {
    haptics.medium();
    try {
      await api.post(`/waitlist/${id}/notify`, {});
    } catch {
      await api.patch(`/waitlist/${id}`, { status: "NOTIFIED" });
    }
    mutate();
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Zrušit waitlist záznam?")) return;
    haptics.medium();
    await api.delete(`/waitlist/${id}`);
    mutate();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/waitlist", {
        clientId: parseInt(form.clientId),
        serviceId: parseInt(form.serviceId),
        employeeId: form.employeeId ? parseInt(form.employeeId) : undefined,
      });
      haptics.success();
      setShowAdd(false);
      setForm({ clientId: "", serviceId: "", employeeId: "" });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const waitingCount = (waitlist ?? []).filter((w: any) => w.status === "WAITING").length;

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Waitlist</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{waitingCount} čeká na volnou rezervaci</p>
            </div>
            <motion.button
              onClick={() => { haptics.light(); setShowAdd(true); }}
              whileTap={shouldReduce ? undefined : { scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary flex items-center gap-2"
            >
              <Clock size={16} /> Přidat do waitlistu
            </motion.button>
          </div>

          {/* Add form */}
          <AnimatePresence initial={false}>
            {showAdd && (
              <motion.div
                key="add-form"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.97, y: -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border border-primary-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nový waitlist záznam</h2>
                  <motion.button
                    type="button"
                    onClick={() => { haptics.light(); setShowAdd(false); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="text-gray-500 hover:text-gray-600"
                  >
                    <X size={18} />
                  </motion.button>
                </div>
                <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Klient</label>
                    <select
                      required
                      value={form.clientId}
                      onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      {clients?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Služba</label>
                    <select
                      required
                      value={form.serviceId}
                      onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      {services?.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Preferovaný terapeut (volitelně)</label>
                    <select
                      value={form.employeeId}
                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- kdokoliv --</option>
                      {employees?.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex gap-3 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => { haptics.light(); setShowAdd(false); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary"
                    >
                      Zrušit
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={saving}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary disabled:opacity-50"
                    >
                      {saving ? "Ukládám…" : "Přidat"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main tab navigation */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {(["list", "suggestions"] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => { haptics.light(); setActiveTab(tab); }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
              >
                {tab === "list" ? "Seznam" : (
                  <>
                    Návrhy{(suggestions ?? []).length > 0 && <span className="ml-1 text-xs bg-primary-100 text-primary-700 rounded-full px-1">{(suggestions ?? []).length}</span>}
                  </>
                )}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Suggestions panel */}
            {activeTab === "suggestions" && (
              <motion.div
                key="tab-suggestions"
                initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <div className="card mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Klienti čekající nejdéle</h2>
                  {(suggestions ?? []).length === 0 ? (
                    <EmptyState title="Žádní klienti ve waitlistu" />
                  ) : (
                    <div className="space-y-3">
                      {(suggestions ?? []).map((w: any, i: number) => (
                        <motion.div
                          key={w.id}
                          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{w.clientName ?? `Klient #${w.clientId}`}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {w.clientEmail} {w.clientPhone ? `· ${w.clientPhone}` : ""}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ve waitlistu od: {formatDate(w.createdAt)}</p>
                          </div>
                          <motion.button
                            onClick={() => handleNotify(w.id)}
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className="btn-primary text-xs py-1 flex items-center gap-1"
                          >
                            <Bell size={12} /> Upozornit
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* List panel */}
            {activeTab === "list" && (
              <motion.div
                key="tab-list"
                initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                {/* Filter tabs */}
                <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
                  {["ALL", "WAITING", "NOTIFIED", "BOOKED"].map((s) => (
                    <motion.button
                      key={s}
                      onClick={() => { haptics.light(); setFilterStatus(s); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        filterStatus === s
                          ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                    >
                      {s === "ALL" ? "Vše" : STATUS_LABELS[s]}
                    </motion.button>
                  ))}
                </div>

                <div className="space-y-3">
                  <AnimatePresence>
                    {filtered.length === 0 && (
                      <motion.div
                        key="empty"
                        initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ type: "spring", stiffness: 340, damping: 28 }}
                      >
                        <EmptyState title="Žádné záznamy" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {filtered.map((w: any, i: number) => (
                    <motion.div
                      key={w.id}
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                      layout
                      className="card"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`badge ${STATUS_COLORS[w.status] ?? "badge-yellow"}`}>
                              {STATUS_LABELS[w.status] ?? w.status}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">
                            {clientMap[w.clientId] ?? `Klient #${w.clientId}`}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {serviceMap[w.serviceId] ?? `Služba #${w.serviceId}`}
                            {w.employeeId ? ` · ${employeeMap[w.employeeId] ?? `Terapeut #${w.employeeId}`}` : ""}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Přidáno: {formatDate(w.createdAt)}
                            {w.notifiedAt ? ` · Upozorněn: ${formatDate(w.notifiedAt)}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {w.status === "WAITING" && (
                            <motion.button
                              onClick={() => handleNotify(w.id)}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="btn-primary text-xs py-1 flex items-center gap-1"
                            >
                              <Bell size={12} /> Upozornit
                            </motion.button>
                          )}
                          {w.status === "NOTIFIED" && (
                            <motion.button
                              onClick={() => { haptics.medium(); api.patch(`/waitlist/${w.id}`, { status: "BOOKED" }).then(() => mutate()); }}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="btn-secondary text-xs py-1 flex items-center gap-1"
                            >
                              <CheckCircle size={12} /> Rezervováno
                            </motion.button>
                          )}
                          {["WAITING", "NOTIFIED"].includes(w.status) && (
                            <motion.button
                              onClick={() => handleCancel(w.id)}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200"
                            >
                              Zrušit
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
