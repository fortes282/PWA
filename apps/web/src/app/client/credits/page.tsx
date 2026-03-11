"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { CreditCard, TrendingUp, TrendingDown } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientCredits() {
  const { data: balance } = useSWR("/credits/balance", fetcher);
  const { data: transactions } = useSWR("/credits/transactions", fetcher);

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
