"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Edit2, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

export default function AdminProcedures() {
  const shouldReduce = useReducedMotion();
  const { data: procedures, mutate } = useSWR("/insurance/procedures", fetcher);
  const { data: services } = useSWR("/services", fetcher);
  const { data: mapping, mutate: mutateMapping } = useSWR("/insurance/procedure-mapping", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", points: "0", pointPrice: "1.0", maxPerDay: "", maxPerMonth: "" });
  const [saving, setSaving] = useState(false);
  const [mappingServiceId, setMappingServiceId] = useState("");
  const [mappingProcedureId, setMappingProcedureId] = useState("");

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", name: "", points: "0", pointPrice: "1.0", maxPerDay: "", maxPerMonth: "" });
    setShowForm(true);
  };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({ code: p.code, name: p.name, points: String(p.points), pointPrice: String(p.pointPrice), maxPerDay: p.maxPerDay ? String(p.maxPerDay) : "", maxPerMonth: p.maxPerMonth ? String(p.maxPerMonth) : "" });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        points: parseFloat(form.points),
        pointPrice: parseFloat(form.pointPrice),
        maxPerDay: form.maxPerDay ? parseInt(form.maxPerDay) : undefined,
        maxPerMonth: form.maxPerMonth ? parseInt(form.maxPerMonth) : undefined,
      };
      if (editing) {
        await api.patch(`/insurance/procedures/${editing.id}`, payload);
      } else {
        await api.post("/insurance/procedures", payload);
      }
      setShowForm(false);
      mutate();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Opravdu smazat výkon?")) return;
    await api.delete(`/insurance/procedures/${id}`);
    mutate();
  };

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingServiceId || !mappingProcedureId) return;
    await api.post("/insurance/procedure-mapping", {
      serviceId: parseInt(mappingServiceId),
      procedureId: parseInt(mappingProcedureId),
    });
    setMappingServiceId("");
    setMappingProcedureId("");
    mutateMapping();
  };

  const handleDeleteMapping = async (id: number) => {
    await api.delete(`/insurance/procedure-mapping/${id}`);
    mutateMapping();
  };

  const procedureMap = Object.fromEntries((procedures ?? []).map((p: any) => [p.id, p]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s]));

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-2"
          >
            <Link href="/admin/insurance" className="text-gray-500 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold">Výkony a kódy</h1>
          </motion.div>

          {/* Modal */}
          <AnimatePresence>
            {showForm && (
              <motion.div
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
                  className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6"
                >
                  <h2 className="text-lg font-bold mb-4">{editing ? "Upravit výkon" : "Nový výkon"}</h2>
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Kód výkonu *</label>
                        <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" required placeholder="906" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Body</label>
                        <input type="number" step="0.01" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Název výkonu *</label>
                      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Cena za bod (Kč)</label>
                        <input type="number" step="0.01" value={form.pointPrice} onChange={e => setForm({ ...form, pointPrice: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Max / den</label>
                        <input type="number" value={form.maxPerDay} onChange={e => setForm({ ...form, maxPerDay: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" placeholder="—" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Max / měsíc</label>
                        <input type="number" value={form.maxPerMonth} onChange={e => setForm({ ...form, maxPerMonth: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" placeholder="—" />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm dark:border-gray-600">Zrušit</button>
                      <motion.button
                        type="submit"
                        disabled={saving}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {saving ? "Ukládám…" : "Uložit"}
                      </motion.button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Procedures table */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <h2 className="font-semibold">Výkony dle VZP číselníku</h2>
              <motion.button
                onClick={openNew}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1"
              >
                <Plus size={14} /> Přidat výkon
              </motion.button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kód</th>
                  <th className="text-left px-4 py-3 font-medium">Název</th>
                  <th className="text-right px-4 py-3 font-medium">Body</th>
                  <th className="text-right px-4 py-3 font-medium">Kč/bod</th>
                  <th className="text-right px-4 py-3 font-medium">Cena</th>
                  <th className="text-right px-4 py-3 font-medium">Max/měs</th>
                  <th className="text-right px-4 py-3 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {(procedures ?? []).map((p: any, i: number) => (
                  <motion.tr
                    key={p.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{p.code}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3 text-right">{p.points}</td>
                    <td className="px-4 py-3 text-right">{p.pointPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium">{(p.points * p.pointPrice).toFixed(2)} Kč</td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.maxPerMonth ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <motion.button
                        onClick={() => openEdit(p)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="p-1 text-gray-500 hover:text-blue-600 rounded"
                      >
                        <Edit2 size={14} />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(p.id)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="p-1 text-gray-500 hover:text-red-600 rounded ml-1"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          {/* Service → Procedure mapping */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
          >
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h2 className="font-semibold">Mapování: Služba → Výkon pojišťovny</h2>
            </div>
            <div className="p-4">
              <form onSubmit={handleAddMapping} className="flex gap-3 items-end mb-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1 text-gray-500">Služba v systému</label>
                  <select value={mappingServiceId} onChange={e => setMappingServiceId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600">
                    <option value="">— vyberte —</option>
                    {(services ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium mb-1 text-gray-500">Kód výkonu</label>
                  <select value={mappingProcedureId} onChange={e => setMappingProcedureId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600">
                    <option value="">— vyberte —</option>
                    {(procedures ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                  </select>
                </div>
                <motion.button
                  type="submit"
                  disabled={!mappingServiceId || !mappingProcedureId}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm disabled:opacity-40 flex items-center gap-1"
                >
                  <Plus size={14} /> Přidat
                </motion.button>
              </form>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Služba</th>
                    <th className="text-left px-3 py-2 font-medium">Kód výkonu</th>
                    <th className="text-left px-3 py-2 font-medium">Název výkonu</th>
                    <th className="text-right px-3 py-2 font-medium">Akce</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-700">
                  {(mapping ?? []).map((m: any, i: number) => (
                    <motion.tr
                      key={m.id}
                      initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                    >
                      <td className="px-3 py-2">{serviceMap[m.serviceId]?.name ?? `#${m.serviceId}`}</td>
                      <td className="px-3 py-2 font-mono font-bold text-blue-600">{procedureMap[m.procedureId]?.code ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-500">{procedureMap[m.procedureId]?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <motion.button
                          onClick={() => handleDeleteMapping(m.id)}
                          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="p-1 text-gray-500 hover:text-red-600 rounded"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                  {(mapping ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">Žádná mapování</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
