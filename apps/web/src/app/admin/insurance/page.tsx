"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Edit2, Trash2, Building2, CheckCircle, XCircle, Download } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

export default function AdminInsurance() {
  const { data: companies, mutate } = useSWR("/insurance/companies", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", contactEmail: "", contactPhone: "", contractNotes: "" });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const shouldReduce = useReducedMotion();

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await api.post<{ seededCompanies: number; seededProcedures: number; skippedCompanies: number; skippedProcedures: number }>("/insurance/seed-defaults", {});
      setSeedMsg(`Přidáno ${res.seededCompanies} pojišťoven, ${res.seededProcedures} výkonů (přeskočeno ${res.skippedCompanies}/${res.skippedProcedures} duplicit)`);
      mutate();
    } catch {
      setSeedMsg("Chyba při importu výchozích dat");
    } finally {
      setSeeding(false);
    }
  };

  const openNew = () => { setEditing(null); setForm({ code: "", name: "", contactEmail: "", contactPhone: "", contractNotes: "" }); setShowForm(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ code: c.code, name: c.name, contactEmail: c.contactEmail ?? "", contactPhone: c.contactPhone ?? "", contractNotes: c.contractNotes ?? "" }); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/insurance/companies/${editing.id}`, form);
      } else {
        await api.post("/insurance/companies", form);
      }
      setShowForm(false);
      mutate();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Opravdu smazat pojišťovnu?")) return;
    await api.delete(`/insurance/companies/${id}`);
    mutate();
  };

  const handleToggle = async (c: any) => {
    await api.patch(`/insurance/companies/${c.id}`, { isActive: !c.isActive });
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="p-6 max-w-5xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex flex-wrap items-start justify-between gap-3 mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 size={24} /> Pojišťovny
              </h1>
              <p className="text-sm text-gray-500 mt-1">Správa zdravotních pojišťoven</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <motion.button
                onClick={handleSeedDefaults}
                disabled={seeding}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Download size={16} /> {seeding ? "Importuji…" : "Importovat výchozí kódy ČR"}
              </motion.button>
              <Link href="/admin/insurance/procedures" className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Výkony a kódy
              </Link>
              <Link href="/admin/insurance/billing" className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Fakturace
              </Link>
              <motion.button
                onClick={openNew}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
              >
                <Plus size={16} /> Přidat pojišťovnu
              </motion.button>
            </div>
            <AnimatePresence>
              {seedMsg && (
                <motion.p
                  initial={shouldReduce ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="w-full text-sm text-green-600 dark:text-green-400"
                >
                  {seedMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

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
                  <h2 className="text-lg font-bold mb-4">{editing ? "Upravit pojišťovnu" : "Nová pojišťovna"}</h2>
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Kód pojišťovny *</label>
                        <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" required placeholder="111" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Název *</label>
                        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" required placeholder="VZP ČR" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Kontaktní email</label>
                      <input value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" placeholder="smlouvy@vzp.cz" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Kontaktní telefon</label>
                      <input value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" placeholder="+420 222 111 111" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Smluvní podmínky / poznámka</label>
                      <textarea value={form.contractNotes} onChange={e => setForm({ ...form, contractNotes: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
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

          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Kód</th>
                  <th className="text-left px-4 py-3 font-medium">Název</th>
                  <th className="text-left px-4 py-3 font-medium">Kontakt</th>
                  <th className="text-left px-4 py-3 font-medium">Stav</th>
                  <th className="text-right px-4 py-3 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {(companies ?? []).map((c: any, i: number) => (
                  <motion.tr
                    key={c.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{c.code}</td>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.contactEmail && <div>{c.contactEmail}</div>}
                      {c.contactPhone && <div>{c.contactPhone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <motion.button
                        onClick={() => handleToggle(c)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700"}`}
                      >
                        {c.isActive ? <><CheckCircle size={12} /> Aktivní</> : <><XCircle size={12} /> Neaktivní</>}
                      </motion.button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <motion.button
                        onClick={() => openEdit(c)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="p-1 text-gray-500 hover:text-blue-600 rounded"
                      >
                        <Edit2 size={15} />
                      </motion.button>
                      <motion.button
                        onClick={() => handleDelete(c.id)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="p-1 text-gray-500 hover:text-red-600 rounded ml-1"
                      >
                        <Trash2 size={15} />
                      </motion.button>
                    </td>
                  </motion.tr>
                ))}
                {(companies ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Žádné pojišťovny</td></tr>
                )}
              </tbody>
            </table>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
