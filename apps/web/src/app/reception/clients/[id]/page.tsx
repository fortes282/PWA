"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Calendar, User } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  CANCELLED: "Zrušeno",
  COMPLETED: "Dokončeno",
  NO_SHOW: "Nedostavil se",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "badge-yellow",
  CONFIRMED: "badge-blue",
  CANCELLED: "badge-red",
  COMPLETED: "badge-green",
  NO_SHOW: "badge-gray",
};

export default function ReceptionClientDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: client } = useSWR<any>(`/users/${id}`, fetcher);
  const { data: appointments } = useSWR<any[]>(`/appointments?clientId=${id}`, fetcher);
  const { data: balance, mutate: mutateBalance } = useSWR<{ balance: number; userId: number }>(`/credits/balance/${id}`, fetcher);
  const { data: transactions, mutate: mutateTransactions } = useSWR<any[]>(`/credits/transactions?userId=${id}`, fetcher);

  const [quickCredit, setQuickCredit] = useState<string>("");
  const [creditNote, setCreditNote] = useState<string>("");
  const [addingCredit, setAddingCredit] = useState(false);

  const handleQuickCredit = async () => {
    if (!quickCredit) return;
    setAddingCredit(true);
    try {
      await api.post("/credits/adjust", {
        userId: parseInt(id),
        amount: parseFloat(quickCredit),
        type: parseFloat(quickCredit) > 0 ? "PURCHASE" : "ADJUSTMENT",
        note: creditNote || undefined,
      });
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
          <Link href="/reception/clients" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-4">
            <ArrowLeft size={14} /> Zpět na klienty
          </Link>

          {client ? (
            <>
              {/* Client header */}
              <div className="card mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
                    <User size={24} className="text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
                    <p className="text-sm text-gray-500">{client.email}</p>
                    {client.phone && <p className="text-sm text-gray-400">{client.phone}</p>}
                  </div>
                  <div className="text-right">
                    <span className={`badge ${client.isActive ? "badge-green" : "badge-red"}`}>
                      {client.isActive ? "Aktivní" : "Neaktivní"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card">
                  <p className="text-xs text-gray-400 mb-1">Behavior score</p>
                  <p className={`text-2xl font-bold ${
                    client.behaviorScore >= 80 ? "text-green-600" :
                    client.behaviorScore >= 50 ? "text-yellow-600" : "text-red-600"
                  }`}>
                    {client.behaviorScore?.toFixed(0)}/100
                  </p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-1 mb-1">
                    <CreditCard size={14} className="text-gray-400" />
                    <p className="text-xs text-gray-400">Kredit</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {balance ? formatCurrency(balance.balance) : "—"}
                  </p>
                </div>
                <div className="card">
                  <div className="flex items-center gap-1 mb-1">
                    <Calendar size={14} className="text-gray-400" />
                    <p className="text-xs text-gray-400">Nadcházející</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{upcoming?.length ?? 0}</p>
                </div>
              </div>

              {/* Upcoming appointments */}
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Nadcházející termíny</h2>
                {upcoming && upcoming.length > 0 ? (
                  <div className="space-y-2">
                    {upcoming.map((a) => (
                      <div key={a.id} className="card flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{formatDateTime(a.startTime)}</p>
                          <p className="text-xs text-gray-400">
                            {a.price ? formatCurrency(a.price) : ""}
                          </p>
                        </div>
                        <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Žádné nadcházející termíny</p>
                )}
              </section>

              {/* Past appointments */}
              <section className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Minulé termíny</h2>
                {past && past.length > 0 ? (
                  <div className="space-y-2">
                    {past.slice(0, 10).map((a) => (
                      <div key={a.id} className="card flex items-center justify-between opacity-60">
                        <div>
                          <p className="font-medium text-sm">{formatDateTime(a.startTime)}</p>
                          <p className="text-xs text-gray-400">
                            {a.price ? formatCurrency(a.price) : ""}
                          </p>
                        </div>
                        <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Žádné minulé termíny</p>
                )}
              </section>

              {/* Quick credit add */}
              <section className="mb-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Přidat/odebrat kredit</h2>
                <div className="card flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Částka (+ nabití, − odečtení)</label>
                    <input
                      type="number"
                      value={quickCredit}
                      onChange={(e) => setQuickCredit(e.target.value)}
                      className="input text-sm"
                      placeholder="1200 nebo -500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Poznámka</label>
                    <input
                      type="text"
                      value={creditNote}
                      onChange={(e) => setCreditNote(e.target.value)}
                      className="input text-sm"
                      placeholder="Volitelně"
                    />
                  </div>
                  <button
                    onClick={handleQuickCredit}
                    disabled={!quickCredit || addingCredit}
                    className="btn-primary text-sm"
                  >
                    {addingCredit ? "…" : "Uložit"}
                  </button>
                </div>
              </section>

              {/* Credit history */}
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Kreditní transakce</h2>
                {transactions && transactions.length > 0 ? (
                  <div className="space-y-2">
                    {transactions.map((tx: any) => (
                      <div key={tx.id} className="card flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{tx.type}</p>
                          <p className="text-xs text-gray-400">{formatDateTime(tx.createdAt)}</p>
                          {tx.note && <p className="text-xs text-gray-400">{tx.note}</p>}
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                          </p>
                          <p className="text-xs text-gray-400">Zůstatek: {formatCurrency(tx.balance)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Žádné transakce</p>
                )}
              </section>
            </>
          ) : (
            <p className="text-gray-400 text-center py-8">Načítání…</p>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
