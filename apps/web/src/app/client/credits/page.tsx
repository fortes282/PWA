"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { CreditCard, TrendingUp, TrendingDown, Plus, FileText, Receipt } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any>(url);

const PACKAGES = [
  { amount: 1200, label: "1 sezení", sessions: 1 },
  { amount: 3500, label: "3 sezení", sessions: 3 },
  { amount: 6500, label: "6 sezení", sessions: 6, highlight: true },
  { amount: 12000, label: "12 sezení", sessions: 12 },
];

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Nabití",
  USE: "Využití",
  REFUND: "Vrácení",
  ADJUSTMENT: "Úprava",
};

export default function ClientCredits() {
  const shouldReduce = useReducedMotion();
  const { data: balance } = useSWR("/credits/balance", fetcher);
  const { data: creditStats } = useSWR<any>("/credits/stats", fetcher);
  const [page, setPage] = useState(1);
  const { data: historyData, isLoading: historyLoading } = useSWR(
    `/credits/history?page=${page}&limit=20`,
    fetcher
  );
  const transactions: any[] = historyData?.items ?? [];
  const pagination = historyData?.pagination;
  const [showTopup, setShowTopup] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleTopupRequest = async (amount: number, label: string) => {
    haptics.success();
    await api.post("/credits/request", { amount, label });
    setRequestSent(true);
    setShowTopup(false);
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <motion.div
              initial={shouldReduce ? {} : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
              className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0"
            >
              <CreditCard size={20} className="text-primary dark:text-primary-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kredity</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Správa vašeho kreditního zůstatku</p>
            </div>
          </motion.div>

          {/* Balance card */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 360, damping: 28, delay: 0.05 }}
            className="card bg-gradient-to-r from-primary to-primary dark:from-primary dark:to-primary-800 text-white mb-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-primary-100 text-sm mb-1">Aktuální zůstatek</p>
                <motion.p
                  key={balance?.balance}
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26 }}
                  className="text-4xl font-bold"
                >
                  {balance ? formatCurrency(balance.balance) : "—"}
                </motion.p>
              </div>
              <motion.div
                initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.12 }}
              >
                <CreditCard size={48} className="text-primary-300" />
              </motion.div>
            </div>
          </motion.div>

          {/* Credit stats summary */}
          <AnimatePresence>
            {creditStats && (
              <motion.div
                key="stats"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 }}
                className="grid grid-cols-3 gap-3 mb-4"
              >
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                  className="card text-center py-3"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Celkem nabito</p>
                  <p className="text-base font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(creditStats.totalIn)}
                  </p>
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
                  className="card text-center py-3"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Celkem utraceno</p>
                  <p className="text-base font-bold text-red-500 dark:text-red-400">
                    {formatCurrency(creditStats.totalOut)}
                  </p>
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.18 }}
                  className="card text-center py-3"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Transakcí</p>
                  <p className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {creditStats.transactionCount}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Request sent confirmation */}
          <AnimatePresence>
            {requestSent && (
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -4, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm"
              >
                ✓ Žádost o nabití kreditů odeslána — recepce Vás kontaktuje.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top-up button / panel */}
          <div className="mb-6">
            <AnimatePresence mode="wait">
              {!showTopup ? (
                <motion.button
                  key="topup-btn"
                  initial={shouldReduce ? {} : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduce ? {} : { opacity: 0, scale: 0.95 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                onClick={() => { haptics.light(); setShowTopup(true); }}
                   data-testid="btn-topup-credits"
                   className="btn-primary flex items-center gap-2"
                 >
                   <Plus size={16} /> Nabít kredity
                 </motion.button>
              ) : (
                <motion.div
                  key="topup-panel"
                  initial={shouldReduce ? {} : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduce ? {} : { opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                  className="card border border-primary-200 dark:border-primary"
                >
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Vyberte balíček</h2>
                  <div data-testid="topup-panel" className="grid grid-cols-2 gap-3">
                    {PACKAGES.map((pkg, i) => (
                      <motion.button
                        key={pkg.amount}
                        data-testid={`btn-package-${pkg.sessions}`}
                        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                        whileTap={shouldReduce ? undefined : { scale: 0.94 }}
                        onClick={() => handleTopupRequest(pkg.amount, pkg.label)}
                        className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                          pkg.highlight
                            ? "border-primary-400 bg-primary-50 dark:border-primary dark:bg-primary-900/30"
                            : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary-200 dark:hover:border-primary"
                        }`}
                      >
                        <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">{pkg.label}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {pkg.amount.toLocaleString("cs-CZ")} Kč
                        </p>
                        {pkg.highlight && (
                          <motion.span
                            initial={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.2 }}
                            className="text-xs text-primary dark:text-primary-400 font-medium"
                          >
                            Populární
                          </motion.span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                  <motion.button
                    onClick={() => setShowTopup(false)}
                    className="mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    Zrušit
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Transactions section header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="flex items-center justify-between mb-3"
          >
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Historie transakcí</h2>
            {pagination && pagination.total > 0 && (
              <motion.p
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.15 }}
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                Celkem {pagination.total}
              </motion.p>
            )}
          </motion.div>

          {/* Transaction list */}
          <AnimatePresence mode="wait">
            {historyLoading && (
              <motion.div
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center py-10"
              >
                <motion.div
                  animate={shouldReduce ? {} : { rotate: 360 }}
                  transition={shouldReduce ? { duration: 0 } : { repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="rounded-full h-7 w-7 border-4 border-primary dark:border-primary-400 border-t-transparent"
                />
              </motion.div>
            )}

            {!historyLoading && transactions.length === 0 && (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                className="card text-center py-10"
              >
                <motion.div
                  initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 }}
                >
                  <img src="/brand/empty-credits.svg" alt="" className="w-32 h-32 mx-auto mb-4" aria-hidden="true" />
                </motion.div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Žádné transakce</p>
                <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">Zatím zde nejsou žádné transakce</p>
              </motion.div>
            )}

            {!historyLoading && transactions.length > 0 && (
              <motion.div
                key="list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {transactions.map((tx: any, i: number) => (
                  <motion.div
                    key={tx.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                    className="card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={shouldReduce ? {} : { scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.08 + i * 0.04 }}
                      >
                        {tx.amount > 0 ? (
                          <TrendingUp size={18} className="text-green-500 dark:text-green-400" />
                        ) : (
                          <TrendingDown size={18} className="text-red-500 dark:text-red-400" />
                        )}
                      </motion.div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {TYPE_LABELS[tx.type] ?? tx.type}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(tx.createdAt)}</p>
                        {tx.note && <p className="text-xs text-gray-500 dark:text-gray-400">{tx.note}</p>}
                      </div>
                    </div>
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 + i * 0.04 }}
                      className="text-right"
                    >
                      <p className={`font-bold text-sm ${tx.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Zůstatek: {formatCurrency(tx.balance)}
                      </p>
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pagination */}
          <AnimatePresence>
            {pagination && pagination.pages > 1 && (
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 6 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="flex items-center justify-center gap-3 mt-4"
              >
                <motion.button
                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  ← Předchozí
                </motion.button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {page} / {pagination.pages}
                </span>
                <motion.button
                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="btn-secondary text-sm disabled:opacity-40"
                >
                  Další →
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Finance hub — quick links */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.25 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6"
          >
            <a href="/client/invoices" className="card flex items-center gap-3 hover:ring-2 hover:ring-primary-400 transition-all">
              <Receipt size={20} className="text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Faktury</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Přehled a stažení</p>
              </div>
            </a>
            <a href="/client/credit-request" className="card flex items-center gap-3 hover:ring-2 hover:ring-primary-400 transition-all">
              <Plus size={20} className="text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Dobít kredit</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Požádat o nabití</p>
              </div>
            </a>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
