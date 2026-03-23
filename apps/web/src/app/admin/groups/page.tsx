"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Users, Archive, CheckCircle, Pencil } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const CATEGORY_LABELS: Record<string, string> = {
  cmp: "Po CMP",
  tbi: "TBI",
  ms: "Roztroušená skleróza",
  general: "Obecná podpora",
  family: "Rodinní příslušníci",
};

export default function AdminGroups() {
  const shouldReduce = useReducedMotion();
  const { data: groups, mutate } = useSWR("/groups/all", fetcher);
  const [editGroup, setEditGroup] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const { toast } = useToast();

  const openEdit = (g: any) => {
    setEditGroup(g);
    setEditForm({
      name: g.name,
      description: g.description ?? "",
      category: g.category,
      maxMembers: g.max_members,
      rules: g.rules ?? "",
      status: g.status,
    });
  };

  const handleSave = async () => {
    try {
      await api.patch(`/groups/${editGroup.id}`, editForm);
      toast("success", "Skupina byla uložena.");
      mutate();
      setEditGroup(null);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba při ukládání");
    }
  };

  const handleArchive = async (g: any) => {
    if (!confirm(`Opravdu archivovat skupinu "${g.name}"?`)) return;
    try {
      await api.patch(`/groups/${g.id}`, { status: g.status === "active" ? "archived" : "active" });
      toast("success", g.status === "active" ? "Skupina archivována." : "Skupina obnovena.");
      mutate();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const active = (groups ?? []).filter((g: any) => g.status === "active");
  const archived = (groups ?? []).filter((g: any) => g.status === "archived");

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3"
          >
            <Users size={28} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skupiny podpory</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Admin přehled — {active.length} aktivních, {archived.length} archivovaných</p>
            </div>
          </motion.div>

          {/* Active groups */}
          <motion.section
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
          >
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Aktivní skupiny</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500">
                    <th className="pb-2 pr-4">Název</th>
                    <th className="pb-2 pr-4">Kategorie</th>
                    <th className="pb-2 pr-4">Moderátor</th>
                    <th className="pb-2 pr-4">Členů</th>
                    <th className="pb-2 pr-4">Čeká</th>
                    <th className="pb-2">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {active.map((g: any, i: number) => (
                    <motion.tr
                      key={g.id}
                      initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.03 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">{g.name}</td>
                      <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{CATEGORY_LABELS[g.category] ?? g.category}</td>
                      <td className="py-2 pr-4 text-gray-500 dark:text-gray-400">{g.moderator_name}</td>
                      <td className="py-2 pr-4">
                        <span className="badge badge-green">{g.member_count}/{g.max_members}</span>
                      </td>
                      <td className="py-2 pr-4">
                        {g.pending_count > 0 && (
                          <span className="badge badge-yellow">{g.pending_count}</span>
                        )}
                      </td>
                      <td className="py-2 flex gap-2">
                        <motion.button
                          onClick={() => openEdit(g)}
                          className="btn btn-sm btn-secondary"
                          title="Upravit"
                          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        >
                          <Pencil size={14} />
                        </motion.button>
                        <motion.button
                          onClick={() => handleArchive(g)}
                          className="btn btn-sm btn-warning"
                          title="Archivovat"
                          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        >
                          <Archive size={14} />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                  {active.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-500 dark:text-gray-400">Žádné aktivní skupiny</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>

          {/* Archived */}
          <AnimatePresence>
            {archived.length > 0 && (
              <motion.section
                key="archived"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
              >
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Archivované skupiny</h2>
                <div className="space-y-2">
                  {archived.map((g: any, i: number) => (
                    <motion.div
                      key={g.id}
                      initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.03 }}
                      className="card flex justify-between items-center opacity-60"
                    >
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{g.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{CATEGORY_LABELS[g.category] ?? g.category}</span>
                      </div>
                      <motion.button
                        onClick={() => handleArchive(g)}
                        className="btn btn-sm btn-secondary flex items-center gap-1"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      >
                        <CheckCircle size={14} /> Obnovit
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Edit modal */}
        <AnimatePresence>
          {editGroup && (
            <motion.div
              key="edit-modal-backdrop"
              initial={shouldReduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduce ? {} : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            >
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Upravit skupinu</h2>
                <div className="space-y-3">
                  <div>
                    <label className="label">Název</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="input w-full" />
                  </div>
                  <div>
                    <label className="label">Popis</label>
                    <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="input w-full" rows={2} />
                  </div>
                  <div>
                    <label className="label">Kategorie</label>
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="input w-full">
                      {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Max. členů</label>
                    <input type="number" value={editForm.maxMembers} onChange={(e) => setEditForm({ ...editForm, maxMembers: parseInt(e.target.value) })} className="input w-full" />
                  </div>
                  <div>
                    <label className="label">Pravidla</label>
                    <textarea value={editForm.rules} onChange={(e) => setEditForm({ ...editForm, rules: e.target.value })} className="input w-full" rows={3} />
                  </div>
                  <div>
                    <label className="label">Stav</label>
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="input w-full">
                      <option value="active">Aktivní</option>
                      <option value="archived">Archivovaná</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    onClick={handleSave}
                    className="btn btn-primary flex-1"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    Uložit
                  </motion.button>
                  <motion.button
                    onClick={() => setEditGroup(null)}
                    className="btn btn-secondary"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
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
