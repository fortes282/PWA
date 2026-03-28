"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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
  { value: "APPOINTMENT_CONFIRMED", label: "Potvrzení rezervace" },
  { value: "APPOINTMENT_REMINDER", label: "Připomínka rezervace" },
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
  const shouldReduce = useReducedMotion();
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
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <Bell size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifikace</h1>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
            className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit"
          >
            {(["send", "log"] as const).map((tab) => (
              <motion.button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab === "send" ? <><Send size={14} /> Odeslat</> : <><History size={14} /> Log připomínek</>}
                </span>
              </motion.button>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">
            {activeTab === "send" && (
              <motion.div
                key="send"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <form onSubmit={handleSend} className="space-y-4">
                  {/* Mode selector */}
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
                    className="card"
                  >
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Příjemci</h2>
                    <div className="flex gap-3 mb-4">
                      {(["roles", "users"] as const).map((m) => (
                        <motion.button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            mode === m
                              ? "bg-primary-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                          }`}
                        >
                          {m === "roles" ? <><Users size={15} /> Podle role</> : <><Bell size={15} /> Konkrétní uživatelé</>}
                        </motion.button>
                      ))}
                    </div>

                    <AnimatePresence mode="wait">
                      {mode === "roles" ? (
                        <motion.div
                          key="roles"
                          initial={shouldReduce ? {} : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="flex flex-wrap gap-2"
                        >
                          {ROLE_OPTIONS.map(({ value, label }, i) => (
                            <motion.button
                              key={value}
                              type="button"
                              onClick={() => toggleRole(value)}
                              initial={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                selectedRoles.includes(value)
                                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 border border-primary-300 dark:border-primary-600"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                              }`}
                            >
                              {label}
                              {selectedRoles.includes(value) && <span className="ml-1">✓</span>}
                            </motion.button>
                          ))}
                        </motion.div>
                      ) : (
                        <motion.div
                          key="users"
                          initial={shouldReduce ? {} : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        >
                          <input
                            type="text"
                            placeholder="Hledat uživatele…"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="input mb-3 text-sm"
                          />
                          <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 dark:border-gray-700 rounded-lg p-2">
                            {filteredUsers.map((u: any) => (
                              <label key={u.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedUserIds.includes(u.id)}
                                  onChange={() => toggleUser(u.id)}
                                  className="rounded"
                                />
                                <div>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.name}</p>
                                  <p className="text-xs text-gray-500">{u.email} · {u.role}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                          {selectedUserIds.length > 0 && (
                            <p className="text-xs text-primary-600 dark:text-primary-400 mt-2">{selectedUserIds.length} uživatelů vybráno</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Notification content */}
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                    className="card space-y-4"
                  >
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Obsah notifikace</h2>

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
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduce ? {} : { opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {result && (
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduce ? {} : { opacity: 0, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 flex items-center gap-2 text-green-700 dark:text-green-400 text-sm"
                      >
                        <CheckCircle size={16} />
                        Odesláno {result.sent} notifikací ✓
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 }}
                  >
                    <motion.button
                      type="submit"
                      disabled={sending}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      <Send size={16} />
                      {sending ? "Odesílám…" : "Odeslat notifikace"}
                    </motion.button>
                  </motion.div>
                </form>
              </motion.div>
            )}

            {activeTab === "log" && (
              <motion.div
                key="log"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="space-y-4"
              >
                {/* Filters */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
                  className="card flex flex-wrap gap-3 items-end"
                >
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
                </motion.div>

                {/* Log table */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                  className="card p-0 overflow-hidden"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600">
                          <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Čas</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Uživatel</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Kanál</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Okno</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Detail</th>
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
                          (logData?.rows ?? []).map((row: any, i: number) => (
                            <motion.tr
                              key={row.id}
                              initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.02 }}
                              className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                              <td className="py-2 px-3 text-gray-500 whitespace-nowrap text-xs">
                                {new Date(row.sent_at).toLocaleString("cs-CZ")}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-medium text-gray-800 dark:text-gray-200">{row.user_name ?? "–"}</div>
                                <div className="text-xs text-gray-500">{row.user_email}</div>
                              </td>
                              <td className="py-2 px-3">
                                <span className="flex items-center gap-1">
                                  {CHANNEL_ICONS[row.channel] ?? null}
                                  <span className="text-gray-700 dark:text-gray-300">{row.channel}</span>
                                </span>
                              </td>
                              <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{row.window}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600"}`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-xs text-gray-500 max-w-[180px] truncate">
                                {row.detail ?? "–"}
                              </td>
                            </motion.tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Pagination */}
                {(logData?.total ?? 0) > 50 && (
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between text-sm"
                  >
                    <motion.button
                      onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                      disabled={logPage === 0}
                      whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary text-sm disabled:opacity-40"
                    >
                      ← Předchozí
                    </motion.button>
                    <span className="text-gray-500">
                      Strana {logPage + 1} / {Math.ceil((logData?.total ?? 0) / 50)}
                    </span>
                    <motion.button
                      onClick={() => setLogPage((p) => p + 1)}
                      disabled={(logPage + 1) * 50 >= (logData?.total ?? 0)}
                      whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary text-sm disabled:opacity-40"
                    >
                      Další →
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
