"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Edit2, Trash2, Building2, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

export default function AdminInsurance() {
  const { data: companies, mutate } = useSWR("/insurance/companies", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", contactEmail: "", contactPhone: "", contractNotes: "" });
  const [saving, setSaving] = useState(false);

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 size={24} /> Pojišťovny
              </h1>
              <p className="text-sm text-gray-500 mt-1">Správa zdravotních pojišťoven</p>
            </div>
            <div className="flex gap-2">
              <Link href="/admin/insurance/procedures" className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Výkony a kódy
              </Link>
              <Link href="/admin/insurance/billing" className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700">
                Fakturace
              </Link>
              <button onClick={openNew} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1">
                <Plus size={16} /> Přidat pojišťovnu
              </button>
            </div>
          </div>

          {showForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6">
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
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                      {saving ? "Ukládám…" : "Uložit"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
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
                {(companies ?? []).map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{c.code}</td>
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.contactEmail && <div>{c.contactEmail}</div>}
                      {c.contactPhone && <div>{c.contactPhone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(c)} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700"}`}>
                        {c.isActive ? <><CheckCircle size={12} /> Aktivní</> : <><XCircle size={12} /> Neaktivní</>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(c)} className="p-1 text-gray-500 hover:text-blue-600 rounded"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-500 hover:text-red-600 rounded ml-1"><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
                {(companies ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Žádné pojišťovny</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
