"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { formatCurrency } from "@/lib/utils";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminPackagesPage() {
  const { data: packages, mutate } = useSWR<any[]>("/packages", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "", sessionsCount: 5, price: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      setError("Vyplňte název, počet sezení a cenu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingPkg) {
        await api.patch(`/packages/${editingPkg.id}`, form);
      } else {
        await api.post("/packages", form);
      }
      await mutate();
      setShowForm(false);
    } catch (e: any) {
      setError(e.message ?? "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm("Opravdu deaktivovat tento balíček?")) return;
    try {
      await api.delete(`/packages/${id}`);
      await mutate();
    } catch (e: any) {
      alert(e.message ?? "Chyba");
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Balíčky sezení</h1>
            <button onClick={openAdd} className="btn-primary">+ Přidat balíček</button>
          </div>

          {showForm && (
            <div className="card mb-6">
              <h2 className="font-semibold text-gray-800 mb-4">{editingPkg ? "Upravit balíček" : "Nový balíček"}</h2>
              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
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
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? "Ukládám…" : "Uložit"}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-secondary">Zrušit</button>
              </div>
            </div>
          )}

          {packages === undefined ? (
            <p className="text-gray-400 text-sm">Načítám…</p>
          ) : packages.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-400">Žádné aktivní balíčky. Vytvořte první balíček.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="card flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{pkg.name}</p>
                    {pkg.description && <p className="text-sm text-gray-500 mt-0.5">{pkg.description}</p>}
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-600">
                        {pkg.sessionsCount ?? pkg.sessions_count} sezení
                      </span>
                      <span className="text-sm font-medium text-primary-600">
                        {formatCurrency(pkg.price)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(pkg)}
                      className="btn-secondary text-sm"
                    >
                      Upravit
                    </button>
                    <button
                      onClick={() => handleDeactivate(pkg.id)}
                      className="text-sm px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Deaktivovat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
