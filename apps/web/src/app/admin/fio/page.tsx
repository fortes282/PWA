"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Link2, Unlink, CheckCircle, AlertTriangle, Download } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const fetcher = (url: string) => api.get<any>(url);

const FILTER_LABELS: Record<string, string> = {
  ALL: "Vše",
  MATCHED: "Spárováno",
  UNMATCHED: "Nespárováno",
};

export default function AdminFio() {
  const shouldReduce = useReducedMotion();
  const { data: transactions, mutate } = useSWR<any[]>("/fio/transactions", fetcher as any);
  const { data: summary } = useSWR<any>("/fio/summary", fetcher);
  const { data: invoices } = useSWR<any[]>("/invoices", fetcher as any);

  const [filter, setFilter] = useState<"ALL" | "UNMATCHED" | "MATCHED">("ALL");
  const [showAdd, setShowAdd] = useState(false);
  const [matchingId, setMatchingId] = useState<number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");

  const [form, setForm] = useState({
    fioId: "", amount: "", currency: "CZK",
    variableSymbol: "", note: "", counterAccount: "", counterName: "", transactionDate: "",
  });
  const [saving, setSaving] = useState(false);

  const filtered = (transactions ?? []).filter((t: any) => {
    if (filter === "MATCHED") return t.isMatched;
    if (filter === "UNMATCHED") return !t.isMatched;
    return true;
  }).sort((a: any, b: any) => b.transactionDate.localeCompare(a.transactionDate));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/fio/transactions", {
        ...form,
        amount: parseFloat(form.amount),
      });
      setShowAdd(false);
      setForm({ fioId: "", amount: "", currency: "CZK", variableSymbol: "", note: "", counterAccount: "", counterName: "", transactionDate: "" });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const handleMatch = async (txId: number) => {
    if (!selectedInvoice) return;
    await api.patch(`/fio/transactions/${txId}/match`, { invoiceId: parseInt(selectedInvoice) });
    setMatchingId(null);
    setSelectedInvoice("");
    mutate();
  };

  const handleUnmatch = async (txId: number) => {
    await api.patch(`/fio/transactions/${txId}/unmatch`, {});
    mutate();
  };

  const unmatchedInvoices = (invoices ?? []).filter((inv: any) => inv.status !== "PAID");

  return (
    <RouteGuard allowedRoles={["ADMIN", "RECEPTION"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Platby a párování</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Párování bankovních transakcí s fakturami</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`${API_BASE}/fio/export/csv`}
                download
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Exportovat do CSV"
              >
                <Download size={15} /> CSV export
              </a>
              <motion.button
                onClick={() => setShowAdd(true)}
                className="btn-primary flex items-center gap-2"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <Plus size={16} /> Přidat transakci
              </motion.button>
            </div>
          </motion.div>

          {/* Summary */}
          <AnimatePresence>
            {summary && (
              <motion.div
                key="summary"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
              >
                {[
                  { value: summary.totalTransactions, label: "Celkem transakcí", color: "text-gray-900 dark:text-gray-100" },
                  { value: summary.matchedCount, label: "Spárováno", color: "text-green-600 dark:text-green-400" },
                  { value: summary.unmatchedCount, label: "Nespárováno", color: "text-yellow-600 dark:text-yellow-400" },
                  { value: formatCurrency(summary.totalAmount), label: "Celkový objem", color: "text-primary dark:text-primary-400" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 + i * 0.04 }}
                    className="card text-center"
                  >
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div
                key="add-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-6 border border-primary-200 dark:border-primary-800"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Přidat transakci</h2>
                <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">FIO ID</label>
                    <input type="text" required value={form.fioId} onChange={(e) => setForm({ ...form, fioId: e.target.value })} className="input" placeholder="12345678" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Částka (Kč)</label>
                    <input type="number" required step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Datum transakce</label>
                    <input type="date" required value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Variabilní symbol</label>
                    <input type="text" value={form.variableSymbol} onChange={(e) => setForm({ ...form, variableSymbol: e.target.value })} className="input" placeholder="INV-..." />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Protiúčet</label>
                    <input type="text" value={form.counterAccount} onChange={(e) => setForm({ ...form, counterAccount: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Majitel protiúčtu</label>
                    <input type="text" value={form.counterName} onChange={(e) => setForm({ ...form, counterName: e.target.value })} className="input" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Poznámka</label>
                    <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
                  </div>
                  <div className="col-span-2 flex gap-3 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="btn-secondary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      Zrušit
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={saving}
                      className="btn-primary"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      {saving ? "Ukládám…" : "Přidat"}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter tabs */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit"
          >
            {(["ALL", "UNMATCHED", "MATCHED"] as const).map((f) => (
              <motion.button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                {FILTER_LABELS[f]}
              </motion.button>
            ))}
          </motion.div>

          {/* Transactions */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card text-center text-gray-500 dark:text-gray-400 py-10"
              >
                Žádné transakce
              </motion.div>
            )}
            {filtered.map((t: any, i: number) => (
              <motion.div
                key={t.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.03 }}
                className={`card ${!t.isMatched ? "border-l-4 border-l-yellow-400" : "border-l-4 border-l-green-400"}`}
              >
                <AnimatePresence mode="wait">
                  {matchingId === t.id ? (
                    <motion.div
                      key="matching"
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex gap-3 items-end"
                    >
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Vyberte fakturu pro spárování</label>
                        <select
                          value={selectedInvoice}
                          onChange={(e) => setSelectedInvoice(e.target.value)}
                          className="input"
                        >
                          <option value="">-- vyberte fakturu --</option>
                          {unmatchedInvoices.map((inv: any) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.invoiceNumber} — {formatCurrency(inv.total)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <motion.button
                        onClick={() => handleMatch(t.id)}
                        disabled={!selectedInvoice}
                        className="btn-primary"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      >
                        Spárovat
                      </motion.button>
                      <motion.button
                        onClick={() => setMatchingId(null)}
                        className="btn-secondary"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      >
                        Zrušit
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="view"
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-start justify-between gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {t.isMatched
                            ? <CheckCircle size={14} className="text-green-500" />
                            : <AlertTriangle size={14} className="text-yellow-500" />
                          }
                          <span className="text-xs text-gray-500 dark:text-gray-400">FIO: {t.fioId}</span>
                          {t.variableSymbol && (
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                              VS: {t.variableSymbol}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{formatCurrency(t.amount)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(t.transactionDate)}
                          {t.counterName ? ` · ${t.counterName}` : ""}
                          {t.note ? ` · ${t.note}` : ""}
                        </p>
                        {t.isMatched && t.matchedInvoice && (
                          <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                            ✓ Spárováno s fakturou {t.matchedInvoice.invoiceNumber}
                            {t.matchedClientName ? ` (${t.matchedClientName})` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {!t.isMatched ? (
                          <motion.button
                            onClick={() => setMatchingId(t.id)}
                            className="btn-primary text-xs py-1 flex items-center gap-1"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          >
                            <Link2 size={12} /> Spárovat
                          </motion.button>
                        ) : (
                          <motion.button
                            onClick={() => handleUnmatch(t.id)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 flex items-center gap-1"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          >
                            <Unlink size={12} /> Odspárovat
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
