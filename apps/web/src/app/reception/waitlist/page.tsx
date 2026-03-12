"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Clock, CheckCircle, Bell } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Čeká",
  NOTIFIED: "Upozorněn",
  BOOKED: "Rezervováno",
  CANCELLED: "Zrušeno",
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: "badge-yellow",
  NOTIFIED: "bg-blue-100 text-blue-700",
  BOOKED: "badge-green",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function ReceptionWaitlist() {
  const { data: waitlist, mutate } = useSWR("/waitlist", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
  const { data: services } = useSWR("/services", fetcher);
  const { data: employees } = useSWR("/users?role=EMPLOYEE", fetcher);

  const [filterStatus, setFilterStatus] = useState<string>("WAITING");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientId: "", serviceId: "", employeeId: "" });
  const [saving, setSaving] = useState(false);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  const filtered = (waitlist ?? []).filter((w: any) =>
    filterStatus === "ALL" || w.status === filterStatus
  ).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

  const handleNotify = async (id: number, clientId: number) => {
    // Mark as NOTIFIED and send notification
    await api.patch(`/waitlist/${id}`, { status: "NOTIFIED" });
    await api.post("/notifications", {
      userId: clientId,
      type: "WAITLIST_AVAILABLE",
      title: "Volný termín",
      message: "Uvolnil se termín odpovídající vašemu waitlistu. Přihlaste se a rezervujte.",
    });
    mutate();
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Zrušit waitlist záznam?")) return;
    await api.delete(`/waitlist/${id}`);
    mutate();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/waitlist", {
        clientId: parseInt(form.clientId),
        serviceId: parseInt(form.serviceId),
        employeeId: form.employeeId ? parseInt(form.employeeId) : undefined,
      });
      setShowAdd(false);
      setForm({ clientId: "", serviceId: "", employeeId: "" });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const waitingCount = (waitlist ?? []).filter((w: any) => w.status === "WAITING").length;

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
              <p className="text-sm text-gray-400 mt-1">{waitingCount} čeká na volný termín</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Clock size={16} /> Přidat do waitlistu
            </button>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="card mb-6 border border-primary-200">
              <h2 className="font-semibold text-gray-900 mb-4">Nový waitlist záznam</h2>
              <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Klient</label>
                  <select
                    required
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    className="input"
                  >
                    <option value="">-- vyberte --</option>
                    {clients?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Služba</label>
                  <select
                    required
                    value={form.serviceId}
                    onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                    className="input"
                  >
                    <option value="">-- vyberte --</option>
                    {services?.map((s: any) => (
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
                    {employees?.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary">Zrušit</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Ukládám…" : "Přidat"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {["ALL", "WAITING", "NOTIFIED", "BOOKED"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "ALL" ? "Vše" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Waitlist entries */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-400 py-10">Žádné záznamy</div>
            )}
            {filtered.map((w: any) => (
              <div key={w.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[w.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[w.status] ?? w.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {clientMap[w.clientId] ?? `Klient #${w.clientId}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {serviceMap[w.serviceId] ?? `Služba #${w.serviceId}`}
                      {w.employeeId ? ` · ${employeeMap[w.employeeId] ?? `Terapeut #${w.employeeId}`}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Přidáno: {formatDate(w.createdAt)}
                      {w.notifiedAt ? ` · Upozorněn: ${formatDate(w.notifiedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {w.status === "WAITING" && (
                      <button
                        onClick={() => handleNotify(w.id, w.clientId)}
                        className="btn-primary text-xs py-1 flex items-center gap-1"
                      >
                        <Bell size={12} /> Upozornit
                      </button>
                    )}
                    {w.status === "NOTIFIED" && (
                      <button
                        onClick={() => api.patch(`/waitlist/${w.id}`, { status: "BOOKED" }).then(() => mutate())}
                        className="btn-secondary text-xs py-1 flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Rezervováno
                      </button>
                    )}
                    {["WAITING", "NOTIFIED"].includes(w.status) && (
                      <button
                        onClick={() => handleCancel(w.id)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200"
                      >
                        Zrušit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
