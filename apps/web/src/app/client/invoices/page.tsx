"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { FileText, Download, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Koncept",
  SENT: "Odesláno",
  PAID: "Zaplaceno",
  OVERDUE: "Po splatnosti",
  CANCELLED: "Storno",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  SENT: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
  PAID: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  OVERDUE: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  CANCELLED: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "PAID") return <CheckCircle size={16} className="text-green-500 dark:text-green-400 shrink-0" />;
  if (status === "OVERDUE") return <AlertTriangle size={16} className="text-red-500 dark:text-red-400 shrink-0" />;
  return <Clock size={16} className="text-yellow-500 dark:text-yellow-400 shrink-0" />;
}

export default function ClientInvoices() {
  const shouldReduce = useReducedMotion();
  const { data: invoices, isLoading } = useSWR<any[]>("/invoices", fetcher as any);

  const sorted = [...(invoices ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const totalPaid = sorted.filter((i) => i.status === "PAID").reduce((s, i) => s + i.total, 0);
  const totalUnpaid = sorted.filter((i) => ["SENT", "DRAFT"].includes(i.status)).reduce((s, i) => s + i.total, 0);

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
            >
              <FileText size={26} className="text-primary-600 dark:text-primary-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moje faktury</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Přehled vašich faktur a plateb</p>
            </div>
          </motion.div>

          {/* Summary cards */}
          <AnimatePresence>
            {!isLoading && sorted.length > 0 && (
              <motion.div
                key="summary"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                className="grid grid-cols-2 gap-4 mb-6"
              >
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                  className="card border border-green-200 dark:border-green-800"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Zaplaceno celkem</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.13 }}
                  className="card border border-yellow-200 dark:border-yellow-800"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">K úhradě</p>
                  <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(totalUnpaid)}</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* Loading */}
            {isLoading && (
              <motion.div
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center py-12"
              >
                <motion.div
                  animate={shouldReduce ? {} : { rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="rounded-full h-8 w-8 border-4 border-primary-600 dark:border-primary-400 border-t-transparent"
                />
              </motion.div>
            )}

            {/* Empty state */}
            {!isLoading && sorted.length === 0 && (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                className="card text-center py-12"
              >
                <motion.div
                  initial={shouldReduce ? {} : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 }}
                >
                  <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-400 mb-3" />
                </motion.div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Zatím žádné faktury</p>
                <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">Faktury se zobrazí po první platbě</p>
              </motion.div>
            )}

            {/* Invoice list */}
            {!isLoading && sorted.length > 0 && (
              <motion.div
                key="list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {sorted.map((inv, i) => (
                  <motion.div
                    key={inv.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.06 + i * 0.05 }}
                    className="card flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <motion.div
                        initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 + i * 0.05 }}
                        className="mt-0.5"
                      >
                        <StatusIcon status={inv.status} />
                      </motion.div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{inv.invoiceNumber}</p>
                        <motion.p
                          initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 + i * 0.05 }}
                          className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                        >
                          Vystaveno: {formatDate(inv.createdAt)}
                          {inv.dueDate && ` · Splatnost: ${formatDate(inv.dueDate)}`}
                        </motion.p>
                        {inv.notes && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{inv.notes}</p>
                        )}
                        <motion.span
                          initial={shouldReduce ? {} : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.15 + i * 0.05 }}
                          className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1.5 font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"}`}
                        >
                          {STATUS_LABELS[inv.status] ?? inv.status}
                        </motion.span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <motion.p
                        initial={shouldReduce ? {} : { opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 + i * 0.05 }}
                        className="font-bold text-gray-900 dark:text-gray-100 text-sm"
                      >
                        {formatCurrency(inv.total)}
                      </motion.p>
                      <motion.a
                        href={`${API_BASE}/pdf/invoice/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        title="Stáhnout PDF"
                        whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        <Download size={16} />
                      </motion.a>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
