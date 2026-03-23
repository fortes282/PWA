"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Users, CheckCircle, XCircle, Flag, Plus, Lock, Unlock, X } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any>(url);

const CATEGORY_OPTIONS = [
  { value: "cmp", label: "Po CMP" },
  { value: "tbi", label: "TBI" },
  { value: "ms", label: "Roztroušená skleróza" },
  { value: "general", label: "Obecná podpora" },
  { value: "family", label: "Rodinní příslušníci" },
];

export default function EmployeeGroups() {
  const shouldReduce = useReducedMotion();
  const { data: groups, mutate: mutateGroups } = useSWR("/groups/moderated", fetcher);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [tab, setTab] = useState<"pending" | "reports" | "topics">("pending");
  const { data: pending, mutate: mutatePending } = useSWR(
    selectedGroup ? `/groups/${selectedGroup.id}/pending` : null,
    fetcher
  );
  const { data: reports, mutate: mutateReports } = useSWR(
    selectedGroup ? `/groups/${selectedGroup.id}/reports` : null,
    fetcher
  );
  const { data: topics, mutate: mutateTopics } = useSWR(
    selectedGroup ? `/groups/${selectedGroup.id}/topics` : null,
    fetcher
  );

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "general", maxMembers: 20, rules: "" });
  const { toast } = useToast();

  const handleMembership = async (membershipId: number, status: "approved" | "rejected") => {
    if (!selectedGroup) return;
    haptics.medium();
    try {
      await api.patch(`/groups/${selectedGroup.id}/members/${membershipId}`, { status });
      toast("success", status === "approved" ? "Žádost schválena." : "Žádost zamítnuta.");
      mutatePending();
      mutateGroups();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleResolveReport = async (reportId: number) => {
    if (!selectedGroup) return;
    haptics.medium();
    try {
      await api.patch(`/groups/${selectedGroup.id}/reports/${reportId}`, {});
      toast("success", "Nahlášení vyřešeno.");
      mutateReports();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleToggleLock = async (topic: any) => {
    if (!selectedGroup) return;
    haptics.medium();
    try {
      await api.patch(`/groups/${selectedGroup.id}/topics/${topic.id}`, { isLocked: !topic.is_locked });
      toast("success", topic.is_locked ? "Téma odemčeno." : "Téma uzamčeno.");
      mutateTopics();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleCreateGroup = async () => {
    try {
      await api.post("/groups", form);
      haptics.success();
      toast("success", "Skupina byla vytvořena.");
      mutateGroups();
      setCreating(false);
      setForm({ name: "", description: "", category: "general", maxMembers: 20, rules: "" });
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={28} className="text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skupiny podpory</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Moderátorský přehled</p>
              </div>
            </div>
            <motion.button
              onClick={() => { haptics.light(); setCreating(true); }}
              whileTap={shouldReduce ? undefined : { scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn btn-primary flex items-center gap-2"
            >
              <Plus size={16} /> Nová skupina
            </motion.button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Groups sidebar */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Moje skupiny</h2>
              <div
                className="space-y-2"
              >
                {(groups ?? []).map((g: any, i: number) => (
                  <motion.button
                    key={g.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                    onClick={() => { haptics.light(); setSelectedGroup(g); setTab("pending"); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    className={`w-full text-left card transition-all ${selectedGroup?.id === g.id ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20" : "hover:border-gray-300 dark:hover:border-gray-600"}`}
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">{g.name}</div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{g.member_count} členů</span>
                      {g.pending_count > 0 && (
                        <span className="text-yellow-600 font-medium">{g.pending_count} čeká</span>
                      )}
                      {g.report_count > 0 && (
                        <span className="text-red-600 font-medium">{g.report_count} hlášení</span>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
              {(!groups || groups.length === 0) && (
                <motion.div
                  initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="card text-sm text-gray-500 dark:text-gray-400 text-center py-4"
                >
                  Nemáte žádné skupiny
                </motion.div>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence mode="wait">
                {!selectedGroup ? (
                  <motion.div
                    key="no-selection"
                    initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                    className="card text-center py-12 text-gray-500 dark:text-gray-400"
                  >
                    Vyberte skupinu vlevo
                  </motion.div>
                ) : (
                  <motion.div
                    key={selectedGroup.id}
                    initial={shouldReduce ? false : { opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                    className="space-y-4"
                  >
                    <div className="card">
                      <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{selectedGroup.name}</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedGroup.description}</p>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                      {(["pending", "reports", "topics"] as const).map((t) => (
                        <motion.button
                          key={t}
                          onClick={() => { haptics.light(); setTab(t); }}
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className={`flex-1 text-sm py-1.5 rounded-md transition-all ${tab === t ? "bg-white dark:bg-gray-800 font-semibold shadow" : "text-gray-500"}`}
                        >
                          {t === "pending" ? `Žádosti (${(pending ?? []).length})` : t === "reports" ? `Hlášení (${(reports ?? []).length})` : "Vlákna"}
                        </motion.button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <AnimatePresence mode="wait">
                      {tab === "pending" && (
                        <motion.div
                          key="tab-pending"
                          initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="space-y-2"
                        >
                          {(pending ?? []).length === 0 && (
                            <div className="card text-sm text-gray-500 dark:text-gray-400 text-center py-4">Žádné čekající žádosti</div>
                          )}
                          <div
                            className="space-y-2"
                          >
                            {(pending ?? []).map((m: any, i: number) => (
                              <motion.div
                                key={m.id}
                                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                                className="card flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{m.name}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{m.email} · {new Date(m.created_at).toLocaleDateString("cs-CZ")}</div>
                                  {m.is_anonymous ? <span className="text-xs badge badge-gray">Chce anonymně</span> : null}
                                </div>
                                <div className="flex gap-2">
                                  <motion.button
                                    onClick={() => handleMembership(m.id, "approved")}
                                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                    className="btn btn-sm btn-success"
                                    title="Schválit"
                                  >
                                    <CheckCircle size={16} />
                                  </motion.button>
                                  <motion.button
                                    onClick={() => handleMembership(m.id, "rejected")}
                                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                    className="btn btn-sm btn-danger"
                                    title="Zamítnout"
                                  >
                                    <XCircle size={16} />
                                  </motion.button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {tab === "reports" && (
                        <motion.div
                          key="tab-reports"
                          initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="space-y-2"
                        >
                          {(reports ?? []).length === 0 && (
                            <div className="card text-sm text-gray-500 dark:text-gray-400 text-center py-4">Žádná otevřená hlášení</div>
                          )}
                          <div
                            className="space-y-2"
                          >
                            {(reports ?? []).map((r: any, i: number) => (
                              <motion.div
                                key={r.id}
                                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                                className="card space-y-2"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                                      <Flag size={12} /> Hlášení od: {r.reporter_name}
                                    </span>
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{r.reason}</p>
                                  </div>
                                  <motion.button
                                    onClick={() => handleResolveReport(r.id)}
                                    whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                    className="btn btn-sm btn-secondary"
                                  >
                                    Vyřešit
                                  </motion.button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                                  {r.post_content}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Vlákno: {r.topic_title}</div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {tab === "topics" && (
                        <motion.div
                          key="tab-topics"
                          initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="space-y-2"
                        >
                          {(topics ?? []).length === 0 && (
                            <div className="card text-sm text-gray-500 dark:text-gray-400 text-center py-4">Žádná vlákna</div>
                          )}
                          <div
                            className="space-y-2"
                          >
                            {(topics ?? []).map((t: any, i: number) => (
                              <motion.div
                                key={t.id}
                                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                                className="card flex justify-between items-center"
                              >
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{t.title}</div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{t.post_count} příspěvků · {t.author_name}</div>
                                </div>
                                <motion.button
                                  onClick={() => handleToggleLock(t)}
                                  whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                  className={`btn btn-sm ${t.is_locked ? "btn-secondary" : "btn-warning"}`}
                                  title={t.is_locked ? "Odemknout" : "Zamknout"}
                                >
                                  <AnimatePresence mode="wait" initial={false}>
                                    {t.is_locked ? (
                                      <motion.span
                                        key="unlock"
                                        initial={{ rotate: -45, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 45, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                      >
                                        <Unlock size={14} />
                                      </motion.span>
                                    ) : (
                                      <motion.span
                                        key="lock"
                                        initial={{ rotate: 45, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: -45, opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                      >
                                        <Lock size={14} />
                                      </motion.span>
                                    )}
                                  </AnimatePresence>
                                </motion.button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Create group modal */}
        <AnimatePresence>
          {creating && (
            <motion.div
              key="modal-backdrop"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={(e) => { if (e.target === e.currentTarget) { haptics.light(); setCreating(false); } }}
            >
              <motion.div
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 16 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nová skupina podpory</h2>
                  <motion.button
                    onClick={() => { haptics.light(); setCreating(false); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={18} />
                  </motion.button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Název skupiny *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input w-full"
                      placeholder="Název skupiny"
                    />
                  </div>
                  <div>
                    <label className="label">Popis</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="input w-full"
                      rows={2}
                      placeholder="Krátký popis skupiny"
                    />
                  </div>
                  <div>
                    <label className="label">Kategorie *</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="input w-full"
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Max. počet členů</label>
                    <input
                      type="number"
                      value={form.maxMembers}
                      onChange={(e) => setForm({ ...form, maxMembers: parseInt(e.target.value) || 20 })}
                      className="input w-full"
                      min={2}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className="label">Pravidla skupiny (zobrazeny při vstupu)</label>
                    <textarea
                      value={form.rules}
                      onChange={(e) => setForm({ ...form, rules: e.target.value })}
                      className="input w-full"
                      rows={3}
                      placeholder="Zapište pravidla skupiny, se kterými musí klient souhlasit..."
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    onClick={handleCreateGroup}
                    disabled={!form.name}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn btn-primary flex-1 disabled:opacity-50"
                  >
                    Vytvořit skupinu
                  </motion.button>
                  <motion.button
                    onClick={() => { haptics.light(); setCreating(false); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn btn-secondary"
                  >
                    Zrušit
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
