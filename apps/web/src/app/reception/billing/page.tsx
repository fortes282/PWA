"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Download, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

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
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default function ReceptionBilling() {
  const { data: invoices, mutate } = useSWR("/invoices", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);

  const [filterStatus, setFilterStatus] = useState("ALL");
  const [showNew, setShowNew] = useState(false);
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
    await api.patch(`/invoices/${id}/status`, { status });
    mutate();
  };

  const handleDownloadPdf = (id: number) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    window.open(`${API_BASE}/pdf/invoice/${id}`, "_blank");
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { description: "", quantity: "1", unitPrice: "" }] });
  };

  const removeItem = (i: number) => {
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
            <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nová faktura
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(paid)}</p>
              <p className="text-xs text-gray-500 mt-1">Zaplaceno</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-yellow-600">{pending}</p>
              <p className="text-xs text-gray-500 mt-1">Čeká na platbu</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-red-500">{overdue}</p>
              <p className="text-xs text-gray-500 mt-1">Po splatnosti</p>
            </div>
          </div>

          {/* New invoice form */}
          {showNew && (
            <div className="card mb-6 border border-primary-200">
              <h2 className="font-semibold text-gray-900 mb-4">Nová faktura</h2>
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
                          <button
                            type="button"
                            onClick={() => removeItem(i)}
                            className="text-red-400 hover:text-red-600 px-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      + Přidat položku
                    </button>
                  </div>
                  <p className="text-right text-sm font-semibold mt-2">
                    Celkem: {formatCurrency(total)}
                  </p>
                </div>

                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">Zrušit</button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Ukládám…" : "Vytvořit fakturu"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Filter */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
            {["ALL", "DRAFT", "SENT", "PAID", "OVERDUE"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterStatus === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "ALL" ? "Vše" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Invoice list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-400 py-10">Žádné faktury</div>
            )}
            {filtered.map((inv: any) => (
              <div key={inv.id} className="card">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[inv.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </span>
                      <span className="text-xs text-gray-400">{inv.invoiceNumber}</span>
                    </div>
                    <p className="font-medium text-gray-900">
                      {clientMap[inv.clientId] ?? `Klient #${inv.clientId}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(inv.total)} · Splatnost: {formatDate(inv.dueDate)}
                      {inv.paidAt ? ` · Zaplaceno: ${formatDate(inv.paidAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <Link
                      href={`/reception/invoices/${inv.id}`}
                      className="btn-secondary text-xs py-1 flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Detail
                    </Link>
                    <button
                      onClick={() => handleDownloadPdf(inv.id)}
                      className="btn-secondary text-xs py-1 flex items-center gap-1"
                      title="Stáhnout PDF"
                    >
                      <Download size={12} /> PDF
                    </button>
                    {inv.status === "DRAFT" && (
                      <button
                        onClick={() => handleStatusChange(inv.id, "SENT")}
                        className="btn-secondary text-xs py-1"
                      >
                        Odeslat
                      </button>
                    )}
                    {["DRAFT", "SENT", "OVERDUE"].includes(inv.status) && (
                      <button
                        onClick={() => handleStatusChange(inv.id, "PAID")}
                        className="btn-primary text-xs py-1 flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Zaplaceno
                      </button>
                    )}
                    {inv.status === "SENT" && (
                      <button
                        onClick={() => handleStatusChange(inv.id, "OVERDUE")}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200"
                      >
                        Po splatnosti
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
