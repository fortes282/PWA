"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function AdminServices() {
  const { data: services, mutate } = useSWR("/services", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [duration, setDuration] = useState("60");
  const [price, setPrice] = useState("0");
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setName(""); setDesc(""); setDuration("60"); setPrice("0"); setShowForm(true); };
  const openEdit = (s: any) => { setEditing(s); setName(s.name); setDesc(s.description ?? ""); setDuration(String(s.durationMin)); setPrice(String(s.price)); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { name, description: desc || undefined, durationMin: parseInt(duration), price: parseFloat(price) };
      if (editing) {
        await api.patch(`/services/${editing.id}`, data);
      } else {
        await api.post("/services", data);
      }
      setShowForm(false);
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Smazat službu?")) return;
    await api.delete(`/services/${id}`);
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Služby</h1>
            <button onClick={openNew} className="btn-primary flex items-center gap-2"><Plus size={16} />Přidat</button>
          </div>

          {showForm && (
            <form onSubmit={handleSave} className="card mb-6 space-y-4">
              <h2 className="font-semibold">{editing ? "Upravit službu" : "Nová služba"}</h2>
              <div><label className="label">Název</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
              <div><label className="label">Popis</label><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Délka (min)</label><input type="number" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} min="5" required /></div>
                <div><label className="label">Cena (CZK)</label><input type="number" className="input" value={price} onChange={(e) => setPrice(e.target.value)} min="0" required /></div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Ukládám…" : "Uložit"}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Zrušit</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {services?.map((s: any) => (
              <div key={s.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-gray-400">{s.durationMin} min · {formatCurrency(s.price)}</p>
                  {s.description && <p className="text-xs text-gray-400 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="p-2 text-gray-400 hover:text-gray-600"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(s.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
