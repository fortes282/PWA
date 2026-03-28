"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Calendar, User, Heart, StickyNote, Plus, Trash2, Activity, FileText } from "lucide-react";
import ClientTimeline from "@/components/ClientTimeline";
import ClientQuestionnairesPanel from "@/components/ClientQuestionnairesPanel";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  CANCELLED: "Zrušeno",
  COMPLETED: "Dokončeno",
  UNJUSTIFIED_CANCEL: "Neoprávněné storno",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "badge-yellow",
  CONFIRMED: "badge-blue",
  CANCELLED: "badge-red",
  COMPLETED: "badge-green",
  UNJUSTIFIED_CANCEL: "badge-orange",
};

export default function ReceptionClientDetail() {
  const shouldReduce = useReducedMotion();
  const { id } = useParams<{ id: string }>();

  const { data: client } = useSWR<any>(`/users/${id}`, fetcher);
  const { data: appointments } = useSWR<any[]>(`/appointments?clientId=${id}`, fetcher);
  const { data: balance, mutate: mutateBalance } = useSWR<{ balance: number; userId: number }>(`/credits/balance/${id}`, fetcher);
  const { data: transactions, mutate: mutateTransactions } = useSWR<any[]>(`/credits/transactions?userId=${id}`, fetcher);
  const { data: staffNotes, mutate: mutateNotes } = useSWR<any[]>(`/clients/${id}/staff-notes`, fetcher);

  const [quickCredit, setQuickCredit] = useState<string>("");
  const [creditNote, setCreditNote] = useState<string>("");
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline">("overview");
  const [addingCredit, setAddingCredit] = useState(false);

  const handleQuickCredit = async () => {
    if (!quickCredit) return;
    haptics.medium();
    setAddingCredit(true);
    try {
      await api.post("/credits/adjust", {
        userId: parseInt(id),
        amount: parseFloat(quickCredit),
        type: parseFloat(quickCredit) > 0 ? "PURCHASE" : "ADJUSTMENT",
        note: creditNote || undefined,
      });
      haptics.success();
      setQuickCredit("");
      setCreditNote("");
      mutateBalance();
      mutateTransactions();
    } finally {
      setAddingCredit(false);
    }
  };

  const upcoming = appointments
    ?.filter((a) => new Date(a.startTime) > new Date() && a.status !== "CANCELLED")
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const past = appointments
    ?.filter((a) => new Date(a.startTime) <= new Date() || a.status === "CANCELLED")
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={shouldReduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Link
              href="/reception/clients"
              className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-4"
              onClick={() => haptics.light()}
            >
              <ArrowLeft size={14} /> Zpět na klienty
            </Link>
          </motion.div>

          {client ? (
            <>
              {/* Client header */}
              <motion.div
                className="card mb-6"
                initial={shouldReduce ? false : { opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.04 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center"
                    whileHover={shouldReduce ? undefined : { scale: 1.06 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <User size={24} className="text-primary-600" />
                  </motion.div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{client.name}</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>
                    {client.phone && <p className="text-sm text-gray-500 dark:text-gray-400">{client.phone}</p>}
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <span className={`badge ${client.isActive ? "badge-green" : "badge-red"}`}>
                      {client.isActive ? "Aktivní" : "Neaktivní"}
                    </span>
                    <motion.div whileHover={shouldReduce ? undefined : { x: 2 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                      <Link
                        href={`/reception/health-records/${id}`}
                        className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 hover:underline"
                        onClick={() => haptics.light()}
                      >
                        <Heart size={12} /> Zdravotní záznam
                      </Link>
                    </motion.div>
                    <motion.a
                      href={`${process.env.NEXT_PUBLIC_API_URL || "/api"}/clients/${id}/appointments/pdf`}
                      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline"
                      download
                      onClick={() => haptics.light()}
                      whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      <FileText size={12} /> PDF rezervací
                    </motion.a>
                  </div>
                </div>
              </motion.div>

              {/* Stats grid */}
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
              >
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + 0 * 0.04 }}
                  className="card"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Skóre dochvilnosti</p>
                  <p className={`text-2xl font-bold ${
                    client.behaviorScore >= 80 ? "text-green-600" :
                    client.behaviorScore >= 50 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {client.behaviorScore?.toFixed(0)}/100
                  </p>
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + 1 * 0.04 }}
                  className="card"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <CreditCard size={14} className="text-gray-500 dark:text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Kredit</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {balance ? formatCurrency(balance.balance) : "—"}
                  </p>
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + 2 * 0.04 }}
                  className="card"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar size={14} className="text-gray-500 dark:text-gray-400" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">Nadcházející</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{upcoming?.length ?? 0}</p>
                </motion.div>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
                <motion.button
                  onClick={() => { haptics.light(); setActiveTab("overview"); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "overview" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  Přehled
                </motion.button>
                <motion.button
                  onClick={() => { haptics.light(); setActiveTab("timeline"); }}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${activeTab === "timeline" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  <Activity size={14} />
                  Časová osa
                </motion.button>
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {activeTab === "timeline" && (
                  <motion.div
                    key="tab-timeline"
                    initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="card"
                  >
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Časová osa událostí</h2>
                    <ClientTimeline clientId={id} />
                  </motion.div>
                )}

                {activeTab === "overview" && (
                  <motion.div
                    key="tab-overview"
                    initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="space-y-6"
                  >
                    {/* Upcoming appointments */}
                    <section>
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Nadcházející rezervace</h2>
                      {upcoming && upcoming.length > 0 ? (
                        <div
                          className="space-y-2"
                        >
                          {upcoming.map((a, i) => (
                            <motion.div
                              key={a.id}
                              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                              layout
                              className="card flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-sm">{formatDateTime(a.startTime)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {a.price ? formatCurrency(a.price) : ""}
                                </p>
                              </div>
                              <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>
                                {STATUS_LABELS[a.status]}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Žádné nadcházející rezervace</p>
                      )}
                    </section>

                    {/* Past appointments */}
                    <section>
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Minulé rezervace</h2>
                      {past && past.length > 0 ? (
                        <div
                          className="space-y-2"
                        >
                          {past.slice(0, 10).map((a, i) => (
                            <motion.div
                              key={a.id}
                              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                              layout
                              className="card flex items-center justify-between opacity-60"
                            >
                              <div>
                                <p className="font-medium text-sm">{formatDateTime(a.startTime)}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {a.price ? formatCurrency(a.price) : ""}
                                </p>
                              </div>
                              <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>
                                {STATUS_LABELS[a.status]}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Žádné minulé rezervace</p>
                      )}
                    </section>

                    {/* Quick credit add */}
                    <section>
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Přidat/odebrat kredit</h2>
                      <div className="card flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Částka (+ nabití, − odečtení)</label>
                          <input
                            type="number"
                            value={quickCredit}
                            onChange={(e) => setQuickCredit(e.target.value)}
                            className="input text-sm"
                            placeholder="1200 nebo -500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Poznámka</label>
                          <input
                            type="text"
                            value={creditNote}
                            onChange={(e) => setCreditNote(e.target.value)}
                            className="input text-sm"
                            placeholder="Volitelně"
                          />
                        </div>
                        <motion.button
                          onClick={handleQuickCredit}
                          disabled={!quickCredit || addingCredit}
                          className="btn-primary text-sm disabled:opacity-50"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          {addingCredit ? "…" : "Uložit"}
                        </motion.button>
                      </div>
                    </section>

                    {/* Credit history */}
                    <section>
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Kreditní transakce</h2>
                      {transactions && transactions.length > 0 ? (
                        <div
                          className="space-y-2"
                        >
                          {transactions.map((tx: any, i: number) => (
                            <motion.div
                              key={tx.id}
                              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                              layout
                              className="card flex items-center justify-between"
                            >
                              <div>
                                <p className="text-sm font-medium">{tx.type}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(tx.createdAt)}</p>
                                {tx.note && <p className="text-xs text-gray-500 dark:text-gray-400">{tx.note}</p>}
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                                  {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Zůstatek: {formatCurrency(tx.balance)}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Žádné transakce</p>
                      )}
                    </section>

                    {/* Questionnaires */}
                    <section>
                      <div className="card">
                        <ClientQuestionnairesPanel clientId={id} />
                      </div>
                    </section>

                    {/* Staff Notes */}
                    <section>
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <StickyNote size={18} className="text-yellow-500" />
                          Interní poznámky
                        </h2>
                        <motion.button
                          onClick={() => { haptics.light(); setAddingNote(!addingNote); }}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          whileTap={shouldReduce ? undefined : { scale: 0.94 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          <motion.span
                            animate={{ rotate: addingNote ? 45 : 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 24 }}
                            className="inline-flex"
                          >
                            <Plus size={14} />
                          </motion.span>
                          {addingNote ? "Zrušit" : "Přidat"}
                        </motion.button>
                      </div>

                      {/* Add note panel */}
                      <AnimatePresence initial={false}>
                        {addingNote && (
                          <motion.div
                            key="add-note-panel"
                            initial={shouldReduce ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: "spring", stiffness: 360, damping: 32 }}
                            className="overflow-hidden"
                          >
                            <div className="card mb-3 space-y-2">
                              <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Napište interní poznámku o klientovi…"
                                rows={3}
                                className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500"
                              />
                              <div className="flex gap-2">
                                <motion.button
                                  onClick={async () => {
                                    if (!newNote.trim()) return;
                                    haptics.medium();
                                    await api.post(`/clients/${id}/staff-notes`, { note: newNote.trim() });
                                    haptics.success();
                                    setNewNote("");
                                    setAddingNote(false);
                                    mutateNotes();
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                >
                                  Uložit
                                </motion.button>
                                <motion.button
                                  onClick={() => { haptics.light(); setAddingNote(false); }}
                                  className="px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                >
                                  Zrušit
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {staffNotes && staffNotes.length > 0 ? (
                        <div
                          className="space-y-2"
                        >
                          {staffNotes.map((n: any, i: number) => (
                            <motion.div
                              key={n.id}
                              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                              layout
                              className="card bg-yellow-50 border-yellow-100"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">{n.note}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {n.author_name} · {new Date(n.created_at ?? n.createdAt).toLocaleDateString("cs-CZ")}
                                  </p>
                                </div>
                                <motion.button
                                  onClick={async () => {
                                    haptics.medium();
                                    await api.delete(`/staff-notes/${n.id}`);
                                    mutateNotes();
                                  }}
                                  className="text-red-300 hover:text-red-500 ml-2"
                                  whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                >
                                  <Trash2 size={14} />
                                </motion.button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <AnimatePresence>
                          {!addingNote && (
                            <motion.p
                              initial={shouldReduce ? false : { opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="text-gray-500 dark:text-gray-400 text-sm"
                            >
                              Žádné interní poznámky
                            </motion.p>
                          )}
                        </AnimatePresence>
                      )}
                    </section>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <motion.p
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-gray-500 dark:text-gray-400 text-center py-8"
            >
              Načítání…
            </motion.p>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
