"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Link2, Unlink, CheckCircle, AlertTriangle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminFio() {
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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FIO Bank matching</h1>
              <p className="text-sm text-gray-400 mt-1">Párování bankovních transakcí s fakturami</p>
            </div>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Přidat transakci
            </button>
          </div>

          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card text-center">
                <p className="text-2xl font-bold text-gray-900">{summary.totalTransactions}</p>
                <p className="text-xs text-gray-500 mt-1">Celkem transakcí</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-green-600">{summary.matchedCount}</p>
                <p className="text-xs text-gray-500 mt-1">Spárováno</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-yellow-600">{summary.unmatchedCount}</p>
                <p className="text-xs text-gray-500 mt-1">Nespárováno</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-primary-600">{formatCurrency(summary.totalAmount)}</p>
                <p className="text-xs text-gray-500 mt-1">Celkový objem</p>
              </div>
            </div>
          )}

          {/* Add form */}
          {showAdd && (
            <div className="card mb-6 border border-primary-200">
              <h2 className="font-semibold text-gray-900 mb-4">Přidat transakci</h2>
              <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">FIO ID</label>
                  <input type="text" required value={form.fioId} onChange={(e) => setForm({ ...form, fioId: e.target.value })} className="input" placeholder="12345678" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Částka (Kč)</label>
                  <input type="number" required step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Datum transakce</label>
                  <input type="date" required value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Variabilní symbol</label>
                  <input type="text" value={form.variableSymbol} onChange={(e) => setForm({ ...form, variableSymbol: e.target.value })} className="input" placeholder="INV-..." />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Protiúčet</label>
                  <input type="text" value={form.counterAccount} onChange={(e) => setForm({ ...form, counterAccount: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Majitel protiúčtu</label>
                  <input type="text" value={form.counterName} onChange={(e) => setForm({ ...form, counterName: e.target.value })} className="input" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Poznámka</label>
                  <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
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
            {(["ALL", "UNMATCHED", "MATCHED"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "ALL" ? "Vše" : f === "MATCHED" ? "Spárováno" : "Nespárováno"}
              </button>
            ))}
          </div>

          {/* Transactions */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-400 py-10">Žádné transakce</div>
            )}
            {filtered.map((t: any) => (
              <div key={t.id} className={`card ${!t.isMatched ? "border-l-4 border-l-yellow-400" : "border-l-4 border-l-green-400"}`}>
                {matchingId === t.id ? (
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Vyberte fakturu pro spárování</label>
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
                    <button onClick={() => handleMatch(t.id)} disabled={!selectedInvoice} className="btn-primary">Spárovat</button>
                    <button onClick={() => setMatchingId(null)} className="btn-secondary">Zrušit</button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {t.isMatched
                          ? <CheckCircle size={14} className="text-green-500" />
                          : <AlertTriangle size={14} className="text-yellow-500" />
                        }
                        <span className="text-xs text-gray-400">FIO: {t.fioId}</span>
                        {t.variableSymbol && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">VS: {t.variableSymbol}</span>
                        )}
                      </div>
                      <p className="font-bold text-gray-900 text-lg">{formatCurrency(t.amount)}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(t.transactionDate)}
                        {t.counterName ? ` · ${t.counterName}` : ""}
                        {t.note ? ` · ${t.note}` : ""}
                      </p>
                      {t.isMatched && t.matchedInvoice && (
                        <p className="text-xs text-green-700 mt-1">
                          ✓ Spárováno s fakturou {t.matchedInvoice.invoiceNumber}
                          {t.matchedClientName ? ` (${t.matchedClientName})` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!t.isMatched ? (
                        <button
                          onClick={() => setMatchingId(t.id)}
                          className="btn-primary text-xs py-1 flex items-center gap-1"
                        >
                          <Link2 size={12} /> Spárovat
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnmatch(t.id)}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded border border-gray-200 flex items-center gap-1"
                        >
                          <Unlink size={12} /> Odspárovat
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
