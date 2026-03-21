"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { FileText, Download, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer, listItem } from "@/lib/motion";

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
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "PAID") return <CheckCircle size={16} className="text-green-500" />;
  if (status === "OVERDUE") return <AlertTriangle size={16} className="text-red-500" />;
  return <Clock size={16} className="text-yellow-500" />;
}

export default function ClientInvoices() {
  const shouldReduceMotion = useReducedMotion();
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
          <div className="flex items-center gap-3 mb-6">
            <FileText size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">Moje faktury</h1>
          </div>

          {/* Summary */}
          {invoices && invoices.length > 0 && (
            <motion.div
              className="grid grid-cols-2 gap-4 mb-6"
              variants={staggerContainer}
              initial={shouldReduceMotion ? "visible" : "hidden"}
              animate="visible"
            >
              <motion.div variants={listItem} className="card border border-green-100">
                <p className="text-xs text-gray-500 mb-1">Zaplaceno celkem</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
              </motion.div>
              <motion.div variants={listItem} className="card border border-yellow-100">
                <p className="text-xs text-gray-500 mb-1">K úhradě</p>
                <p className="text-xl font-bold text-yellow-600">{formatCurrency(totalUnpaid)}</p>
              </motion.div>
            </motion.div>
          )}

          {/* Invoice list */}
          {isLoading && (
            <div className="text-center text-gray-500 py-8 text-sm">Načítám faktury…</div>
          )}

          {!isLoading && sorted.length === 0 && (
            <div className="card text-center py-10">
              <FileText size={36} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm">Zatím žádné faktury</p>
            </div>
          )}

          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
          >
            {sorted.map((inv) => (
              <motion.div key={inv.id} variants={listItem} className="card flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <StatusIcon status={inv.status} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{inv.invoiceNumber}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Vystaveno: {formatDate(inv.createdAt)}
                      {inv.dueDate && ` · Splatnost: ${formatDate(inv.dueDate)}`}
                    </p>
                    {inv.notes && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{inv.notes}</p>
                    )}
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1.5 font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="font-bold text-gray-900 text-sm">{formatCurrency(inv.total)}</p>
                  <a
                    href={`${API_BASE}/pdf/invoice/${inv.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Stáhnout PDF"
                  >
                    <Download size={16} />
                  </a>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
