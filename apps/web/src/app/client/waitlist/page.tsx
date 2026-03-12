"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Čeká na termín",
  NOTIFIED: "Volný termín dostupný!",
  BOOKED: "Rezervováno",
  CANCELLED: "Zrušeno",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: "badge-yellow",
  NOTIFIED: "badge-green animate-pulse",
  BOOKED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default function ClientWaitlist() {
  const { data: waitlist, mutate } = useSWR<any[]>("/waitlist", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);
  const { data: employees } = useSWR<any[]>("/users?role=EMPLOYEE", fetcher as any);

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
              <p className="text-sm text-gray-400 mt-1">
                Zařaďte se do fronty — upozorníme vás, jakmile se uvolní termín
              </p>
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Přidat se
            </button>
          </div>

          {showAdd && (
            <div className="card mb-6 border border-primary-200">
              <h2 className="font-semibold text-gray-900 mb-4">Přidat do waitlistu</h2>
              <form onSubmit={handleAdd} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Služba</label>
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
                  <label className="block text-xs text-gray-500 mb-1">Preferovaný terapeut (volitelně)</label>
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
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Zrušit</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Ukládám…" : "Přidat"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {active.length === 0 && !showAdd && (
            <div className="card text-center py-12">
              <Clock size={40} className="mx-auto mb-4 text-gray-200" />
              <p className="text-gray-500 font-medium">Nejste na žádném waitlistu</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                Přidejte se a my vám napíšeme, jakmile se uvolní místo
              </p>
              <button onClick={() => setShowAdd(true)} className="btn-primary mx-auto">
                Přidat se na waitlist
              </button>
            </div>
          )}

          <div className="space-y-3">
            {active.map((w: any) => (
              <div key={w.id} className={`card ${w.status === "NOTIFIED" ? "border-green-300 border" : ""}`}>
                {w.status === "NOTIFIED" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-green-700 text-sm font-medium">
                    🎉 Volný termín je dostupný! Zarezervujte si ho co nejdříve.
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[w.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[w.status] ?? w.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {serviceMap[w.serviceId] ?? `Služba #${w.serviceId}`}
                    </p>
                    {w.employeeId && (
                      <p className="text-sm text-gray-500">
                        Terapeut: {employeeMap[w.employeeId] ?? `#${w.employeeId}`}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Přidáno: {formatDate(w.createdAt)}</p>
                  </div>
                  {["WAITING", "NOTIFIED"].includes(w.status) && (
                    <button
                      onClick={() => handleRemove(w.id)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Odebrat"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
