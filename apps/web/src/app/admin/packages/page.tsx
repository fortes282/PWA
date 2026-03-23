"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminPackagesPage() {
  const shouldReduce = useReducedMotion();
  const { data: packages, mutate } = useSWR<any[]>("/packages", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", sessionsCount: 5, price: 0 });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const openAdd = () => {
    setEditingPkg(null);
    setForm({ name: "", description: "", sessionsCount: 5, price: 0 });
    setShowForm(true);
  };

  const openEdit = (pkg: any) => {
    setEditingPkg(pkg);
    setForm({ name: pkg.name, description: pkg.description ?? "", sessionsCount: pkg.sessionsCount ?? pkg.sessions_count, price: pkg.price });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.sessionsCount || form.price == null) {
      toast("error", "Vyplňte název, počet sezení a cenu.");
      return;
    }
    setSaving(true);
    try {
      if (editingPkg) {
        await api.patch(`/packages/${editingPkg.id}`, form);
        toast("success", "Balíček byl upraven.");
      } else {
        await api.post("/packages", form);
        toast("success", "Balíček byl vytvořen.");
      }
      await mutate();
      setShowForm(false);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Opravdu deaktivovat tento balíček?")) return;
    try {
      await api.delete(`/packages/${id}`);
      toast("success", "Balíček byl deaktivován.");
      await mutate();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Balíčky sezení</h1>
            <motion.button
              onClick={openAdd}
              className="btn-primary"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              + Přidat balíček
            </motion.button>
          </motion.div>

          <AnimatePresence>
            {showForm && (
              <motion.div
                key="pkg-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-6"
              >
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">{editingPkg ? "Upravit balíček" : "Nový balíček"}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Název *</label>
                    <input
                      className="input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Startovací balíček"
                    />
                  </div>
                  <div>
                    <label className="label">Počet sezení *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.sessionsCount}
                      min={1}
                      onChange={(e) => setForm({ ...form, sessionsCount: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="label">Cena (Kč) *</label>
                    <input
                      type="number"
                      className="input"
                      value={form.price}
                      min={0}
                      onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="label">Popis</label>
                    <input
                      className="input"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Volitelný popis"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <motion.button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {saving ? "Ukládám…" : "Uložit"}
                  </motion.button>
                  <motion.button
                    onClick={() => setShowForm(false)}
                    className="btn-secondary"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    Zrušit
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {packages === undefined ? (
            <motion.p
              initial={shouldReduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-500 dark:text-gray-400 text-sm"
            >
              Načítám…
            </motion.p>
          ) : packages.length === 0 ? (
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className="card text-center py-8"
            >
              <p className="text-gray-500 dark:text-gray-400">Žádné aktivní balíčky. Vytvořte první balíček.</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg, i) => (
                <motion.div
                  key={pkg.id}
                  initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                  className="card flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{pkg.name}</p>
                    {pkg.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{pkg.description}</p>}
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {pkg.sessionsCount ?? pkg.sessions_count} sezení
                      </span>
                      <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                        {formatCurrency(pkg.price)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => openEdit(pkg)}
                      className="btn-secondary text-sm"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      Upravit
                    </motion.button>
                    <motion.button
                      onClick={() => handleDeactivate(pkg.id)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      Deaktivovat
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
