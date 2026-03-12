"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Activity, CreditCard, Calendar, Save } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
};

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: user, mutate } = useSWR<any>(`/users/${id}`, fetcher);
  const { data: appointments } = useSWR<any[]>(`/appointments?clientId=${id}`, fetcher as any);
  const { data: balance } = useSWR<any>(`/credits/balance/${id}`, fetcher);

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "" });
  const [saving, setSaving] = useState(false);

  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);

  const startEdit = () => {
    if (!user) return;
    setForm({ name: user.name, email: user.email, phone: user.phone ?? "", role: user.role });
    setEditMode(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${id}`, form);
      await mutate();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCredit = async () => {
    if (!creditAmount) return;
    setCreditSaving(true);
    try {
      await api.post("/credits/adjust", {
        userId: parseInt(id),
        amount: parseFloat(creditAmount),
        type: parseFloat(creditAmount) > 0 ? "PURCHASE" : "ADJUSTMENT",
        note: creditNote || undefined,
      });
      setCreditAmount("");
      setCreditNote("");
      mutate();
    } finally {
      setCreditSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    if (!user.isActive) {
      await api.patch(`/users/${id}`, { isActive: true });
    } else {
      if (!confirm("Opravdu deaktivovat účet?")) return;
      await api.delete(`/users/${id}`);
    }
    mutate();
  };

  if (!user) {
    return (
      <RouteGuard allowedRoles={["ADMIN"]}>
        <Layout>
          <div className="max-w-4xl mx-auto">
            <div className="card text-center py-12 text-gray-400">Načítám…</div>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  const completed = (appointments ?? []).filter((a: any) => a.status === "COMPLETED").length;
  const upcoming = (appointments ?? []).filter((a: any) =>
    new Date(a.startTime) > new Date() && a.status !== "CANCELLED"
  ).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <Link href="/admin/users" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-4">
            <ArrowLeft size={14} /> Zpět na uživatele
          </Link>

          {/* Header */}
          <div className="card mb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User size={24} className="text-primary-600" />
                </div>
                {editMode ? (
                  <div className="space-y-2 flex-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Jméno</label>
                        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Email</label>
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Telefon</label>
                        <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-0.5">Role</label>
                        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input text-sm">
                          <option value="CLIENT">Klient</option>
                          <option value="RECEPTION">Recepce</option>
                          <option value="EMPLOYEE">Terapeut</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                        <Save size={14} /> {saving ? "Ukládám…" : "Uložit"}
                      </button>
                      <button onClick={() => setEditMode(false)} className="btn-secondary text-sm">Zrušit</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                    <p className="text-sm text-gray-500">{user.email}</p>
                    {user.phone && <p className="text-sm text-gray-400">{user.phone}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="badge bg-primary-50 text-primary-700">{user.role}</span>
                      <span className={`badge ${user.isActive ? "badge-green" : "bg-red-100 text-red-700"}`}>
                        {user.isActive ? "Aktivní" : "Deaktivovaný"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {!editMode && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={startEdit} className="btn-secondary text-xs py-1">Upravit</button>
                  <button
                    onClick={handleToggleActive}
                    className={`text-xs px-3 py-1 rounded-lg border ${
                      user.isActive ? "border-red-200 text-red-500" : "border-green-200 text-green-600"
                    }`}
                  >
                    {user.isActive ? "Deaktivovat" : "Aktivovat"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stats */}
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Activity size={16} className="text-primary-500" />
                  <h2 className="font-semibold text-gray-900">Přehled</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className={`text-2xl font-bold ${SCORE_COLOR(user.behaviorScore ?? 100)}`}>
                      {user.behaviorScore ?? 100}
                    </p>
                    <p className="text-xs text-gray-400">Behavior skóre</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{completed}</p>
                    <p className="text-xs text-gray-400">Sezení</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary-600">
                      {balance?.balance?.toFixed(0) ?? "0"}
                    </p>
                    <p className="text-xs text-gray-400">Kreditů Kč</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{upcoming.length}</p>
                    <p className="text-xs text-gray-400">Nadcházejících</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">Registrován: {formatDate(user.createdAt)}</p>
              </div>

              {/* Credit management */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={16} className="text-primary-500" />
                  <h2 className="font-semibold text-gray-900">Správa kreditů</h2>
                </div>
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="Částka (kladná = nabití, záporná = odečtení)"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="input text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Poznámka (volitelně)"
                    value={creditNote}
                    onChange={(e) => setCreditNote(e.target.value)}
                    className="input text-sm"
                  />
                  <button
                    onClick={handleAddCredit}
                    disabled={!creditAmount || creditSaving}
                    className="btn-primary w-full text-sm"
                  >
                    {creditSaving ? "Ukládám…" : "Upravit kredit"}
                  </button>
                </div>
              </div>
            </div>

            {/* Upcoming appointments */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={16} className="text-primary-500" />
                <h2 className="font-semibold text-gray-900">Nadcházející termíny</h2>
              </div>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400">Žádné nadcházející termíny</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{formatDateTime(a.startTime)}</p>
                        <p className="text-xs text-gray-400">Terapeut: {a.employeeId}</p>
                      </div>
                      <span className={`badge ${a.status === "CONFIRMED" ? "badge-green" : "badge-yellow"}`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
