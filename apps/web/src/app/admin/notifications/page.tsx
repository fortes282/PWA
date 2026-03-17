"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Bell, Send, Users, CheckCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const NOTIFICATION_TYPES = [
  { value: "GENERAL", label: "Obecné" },
  { value: "APPOINTMENT_CONFIRMED", label: "Potvrzení termínu" },
  { value: "APPOINTMENT_REMINDER", label: "Připomínka termínu" },
  { value: "INVOICE", label: "Faktura" },
];

const ROLE_OPTIONS = [
  { value: "CLIENT", label: "Klienti" },
  { value: "EMPLOYEE", label: "Terapeuti" },
  { value: "RECEPTION", label: "Recepce" },
  { value: "ADMIN", label: "Admins" },
];

export default function AdminNotifications() {
  const { data: users } = useSWR("/users", fetcher);

  const [mode, setMode] = useState<"roles" | "users">("roles");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["CLIENT"]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [type, setType] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const filteredUsers = (users ?? []).filter((u: any) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError("Nadpis i zpráva jsou povinné");
      return;
    }
    if (mode === "roles" && selectedRoles.length === 0) {
      setError("Vyberte alespoň jednu roli");
      return;
    }
    if (mode === "users" && selectedUserIds.length === 0) {
      setError("Vyberte alespoň jednoho uživatele");
      return;
    }

    setError(null);
    setSending(true);
    setResult(null);

    try {
      const payload = mode === "roles"
        ? { roles: selectedRoles, type, title, message }
        : { userIds: selectedUserIds, type, title, message };

      const res = await api.post<{ sent: number }>("/batch/notifications", payload);
      setResult(res);
      setTitle("");
      setMessage("");
      setSelectedUserIds([]);
    } catch (err: any) {
      setError(err?.message ?? "Chyba při odesílání");
    } finally {
      setSending(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Bell size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Hromadné notifikace</h1>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {/* Mode selector */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Příjemci</h2>
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setMode("roles")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    mode === "roles"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Users size={15} /> Podle role
                </button>
                <button
                  type="button"
                  onClick={() => setMode("users")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    mode === "users"
                      ? "bg-primary-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <Bell size={15} /> Konkrétní uživatelé
                </button>
              </div>

              {mode === "roles" ? (
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleRole(value)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                        selectedRoles.includes(value)
                          ? "bg-primary-100 text-primary-700 border border-primary-300"
                          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      {label}
                      {selectedRoles.includes(value) && <span className="ml-1">✓</span>}
                    </button>
                  ))}
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Hledat uživatele…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="input mb-3 text-sm"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
                    {filteredUsers.map((u: any) => (
                      <label key={u.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.id)}
                          onChange={() => toggleUser(u.id)}
                          className="rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email} · {u.role}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedUserIds.length > 0 && (
                    <p className="text-xs text-primary-600 mt-2">{selectedUserIds.length} uživatelů vybráno</p>
                  )}
                </div>
              )}
            </div>

            {/* Notification content */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Obsah notifikace</h2>

              <div>
                <label className="label">Typ notifikace</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="input"
                >
                  {NOTIFICATION_TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Nadpis</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Např. Důležité oznámení"
                  className="input"
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label className="label">Zpráva</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Text notifikace…"
                  className="input resize-none"
                  rows={3}
                  required
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 mt-1">{message.length}/500 znaků</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            {result && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle size={16} />
                Odesláno {result.sent} notifikací ✓
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Send size={16} />
              {sending ? "Odesílám…" : "Odeslat notifikace"}
            </button>
          </form>
        </div>
      </Layout>
    </RouteGuard>
  );
}
