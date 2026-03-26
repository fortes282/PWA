"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Download, CheckCircle, ExternalLink, AlertTriangle, Calendar, X } from "lucide-react";
import Link from "next/link";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Koncept",
  SENT: "Odesláno",
  PAID: "Zaplaceno",
  OVERDUE: "Po splatnosti",
  CANCELLED: "Storno",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "badge-yellow",
  PAID: "badge-green",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function ReceptionBilling() {
  const shouldReduce = useReducedMotion();
  const { data: invoices, mutate } = useSWR("/invoices", fetcher);
  const { data: overdueInvoices } = useSWR<any[]>("/invoices/overdue", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);

  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showNew, setShowNew] = useState(false);
  const [showFromAppts, setShowFromAppts] = useState(false);
  const [uninvoiced, setUninvoiced] = useState<any[]>([]);
  const [selectedAppts, setSelectedAppts] = useState<Record<number, boolean>>({});
  const [apptDueDate, setApptDueDate] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [loadingUninvoiced, setLoadingUninvoiced] = useState(false);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    dueDate: "",
    notes: "",
    items: [{ description: "", quantity: "1", unitPrice: "" }],
  });
  const [saving, setSaving] = useState(false);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));

  const filtered = (invoices ?? []).filter((inv: any) =>
    filterStatus === "ALL" || inv.status === filterStatus
  ).sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));

  const handleStatusChange = async (id: number, status: string) => {
    haptics.medium();
    await api.patch(`/invoices/${id}/status`, { status });
    mutate();
  };

  const handleDownloadPdf = (id: number) => {
    haptics.light();
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
    window.open(`${API_BASE}/pdf/invoice/${id}`, "_blank");
  };

  const addItem = () => {
    haptics.light();
    setForm({ ...form, items: [...form.items, { description: "", quantity: "1", unitPrice: "" }] });
  };

  const removeItem = (i: number) => {
    haptics.light();
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  };

  const updateItem = (i: number, field: string, value: string) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const total = form.items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unitPrice) || 0;
    return s + qty * price;
  }, 0);

  const openFromAppts = async () => {
    haptics.light();
    setLoadingUninvoiced(true);
    setSelectedAppts({});
    setApptDueDate("");
    setApptNotes("");
    setShowFromAppts(true);
    try {
      const data = await api.get<any[]>("/appointments/uninvoiced");
      setUninvoiced(data ?? []);
    } finally {
      setLoadingUninvoiced(false);
    }
  };

  const toggleAppt = (id: number) => {
    haptics.light();
    setSelectedAppts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleClient = (clientId: number, appts: any[]) => {
    haptics.light();
    const allSelected = appts.every((a) => selectedAppts[a.id]);
    const next = { ...selectedAppts };
    for (const a of appts) next[a.id] = !allSelected;
    setSelectedAppts(next);
  };

  const handleGenerateInvoices = async () => {
    const byClient: Record<number, { clientId: number; appointmentIds: number[] }> = {};
    for (const group of uninvoiced) {
      const ids = group.appointments.filter((a: any) => selectedAppts[a.id]).map((a: any) => a.id);
      if (ids.length > 0) byClient[group.clientId] = { clientId: group.clientId, appointmentIds: ids };
    }
    if (Object.keys(byClient).length === 0) return;
    haptics.medium();
    setGeneratingInvoices(true);
    try {
      for (const payload of Object.values(byClient)) {
        await api.post("/invoices/from-appointments", {
          ...payload,
          dueDate: apptDueDate || undefined,
          notes: apptNotes || undefined,
        });
      }
      haptics.success();
      setShowFromAppts(false);
      mutate();
    } finally {
      setGeneratingInvoices(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setSaving(true);
    try {
      await api.post("/invoices", {
        clientId: parseInt(form.clientId),
        dueDate: form.dueDate,
        notes: form.notes || undefined,
        items: form.items.map((it) => ({
          description: it.description,
          quantity: parseFloat(it.quantity),
          unitPrice: parseFloat(it.unitPrice),
        })),
      });
      haptics.success();
      setShowNew(false);
      setForm({ clientId: "", dueDate: "", notes: "", items: [{ description: "", quantity: "1", unitPrice: "" }] });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  // Summary stats
  const paid = (invoices ?? []).filter((i: any) => i.status === "PAID").reduce((s: number, i: any) => s + i.total, 0);
  const overdue = (invoices ?? []).filter((i: any) => i.status === "OVERDUE").length;
  const pending = (invoices ?? []).filter((i: any) => ["DRAFT", "SENT"].includes(i.status)).length;

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto w-full min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Billing</h1>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "/api"}/invoices/export/csv`}
                className="btn-secondary flex items-center gap-2 text-sm"
                download
              >
                ↓ CSV export
              </a>
              <motion.button
                onClick={openFromAppts}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-secondary flex items-center gap-2"
              >
                <Calendar size={16} /> Generovat z termínů
              </motion.button>
              <motion.button
                onClick={() => { haptics.light(); setShowNew(true); }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} /> Nová faktura
              </motion.button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.08 }}
              className="card text-center"
            >
              <p className="text-2xl font-bold text-green-600">{formatCurrency(paid)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Zaplaceno</p>
            </motion.div>
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 }}
              className="card text-center"
            >
              <p className="text-2xl font-bold text-yellow-600">{pending}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Čeká na platbu</p>
            </motion.div>
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.16 }}
              className="card text-center"
            >
              <p className="text-2xl font-bold text-red-500">{overdue}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Po splatnosti</p>
            </motion.div>
          </div>

          {/* Overdue alert */}
          <AnimatePresence>
            {(overdueInvoices ?? []).length > 0 && (
              <motion.div
                key="overdue-alert"
                initial={shouldReduce ? false : { opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card mb-4 border-l-4 border-red-400 bg-red-50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-500" />
                  <h3 className="font-semibold text-red-800 text-sm">
                    {(overdueInvoices ?? []).length} faktura po splatnosti
                  </h3>
                </div>
                <div className="space-y-1">
                  {(overdueInvoices ?? []).slice(0, 3).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between text-xs">
                      <span className="text-red-700">{inv.invoiceNumber} · splatnost {formatDate(inv.dueDate)}</span>
                      <span className="font-medium text-red-800">{formatCurrency(inv.total)}</span>
                    </div>
                  ))}
                  {(overdueInvoices ?? []).length > 3 && (
                    <p className="text-xs text-red-500 mt-1">+ {(overdueInvoices ?? []).length - 3} dalších</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Generate from appointments modal */}
          <AnimatePresence>
            {showFromAppts && (
              <motion.div
                key="appts-backdrop"
                initial={shouldReduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                onClick={(e) => { if (e.target === e.currentTarget) { haptics.light(); setShowFromAppts(false); } }}
              >
                <motion.div
                  initial={shouldReduce ? false : { opacity: 0, scale: 0.93, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.93, y: 12 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
                >
                  <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Generovat faktury z termínů</h2>
                    <motion.button
                      onClick={() => { haptics.light(); setShowFromAppts(false); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={18} />
                    </motion.button>
                  </div>

                  <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    {loadingUninvoiced && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Načítám termíny…</p>
                    )}
                    {!loadingUninvoiced && uninvoiced.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">Žádné nefakturované dokončené termíny.</p>
                    )}
                    {!loadingUninvoiced && uninvoiced.map((group: any) => {
                      const allSelected = group.appointments.every((a: any) => selectedAppts[a.id]);
                      return (
                        <div key={group.clientId} className="border rounded-lg overflow-hidden">
                          <div
                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 px-3 py-2 cursor-pointer"
                            onClick={() => toggleClient(group.clientId, group.appointments)}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => toggleClient(group.clientId, group.appointments)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded"
                              />
                              <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{group.clientName}</span>
                            </div>
                            <span className="text-xs text-gray-500">{group.appointments.length} termínů</span>
                          </div>
                          <div className="divide-y">
                            {group.appointments.map((appt: any) => (
                              <label key={appt.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!selectedAppts[appt.id]}
                                  onChange={() => toggleAppt(appt.id)}
                                  className="rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{appt.serviceName}</p>
                                  <p className="text-xs text-gray-400">{appt.startTime?.slice(0, 10)}</p>
                                </div>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-shrink-0">
                                  {formatCurrency(appt.price ?? appt.servicePrice ?? 0)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Splatnost</label>
                        <input
                          type="date"
                          value={apptDueDate}
                          onChange={(e) => setApptDueDate(e.target.value)}
                          className="input"
                          placeholder="14 dní od dnes"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Poznámka</label>
                        <input
                          type="text"
                          value={apptNotes}
                          onChange={(e) => setApptNotes(e.target.value)}
                          className="input"
                          placeholder="Volitelná poznámka"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <motion.button
                        onClick={() => { haptics.light(); setShowFromAppts(false); }}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-secondary"
                      >
                        Zrušit
                      </motion.button>
                      <motion.button
                        onClick={handleGenerateInvoices}
                        disabled={generatingInvoices || !Object.values(selectedAppts).some(Boolean)}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-primary flex items-center gap-2 disabled:opacity-50"
                      >
                        {generatingInvoices ? "Generuji…" : "Vytvořit faktury"}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* New invoice form */}
          <AnimatePresence initial={false}>
            {showNew && (
              <motion.div
                key="new-invoice-form"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.97, y: -14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border border-primary-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nová faktura</h2>
                  <motion.button
                    type="button"
                    onClick={() => { haptics.light(); setShowNew(false); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </motion.button>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
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
                      <label className="block text-xs text-gray-500 mb-1">Splatnost</label>
                      <input
                        type="date"
                        required
                        value={form.dueDate}
                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Poznámka</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="input"
                      placeholder="Volitelná poznámka"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Položky</label>
                    <div className="space-y-2">
                      {form.items.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Popis"
                            value={item.description}
                            onChange={(e) => updateItem(i, "description", e.target.value)}
                            className="input flex-1"
                          />
                          <input
                            type="number"
                            required
                            min="0.1"
                            step="0.1"
                            placeholder="Počet"
                            value={item.quantity}
                            onChange={(e) => updateItem(i, "quantity", e.target.value)}
                            className="input w-20"
                          />
                          <input
                            type="number"
                            required
                            min="0"
                            placeholder="Cena/ks"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                            className="input w-28"
                          />
                          {form.items.length > 1 && (
                            <motion.button
                              type="button"
                              onClick={() => removeItem(i)}
                              whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="text-red-400 hover:text-red-600 px-2"
                            >
                              <X size={14} />
                            </motion.button>
                          )}
                        </div>
                      ))}
                      <motion.button
                        type="button"
                        onClick={addItem}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        + Přidat položku
                      </motion.button>
                    </div>
                    <p className="text-right text-sm font-semibold mt-2">
                      Celkem: {formatCurrency(total)}
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => { haptics.light(); setShowNew(false); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary"
                    >
                      Zrušit
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={saving}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary disabled:opacity-50"
                    >
                      {saving ? "Ukládám…" : "Vytvořit fakturu"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
            {["ALL", "DRAFT", "SENT", "PAID", "OVERDUE"].map((s) => (
              <motion.button
                key={s}
                onClick={() => { haptics.light(); setFilterStatus(s); }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "ALL" ? "Vše" : STATUS_LABELS[s]}
              </motion.button>
            ))}
          </div>

          {/* Invoice list */}
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.length === 0 && (
                <motion.div
                  key="empty"
                  initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="card text-center text-gray-500 dark:text-gray-400 py-10"
                >
                  Žádné faktury
                </motion.div>
              )}
            </AnimatePresence>

            {filtered.map((inv: any, i: number) => (
              <motion.div
                key={inv.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                layout
                className="card"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[inv.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                      <span className="text-xs text-gray-500">{inv.invoiceNumber}</span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {clientMap[inv.clientId] ?? `Klient #${inv.clientId}`}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCurrency(inv.total)} · Splatnost: {formatDate(inv.dueDate)}
                      {inv.paidAt ? ` · Zaplaceno: ${formatDate(inv.paidAt)}` : ""}
                    </p>
                    {inv.status === "PAID" && inv.paymentMethod && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                        inv.paymentMethod === "cash" ? "bg-green-100 text-green-700" :
                        inv.paymentMethod === "card" ? "bg-blue-100 text-blue-700" :
                        inv.paymentMethod === "transfer" ? "bg-purple-100 text-purple-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {inv.paymentMethod === "cash" ? "Hotovost" :
                         inv.paymentMethod === "card" ? "Karta" :
                         inv.paymentMethod === "transfer" ? "Převodem" : "Kredit"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Link
                      href={`/reception/invoices/${inv.id}`}
                      className="btn-secondary text-xs py-1 flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Detail
                    </Link>
                    <motion.button
                      onClick={() => handleDownloadPdf(inv.id)}
                      whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary text-xs py-1 flex items-center gap-1"
                      title="Stáhnout PDF"
                    >
                      <Download size={12} /> PDF
                    </motion.button>
                    {inv.status === "DRAFT" && (
                      <motion.button
                        onClick={() => handleStatusChange(inv.id, "SENT")}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-secondary text-xs py-1"
                      >
                        Odeslat
                      </motion.button>
                    )}
                    {["DRAFT", "SENT", "OVERDUE"].includes(inv.status) && (
                      <motion.button
                        onClick={() => handleStatusChange(inv.id, "PAID")}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-primary text-xs py-1 flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Zaplaceno
                      </motion.button>
                    )}
                    {inv.status === "SENT" && (
                      <motion.button
                        onClick={() => handleStatusChange(inv.id, "OVERDUE")}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200"
                      >
                        Po splatnosti
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
