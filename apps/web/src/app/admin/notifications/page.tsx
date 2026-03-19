"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Bell, Send, Users, CheckCircle, History, Mail, MessageSquare, Smartphone, Monitor } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);
const fetchAny = (url: string) => api.get<any>(url);

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

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  email: <Mail size={14} className="text-blue-500" />,
  sms: <MessageSquare size={14} className="text-green-500" />,
  push: <Smartphone size={14} className="text-purple-500" />,
  inapp: <Monitor size={14} className="text-gray-500" />,
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-500",
};

export default function AdminNotifications() {
  const { data: users } = useSWR("/users", fetcher);
  const [logPage, setLogPage] = useState(0);
  const [logChannel, setLogChannel] = useState("");
  const [logStatus, setLogStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"send" | "log">("send");

  const logUrl = `/notification-log?limit=50&offset=${logPage * 50}${logChannel ? `&channel=${logChannel}` : ""}${logStatus ? `&status=${logStatus}` : ""}`;
  const { data: logData } = useSWR(activeTab === "log" ? logUrl : null, fetchAny);

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
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Bell size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Notifikace</h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("send")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === "send" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <span className="flex items-center gap-2"><Send size={14} /> Odeslat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("log")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeTab === "log" ? "bg-white text-primary-700 shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <span className="flex items-center gap-2"><History size={14} /> Log připomínek</span>
            </button>
          </div>

          {activeTab === "send" && (
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
                            <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
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
                  <p className="text-xs text-gray-500 mt-1">{message.length}/500 znaků</p>
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
          )}

          {activeTab === "log" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="card flex flex-wrap gap-3 items-end">
                <div>
                  <label className="label text-xs">Kanál</label>
                  <select
                    value={logChannel}
                    onChange={(e) => { setLogChannel(e.target.value); setLogPage(0); }}
                    className="input text-sm py-1.5"
                  >
                    <option value="">Vše</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push</option>
                    <option value="inapp">In-app</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Status</label>
                  <select
                    value={logStatus}
                    onChange={(e) => { setLogStatus(e.target.value); setLogPage(0); }}
                    className="input text-sm py-1.5"
                  >
                    <option value="">Vše</option>
                    <option value="sent">Odesláno</option>
                    <option value="failed">Selhalo</option>
                    <option value="skipped">Přeskočeno</option>
                  </select>
                </div>
                <div className="text-sm text-gray-500 mt-auto pb-1">
                  Celkem: {logData?.total ?? "–"}
                </div>
              </div>

              {/* Log table */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Čas</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Uživatel</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Kanál</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Okno</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Status</th>
                        <th className="text-left py-2 px-3 font-medium text-gray-600">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(logData?.rows ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-500">
                            {logData ? "Žádné záznamy" : "Načítám…"}
                          </td>
                        </tr>
                      ) : (
                        (logData?.rows ?? []).map((row: any) => (
                          <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3 text-gray-500 whitespace-nowrap text-xs">
                              {new Date(row.sent_at).toLocaleString("cs-CZ")}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-medium text-gray-800">{row.user_name ?? "–"}</div>
                              <div className="text-xs text-gray-500">{row.user_email}</div>
                            </td>
                            <td className="py-2 px-3">
                              <span className="flex items-center gap-1">
                                {CHANNEL_ICONS[row.channel] ?? null}
                                <span className="text-gray-700">{row.channel}</span>
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-600">{row.window}</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500 max-w-[180px] truncate">
                              {row.detail ?? "–"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {(logData?.total ?? 0) > 50 && (
                <div className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                    disabled={logPage === 0}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    ← Předchozí
                  </button>
                  <span className="text-gray-500">
                    Strana {logPage + 1} / {Math.ceil((logData?.total ?? 0) / 50)}
                  </span>
                  <button
                    onClick={() => setLogPage((p) => p + 1)}
                    disabled={(logPage + 1) * 50 >= (logData?.total ?? 0)}
                    className="btn-secondary text-sm disabled:opacity-40"
                  >
                    Další →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
