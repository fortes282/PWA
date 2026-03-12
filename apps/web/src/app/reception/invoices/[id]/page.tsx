"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
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
  CANCELLED: "bg-gray-100 text-gray-400",
};

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, mutate } = useSWR<any>(`/invoices/${id}`, fetcher);
  const { data: clients } = useSWR<any[]>("/users?role=CLIENT", fetcher as any);
  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c]));
  const client = invoice ? clientMap[invoice.clientId] : null;

  const handleStatusChange = async (status: string) => {
    await api.patch(`/invoices/${id}/status`, { status });
    mutate();
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await api.patch(`/invoices/${id}/notes`, { notes });
      await mutate();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  if (!invoice) {
    return (
      <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
        <Layout>
          <div className="max-w-3xl mx-auto">
            <div className="card text-center text-gray-400 py-12">Načítám fakturu…</div>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <Link
            href="/reception/billing"
            className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-4"
          >
            <ArrowLeft size={14} /> Zpět na billing
          </Link>

          {/* Header */}
          <div className="card mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge ${STATUS_COLORS[invoice.status] ?? ""}`}>
                    {STATUS_LABELS[invoice.status] ?? invoice.status}
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{invoice.invoiceNumber}</h1>
                <p className="text-gray-500 mt-1">
                  Klient: <span className="font-medium text-gray-900">{client?.name ?? `#${invoice.clientId}`}</span>
                </p>
                {client?.email && <p className="text-sm text-gray-400">{client.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(invoice.total)}</p>
                <p className="text-sm text-gray-500 mt-1">Splatnost: {formatDate(invoice.dueDate)}</p>
                {invoice.paidAt && (
                  <p className="text-xs text-green-600 mt-0.5">Zaplaceno: {formatDate(invoice.paidAt)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Položky</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Popis</th>
                    <th className="pb-2 font-medium text-right">Počet</th>
                    <th className="pb-2 font-medium text-right">Cena/ks</th>
                    <th className="pb-2 font-medium text-right">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items ?? []).map((item: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 text-gray-900">{item.description}</td>
                      <td className="py-2 text-right text-gray-600">{item.quantity}</td>
                      <td className="py-2 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-3 text-right font-bold text-gray-700">Celkem</td>
                    <td className="pt-3 text-right font-bold text-lg text-gray-900">{formatCurrency(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Poznámka</h2>
              {!editMode && (
                <button onClick={() => { setNotes(invoice.notes ?? ""); setEditMode(true); }} className="text-xs text-primary-600 hover:text-primary-800">
                  Upravit
                </button>
              )}
            </div>
            {editMode ? (
              <div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input min-h-[80px] mb-3"
                  placeholder="Poznámka k faktuře…"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveNotes} disabled={saving} className="btn-primary text-sm">
                    {saving ? "Ukládám…" : "Uložit"}
                  </button>
                  <button onClick={() => setEditMode(false)} className="btn-secondary text-sm">Zrušit</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                {invoice.notes || <span className="text-gray-400 italic">Žádná poznámka</span>}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Akce</h2>
            <div className="flex flex-wrap gap-3">
              <a
                href={`${API_BASE}/pdf/invoice/${id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center gap-2"
              >
                <Download size={16} /> Stáhnout PDF
              </a>

              {invoice.status === "DRAFT" && (
                <button
                  onClick={() => handleStatusChange("SENT")}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Send size={16} /> Označit jako odesláno
                </button>
              )}

              {["DRAFT", "SENT", "OVERDUE"].includes(invoice.status) && (
                <button
                  onClick={() => handleStatusChange("PAID")}
                  className="btn-primary flex items-center gap-2"
                >
                  <CheckCircle size={16} /> Označit jako zaplaceno
                </button>
              )}

              {invoice.status === "SENT" && (
                <button
                  onClick={() => handleStatusChange("OVERDUE")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium"
                >
                  Po splatnosti
                </button>
              )}

              {["DRAFT", "SENT"].includes(invoice.status) && (
                <button
                  onClick={() => {
                    if (confirm("Stornovat fakturu?")) handleStatusChange("CANCELLED");
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-medium"
                >
                  <Trash2 size={16} /> Storno
                </button>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
