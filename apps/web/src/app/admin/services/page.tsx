"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any[]>(url);

export default function AdminServices() {
  const shouldReduce = useReducedMotion();
  const { toast } = useToast();
  const { data: services, mutate } = useSWR("/services?includeInactive=true", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("0");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    const list = [...(services ?? [])];
    list.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), "cs");
    });
    return list;
  }, [services]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setDesc("");
    setDuration("60");
    setPrice("0");
    setCategory("");
    setShowForm(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setName(s.name);
    setDesc(s.description ?? "");
    setDuration(String(s.durationMin));
    setPrice(String(s.price));
    setCategory(s.category ?? "");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationMin = Number.parseInt(duration, 10);
    const priceNum = Number.parseFloat(price.replace(",", "."));
    if (!name.trim() || Number.isNaN(durationMin) || durationMin < 5 || Number.isNaN(priceNum) || priceNum < 0) {
      toast("error", "Zkontrolujte název, délku (min. 5 min) a cenu.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: desc.trim() || undefined,
        durationMin,
        price: priceNum,
        category: category.trim() || null,
      };
      if (editing) {
        await api.patch(`/services/${editing.id}`, data);
        toast("success", "Služba byla uložena.");
      } else {
        await api.post("/services", data);
        toast("success", "Služba byla vytvořena.");
      }
      setShowForm(false);
      await mutate();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Uložení se nezdařilo.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Skrýt službu z nabídky? U minulých rezervací a statistik zůstane záznam.")) return;
    try {
      await api.delete(`/services/${id}`);
      toast("success", "Služba je deaktivovaná (skrytá z nabídky).");
      await mutate();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Deaktivace se nezdařila.");
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await api.patch(`/services/${id}`, { isActive: true });
      toast("success", "Služba je znovu aktivní v nabídce.");
      await mutate();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Obnovení se nezdařilo.");
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Služby</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Úpravy se projeví v rezervacích; statistiky a historie zůstávají u starých záznamů.
              </p>
            </div>
            <motion.button
              onClick={openNew}
              className="btn-primary flex items-center gap-2 shrink-0"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Plus size={16} />Přidat
            </motion.button>
          </motion.div>

          <AnimatePresence>
            {showForm && (
              <motion.form
                key="service-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                onSubmit={handleSave}
                className="card mb-6 space-y-4"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{editing ? "Upravit službu" : "Nová služba"}</h2>
                <div><label className="label">Název</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                <div><label className="label">Popis</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Délka (min)</label><input type="number" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" required /></div>
                  <div><label className="label">Cena (CZK)</label><input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.01" required /></div>
                </div>
                <div><label className="label">Kategorie</label><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Např. Masáže, Rehabilitace…" /></div>
                <div className="flex gap-3">
                  <motion.button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {saving ? "Ukládám…" : "Uložit"}
                  </motion.button>
                  <motion.button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowForm(false)}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    Zrušit
                  </motion.button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {sorted.map((s: any, i: number) => (
              <motion.div
                key={s.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                animate={{ opacity: s.isActive ? 1 : 0.75, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                className={`card flex items-center justify-between gap-3 ${!s.isActive ? "border-dashed border-gray-300 dark:border-gray-600" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
                    {!s.isActive && (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-0.5 rounded shrink-0">
                        Neaktivní
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{s.durationMin} min · {formatCurrency(s.price)}</p>
                  {s.category && <span className="inline-block text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded mt-0.5">{s.category}</span>}
                  {s.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{s.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <motion.button
                    type="button"
                    title="Upravit"
                    onClick={() => openEdit(s)}
                    className="p-2 text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                    whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                  >
                    <Pencil size={15} />
                  </motion.button>
                  {s.isActive ? (
                    <motion.button
                      type="button"
                      title="Skrýt z nabídky"
                      onClick={() => handleDeactivate(s.id)}
                      className="p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                      whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                    >
                      <Trash2 size={15} />
                    </motion.button>
                  ) : (
                    <motion.button
                      type="button"
                      title="Znovu aktivovat"
                      onClick={() => handleReactivate(s.id)}
                      className="p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
                      whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                    >
                      <RotateCcw size={15} />
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
