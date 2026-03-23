"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, CheckCircle, Send, Trash2 } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

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

export default function InvoiceDetail() {
  const shouldReduce = useReducedMotion();
  const { id } = useParams<{ id: string }>();
  const { data: invoice, mutate } = useSWR<any>(`/invoices/${id}`, fetcher);
  const { data: clients } = useSWR<any[]>("/clients", fetcher as any);
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentPaidAt, setPaymentPaidAt] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c]));
  const client = invoice ? clientMap[invoice.clientId] : null;

  const handleStatusChange = async (status: string) => {
    haptics.medium();
    await api.patch(`/invoices/${id}/status`, { status });
    haptics.success();
    mutate();
  };

  const handleSaveNotes = async () => {
    haptics.medium();
    setSaving(true);
    try {
      await api.patch(`/invoices/${id}/notes`, { notes });
      await mutate();
      haptics.success();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setSavingPayment(true);
    try {
      await api.patch(`/invoices/${id}/payment`, {
        payment_method: paymentMethod,
        paid_at: paymentPaidAt ? new Date(paymentPaidAt).toISOString() : undefined,
      });
      await mutate();
      haptics.success();
    } finally {
      setSavingPayment(false);
    }
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

  if (!invoice) {
    return (
      <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
        <Layout>
          <div className="max-w-3xl mx-auto">
            <div className="card text-center text-gray-500 py-12">Načítám fakturu…</div>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <motion.div
            whileTap={shouldReduce ? undefined : { x: -2 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="mb-4"
          >
            <Link
              href="/reception/billing"
              onClick={() => haptics.light()}
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Zpět na billing
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            className="card mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${STATUS_COLORS[invoice.status] ?? ""}`}>
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{invoice.invoiceNumber}</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                  Klient: <span className="font-medium text-gray-900 dark:text-gray-100">{client?.name ?? `#${invoice.clientId}`}</span>
                </p>
                {client?.email && <p className="text-sm text-gray-500 dark:text-gray-400">{client.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.total)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Splatnost: {formatDate(invoice.dueDate)}</p>
                {invoice.paidAt && (
                  <p className="text-xs text-green-600 mt-0.5">Zaplaceno: {formatDate(invoice.paidAt)}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* Items */}
          <motion.div
            className="card mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Položky</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-2 font-medium">Popis</th>
                    <th className="pb-2 font-medium text-right">Počet</th>
                    <th className="pb-2 font-medium text-right">Cena/ks</th>
                    <th className="pb-2 font-medium text-right">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items ?? []).map((item: any, i: number) => (
                    <motion.tr
                      key={i}
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                      className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                    >
                      <td className="py-2 text-gray-900 dark:text-gray-100">{item.description}</td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-400">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total)}</td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right font-bold text-gray-700 dark:text-gray-300">Celkem</td>
                    <td className="pt-3 text-right font-bold text-lg text-gray-900 dark:text-gray-100">{formatCurrency(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>

          {/* Notes */}
          <motion.div
            className="card mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Poznámka</h2>
              <AnimatePresence>
                {!editMode && (
                  <motion.button
                    key="edit-btn"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    onClick={() => { haptics.light(); setNotes(invoice.notes ?? ""); setEditMode(true); }}
                    whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                    className="text-xs text-primary-600 hover:text-primary-800"
                  >
                    Upravit
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {editMode ? (
                <motion.div
                  key="edit-panel"
                  initial={shouldReduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input min-h-[80px] mb-3"
                    placeholder="Poznámka k faktuře…"
                  />
                  <div className="flex gap-2">
                    <motion.button
                      onClick={handleSaveNotes}
                      disabled={saving}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      {saving ? "Ukládám…" : "Uložit"}
                    </motion.button>
                    <motion.button
                      onClick={() => { haptics.light(); setEditMode(false); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary text-sm"
                    >
                      Zrušit
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                <motion.p
                  key="notes-display"
                  initial={shouldReduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                  className="text-sm text-gray-600 dark:text-gray-400"
                >
                  {invoice.notes || <span className="text-gray-500 italic">Žádná poznámka</span>}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Payment section — only for PAID invoices */}
          <AnimatePresence>
            {invoice.status === "PAID" && (
              <motion.div
                key="payment-section"
                initial={shouldReduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Platba</h2>
                {invoice.paymentMethod ? (
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      invoice.paymentMethod === "cash" ? "bg-green-100 text-green-700" :
                      invoice.paymentMethod === "card" ? "bg-blue-100 text-blue-700" :
                      invoice.paymentMethod === "transfer" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {invoice.paymentMethod === "cash" ? "Hotovost" :
                       invoice.paymentMethod === "card" ? "Karta" :
                       invoice.paymentMethod === "transfer" ? "Převodem" : "Kredit"}
                    </span>
                    {invoice.paymentPaidAt && (
                      <span className="text-sm text-gray-500">
                        {new Date(invoice.paymentPaidAt).toLocaleDateString("cs-CZ")}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Způsob platby není nastaven.</p>
                )}
                <form onSubmit={handleSavePayment} className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Způsob platby</label>
                    <select
                      required
                      value={paymentMethod || invoice.paymentMethod || ""}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      <option value="cash">Hotovost</option>
                      <option value="card">Karta</option>
                      <option value="transfer">Převodem</option>
                      <option value="credit">Kredit</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Datum platby</label>
                    <input
                      type="date"
                      value={paymentPaidAt || (invoice.paymentPaidAt ? new Date(invoice.paymentPaidAt).toISOString().slice(0,10) : "")}
                      onChange={(e) => setPaymentPaidAt(e.target.value)}
                      className="input"
                    />
                  </div>
                  <motion.button
                    type="submit"
                    disabled={savingPayment}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {savingPayment ? "Ukládám…" : "Uložit platbu"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <motion.div
            className="card"
            initial={shouldReduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Akce</h2>
            <div className="flex flex-wrap gap-3">
              <motion.a
                href={`${API_BASE}/pdf/invoice/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => haptics.light()}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-secondary flex items-center gap-2"
              >
                <Download size={16} /> Stáhnout PDF
              </motion.a>

              <AnimatePresence>
                {invoice.status === "DRAFT" && (
                  <motion.button
                    key="send-btn"
                    initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    onClick={() => handleStatusChange("SENT")}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Send size={16} /> Označit jako odesláno
                  </motion.button>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {["DRAFT", "SENT", "OVERDUE"].includes(invoice.status) && (
                  <motion.button
                    key="paid-btn"
                    initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    onClick={() => handleStatusChange("PAID")}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CheckCircle size={16} /> Označit jako zaplaceno
                  </motion.button>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {invoice.status === "SENT" && (
                  <motion.button
                    key="overdue-btn"
                    initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    onClick={() => handleStatusChange("OVERDUE")}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
                  >
                    Po splatnosti
                  </motion.button>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {["DRAFT", "SENT"].includes(invoice.status) && (
                  <motion.button
                    key="cancel-btn"
                    initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    onClick={() => {
                      if (confirm("Stornovat fakturu?")) handleStatusChange("CANCELLED");
                    }}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-medium"
                  >
                    <Trash2 size={16} /> Storno
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
