"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Clock, Plus, Trash2, Bell } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Čeká na termín",
  NOTIFIED: "Volný termín dostupný!",
  BOOKED: "Rezervováno",
  CANCELLED: "Zrušeno",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: "badge-yellow",
  NOTIFIED: "badge-green",
  BOOKED: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export default function ClientWaitlist() {
  const shouldReduce = useReducedMotion();
  const { data: waitlist, mutate } = useSWR<any[]>("/waitlist", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);
  const { data: employees } = useSWR<any[]>("/employees", fetcher as any);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ serviceId: "", employeeId: "" });
  const [saving, setSaving] = useState(false);

  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  const active = (waitlist ?? []).filter((w: any) => w.status !== "CANCELLED");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/waitlist", {
        serviceId: parseInt(form.serviceId),
        employeeId: form.employeeId ? parseInt(form.employeeId) : undefined,
      });
      setShowAdd(false);
      setForm({ serviceId: "", employeeId: "" });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Odebrat ze seznamu čekatelů?")) return;
    await api.delete(`/waitlist/${id}`);
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Waitlist</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Zařaďte se do fronty — upozorníme vás, jakmile se uvolní termín
              </p>
            </div>
            <motion.button
              onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Plus size={16} /> Přidat se
            </motion.button>
          </motion.div>

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                key="add-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-6 border border-primary-200 dark:border-primary-800"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Přidat do waitlistu</h2>
                <form onSubmit={handleAdd} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Služba</label>
                    <select
                      required
                      value={form.serviceId}
                      onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      {(services ?? []).filter((s: any) => s.isActive).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Preferovaný terapeut (volitelně)</label>
                    <select
                      value={form.employeeId}
                      onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- kdokoliv --</option>
                      {(employees ?? []).map((e: any) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="btn-secondary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      Zrušit
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={saving}
                      className="btn-primary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      {saving ? "Ukládám…" : "Přidat"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          <AnimatePresence>
            {active.length === 0 && !showAdd && (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
              >
                <EmptyState
                  icon={<Clock size={40} />}
                  title="Nejste na žádném waitlistu"
                  description="Přidejte se a my vám napíšeme, jakmile se uvolní místo"
                  action={
                    <motion.button
                      onClick={() => setShowAdd(true)}
                      className="btn-primary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      Přidat se na waitlist
                    </motion.button>
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Waitlist items */}
          <div className="space-y-3">
            {active.map((w: any, i: number) => (
              <motion.div
                key={w.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.08 + i * 0.04 }}
                className={`card ${w.status === "NOTIFIED" ? "border border-green-300 dark:border-green-700" : ""}`}
              >
                {/* NOTIFIED banner */}
                <AnimatePresence>
                  {w.status === "NOTIFIED" && (
                    <motion.div
                      key="notified-banner"
                      initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-3 flex items-center gap-2"
                    >
                      <motion.span
                        animate={shouldReduce ? {} : { scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                      >
                        <Bell size={16} className="text-green-600 dark:text-green-400" />
                      </motion.span>
                      <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                        Volný termín je dostupný! Zarezervujte si ho co nejdříve.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[w.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[w.status] ?? w.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {serviceMap[w.serviceId] ?? `Služba #${w.serviceId}`}
                    </p>
                    {w.employeeId && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Terapeut: {employeeMap[w.employeeId] ?? `#${w.employeeId}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Přidáno: {formatDate(w.createdAt)}</p>
                  </div>
                  {["WAITING", "NOTIFIED"].includes(w.status) && (
                    <motion.button
                      onClick={() => handleRemove(w.id)}
                      className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Odebrat"
                      whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                    >
                      <Trash2 size={16} />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
