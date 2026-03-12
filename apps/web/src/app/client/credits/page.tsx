"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { CreditCard, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

const PACKAGES = [
  { amount: 1200, label: "1 sezení", sessions: 1 },
  { amount: 3500, label: "3 sezení", sessions: 3 },
  { amount: 6500, label: "6 sezení", sessions: 6, highlight: true },
  { amount: 12000, label: "12 sezení", sessions: 12 },
];

export default function ClientCredits() {
  const { data: balance } = useSWR("/credits/balance", fetcher);
  const { data: transactions } = useSWR("/credits/transactions", fetcher);
  const [showTopup, setShowTopup] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleTopupRequest = async (amount: number, label: string) => {
    // Send request to reception via notification (no direct payment integration)
    await api.post("/credits/request", { amount, label });
    setRequestSent(true);
    setShowTopup(false);
  };

  const TYPE_LABELS: Record<string, string> = {
    PURCHASE: "Nabití",
    USE: "Využití",
    REFUND: "Vrácení",
    ADJUSTMENT: "Úprava",
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Kredity</h1>

          {/* Balance card */}
          <div className="card bg-gradient-to-r from-primary-600 to-primary-700 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm mb-1">Aktuální zůstatek</p>
                <p className="text-4xl font-bold">
                  {balance ? formatCurrency(balance.balance) : "—"}
                </p>
              </div>
              <CreditCard size={48} className="text-primary-300" />
            </div>
          </div>

          {/* Topup request */}
          {requestSent && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
              ✓ Žádost o nabití kreditů odeslána — recepce Vás kontaktuje.
            </div>
          )}

          <div className="mb-6">
            {!showTopup ? (
              <button onClick={() => setShowTopup(true)} className="btn-primary flex items-center gap-2">
                <Plus size={16} /> Nabít kredity
              </button>
            ) : (
              <div className="card border border-primary-200">
                <h2 className="font-semibold text-gray-900 mb-4">Vyberte balíček</h2>
                <div className="grid grid-cols-2 gap-3">
                  {PACKAGES.map((pkg) => (
                    <button
                      key={pkg.amount}
                      onClick={() => handleTopupRequest(pkg.amount, pkg.label)}
                      className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                        pkg.highlight
                          ? "border-primary-400 bg-primary-50"
                          : "border-gray-200 bg-white hover:border-primary-200"
                      }`}
                    >
                      <p className="font-bold text-gray-900 text-lg">{pkg.label}</p>
                      <p className="text-sm text-gray-500">{pkg.amount.toLocaleString("cs-CZ")} Kč</p>
                      {pkg.highlight && <span className="text-xs text-primary-600 font-medium">Populární</span>}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowTopup(false)} className="mt-3 text-sm text-gray-400 hover:text-gray-600">
                  Zrušit
                </button>
              </div>
            )}
          </div>

          {/* Transactions */}
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Historie transakcí</h2>
          <div className="space-y-2">
            {transactions?.map((tx: any) => (
              <div key={tx.id} className="card flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {tx.amount > 0 ? (
                    <TrendingUp size={18} className="text-green-500" />
                  ) : (
                    <TrendingDown size={18} className="text-red-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{TYPE_LABELS[tx.type] ?? tx.type}</p>
                    <p className="text-xs text-gray-400">{formatDateTime(tx.createdAt)}</p>
                    {tx.note && <p className="text-xs text-gray-400">{tx.note}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-xs text-gray-400">Zůstatek: {formatCurrency(tx.balance)}</p>
                </div>
              </div>
            ))}
            {transactions?.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">Žádné transakce</p>
            )}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
