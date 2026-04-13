"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState } from "react";
import { CreditCard, CheckCircle, XCircle, Filter } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Čeká",
  APPROVED: "Schváleno",
  REJECTED: "Zamítnuto",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function CreditRequestsReception() {
  const shouldReduce = useReducedMotion();
  const { data: requests, mutate } = useSWR("/credit-requests", fetcher);

  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<number | null>(null);

  const filtered = (requests ?? []).filter(
    (r: any) => filterStatus === "ALL" || r.status === filterStatus
  );

  const handleAction = async (id: number, action: "APPROVED" | "REJECTED") => {
    haptics.medium();
    setProcessing(id);
    try {
      await api.patch(`/credit-requests/${id}`, {
        action,
        reviewNote: reviewNote[id] || undefined,
      });
      haptics.success();
      setReviewNote((n) => { const c = { ...n }; delete c[id]; return c; });
      mutate();
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = (requests ?? []).filter((r: any) => r.status === "PENDING").length;

  return (
    <RouteGuard allowedRoles={["ADMIN", "RECEPTION"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Žádosti o kredit</h1>
              <AnimatePresence>
                {pendingCount > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}
                    className="text-sm text-yellow-700 mt-0.5"
                  >
                    {pendingCount} žádost{pendingCount === 1 ? "" : pendingCount < 5 ? "y" : "í"} čeká na zpracování
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-500" />
              <select
                data-testid="select-filter-status"
                className="input text-sm py-1 w-36"
                value={filterStatus}
                onChange={(e) => { haptics.light(); setFilterStatus(e.target.value); }}
              >
                <option value="ALL">Vše</option>
                <option value="PENDING">Čeká</option>
                <option value="APPROVED">Schváleno</option>
                <option value="REJECTED">Zamítnuto</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <AnimatePresence>
              {filtered.length === 0 && (
                <motion.div
                  key="empty"
                  initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="card text-center text-gray-500 dark:text-gray-400 py-10"
                >
                  Žádné žádosti {filterStatus !== "ALL" ? `se stavem „${STATUS_LABEL[filterStatus]}"` : ""}.
                </motion.div>
              )}
            </AnimatePresence>

            {filtered.map((r: any, i: number) => (
              <motion.div
                key={r.id}
                data-testid={`credit-request-${r.id}`}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                layout
                className="card"
              >
                <div className="flex items-start gap-3">
                  <CreditCard size={20} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{r.amount} Kč</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{r.clientName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{r.clientEmail} · {formatDate(r.createdAt)}</p>
                    {r.note && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">&bdquo;{r.note}&ldquo;</p>}
                    {r.reviewNote && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">Poznámka: {r.reviewNote}</p>
                    )}

                    <AnimatePresence>
                      {r.status === "PENDING" && (
                        <motion.div
                          key={`pending-${r.id}`}
                          initial={shouldReduce ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="mt-3 space-y-2 overflow-hidden"
                        >
                          <input
                            data-testid={`input-review-note-${r.id}`}
                            className="input text-sm py-1"
                            placeholder="Poznámka k rozhodnutí (volitelné)…"
                            value={reviewNote[r.id] ?? ""}
                            onChange={(e) =>
                              setReviewNote((n) => ({ ...n, [r.id]: e.target.value }))
                            }
                          />
                          <div className="flex gap-2">
                            <motion.button
                              data-testid={`btn-approve-${r.id}`}
                              className="btn-primary text-sm py-1.5 flex items-center gap-1 disabled:opacity-50"
                              disabled={processing === r.id}
                              onClick={() => handleAction(r.id, "APPROVED")}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            >
                              <CheckCircle size={14} />
                              {processing === r.id ? "Zpracovávám…" : "Schválit"}
                            </motion.button>
                            <motion.button
                              data-testid={`btn-reject-${r.id}`}
                              className="btn-secondary text-sm py-1.5 flex items-center gap-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              disabled={processing === r.id}
                              onClick={() => handleAction(r.id, "REJECTED")}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            >
                              <XCircle size={14} />
                              Zamítnout
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
