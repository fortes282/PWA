"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, CreditCard, Clock, CheckCircle, XCircle, Trash2 } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Čeká na schválení",
  APPROVED: "Schváleno",
  REJECTED: "Zamítnuto",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  PENDING: <Clock size={14} className="inline mr-1" />,
  APPROVED: <CheckCircle size={14} className="inline mr-1" />,
  REJECTED: <XCircle size={14} className="inline mr-1" />,
};

export default function ClientCreditRequest() {
  const { data: requests, mutate } = useSWR("/credit-requests", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || amt > 10_000) {
      setError("Zadejte částku mezi 1 a 10 000.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/credit-requests", { amount: amt, note: note || undefined });
      setSuccess("Žádost odeslána. Recepce ji zpracuje co nejdříve.");
      setAmount("");
      setNote("");
      setShowForm(false);
      mutate();
    } catch {
      setError("Nepodařilo se odeslat žádost. Zkuste to znovu.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Zrušit tuto žádost?")) return;
    try {
      await api.delete(`/credit-requests/${id}`);
      mutate();
    } catch {
      // ignore
    }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Žádost o kredit</h1>
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nová žádost
            </button>
          </div>

          <div className="card mb-4 p-4 bg-blue-50 border border-blue-200 text-sm text-blue-700">
            <strong>Jak to funguje:</strong> Požádejte recepci o navýšení kreditu. Po schválení bude
            kredit automaticky připsán na váš účet.
          </div>

          {success && (
            <div className="card mb-4 p-4 bg-green-50 border border-green-200 text-sm text-green-700">
              {success}
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Nová žádost o kredit</h2>
              <div>
                <label className="label">Požadovaný kredit (Kč)</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="např. 500"
                  required
                />
              </div>
              <div>
                <label className="label">Poznámka (volitelné)</label>
                <textarea
                  className="input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Důvod žádosti nebo doplňující informace…"
                  rows={3}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Odesílám…" : "Odeslat žádost"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setError(""); }}>
                  Zrušit
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {(!requests || requests.length === 0) && (
              <div className="card text-center text-gray-400 py-10">
                Zatím žádné žádosti. Klikněte na &bdquo;Nová žádost&ldquo; pro podání.
              </div>
            )}
            {requests?.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CreditCard size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{r.amount} Kč</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status]}`}>
                          {STATUS_ICON[r.status]}{STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.createdAt)}</p>
                      {r.note && <p className="text-sm text-gray-600 mt-1">{r.note}</p>}
                      {r.reviewNote && (
                        <p className="text-sm text-gray-500 mt-1 italic">
                          Vyjádření recepce: {r.reviewNote}
                        </p>
                      )}
                    </div>
                  </div>
                  {r.status === "PENDING" && (
                    <button
                      onClick={() => handleCancel(r.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Zrušit žádost"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
