"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer, listItem } from "@/lib/motion";

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

const fetcher = (url: string) => api.get<any>(url);

export default function ClientAppointments() {
  const [historyPage, setHistoryPage] = useState(1);
  const [ratingApptId, setRatingApptId] = useState<number | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingError, setRatingError] = useState("");
  const [submittedRatings, setSubmittedRatings] = useState<Set<number>>(new Set());
  const { data: appointments, mutate } = useSWR<any[]>("/appointments/upcoming", fetcher as any);
  const { data: history } = useSWR<any>(`/appointments/history?page=${historyPage}&limit=10`, fetcher as any);
  const { data: employees } = useSWR<any[]>("/employees", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);

  const shouldReduceMotion = useReducedMotion();
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));

  const handleSubmitRating = async (apptId: number) => {
    if (!ratingValue) { setRatingError("Vyberte hodnocení 1–5 hvězd."); return; }
    try {
      await api.post(`/appointments/${apptId}/rating`, { rating: ratingValue, comment: ratingComment });
      setSubmittedRatings((prev) => new Set(prev).add(apptId));
      setRatingApptId(null);
      setRatingValue(0);
      setRatingComment("");
      setRatingError("");
    } catch (e: any) {
      setRatingError(e.message ?? "Chyba při odesílání hodnocení");
    }
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Opravdu chcete zrušit tento termín?")) return;
    // Optimistic update — immediately remove from list
    mutate((current) => (current ?? []).filter((a: any) => a.id !== id), false);
    try {
      await api.delete(`/appointments/${id}`);
      mutate(); // revalidate
    } catch {
      mutate(); // revert on error
    }
  };

  const upcoming = (appointments ?? []).filter(
    (a) => new Date(a.startTime) > new Date() && a.status !== "CANCELLED"
  );
  const past = history?.items ?? [];
  const histPagination = history?.pagination;

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje termíny</h1>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Nadcházející</h2>
            {upcoming?.length === 0 && (
              <EmptyState title="Žádné nadcházející termíny" />
            )}
            <motion.div
              className="space-y-3"
              variants={staggerContainer}
              initial={shouldReduceMotion ? "visible" : "hidden"}
              animate="visible"
            >
              {upcoming?.map((a) => (
                <motion.div key={a.id} variants={listItem} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500">
                      {serviceMap[a.serviceId] ?? "Termín"}
                      {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                      {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                    {a.status !== "CANCELLED" && new Date(a.startTime) > new Date() && (
                      <button
                        onClick={() => handleCancel(a.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Zrušit
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Minulé</h2>
              {histPagination && histPagination.total > 0 && (
                <span className="text-xs text-gray-500">{histPagination.total} celkem</span>
              )}
            </div>
            {!history && <p className="text-gray-500 text-sm">Načítám…</p>}
            {history && past.length === 0 && (
              <EmptyState title="Žádné minulé termíny" />
            )}
            <motion.div
              className="space-y-3"
              variants={staggerContainer}
              initial={shouldReduceMotion ? "visible" : "hidden"}
              animate="visible"
            >
              {past.map((a: any) => (
                <motion.div key={a.id} variants={listItem} className="card opacity-80">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{formatDateTime(a.startTime)}</p>
                      <p className="text-sm text-gray-500">
                        {serviceMap[a.serviceId] ?? "Termín"}
                        {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                        {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                      </p>
                      {a.status === "CANCELLED" && a.cancellationReason && (
                        <p className="text-xs text-red-400 mt-0.5">
                          Důvod: {a.cancellationReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                      {a.status === "COMPLETED" && !submittedRatings.has(a.id) && (
                        <button
                          onClick={() => { setRatingApptId(a.id); setRatingValue(0); setRatingComment(""); setRatingError(""); }}
                          className="text-xs text-yellow-600 hover:text-yellow-800 flex items-center gap-1"
                        >
                          <Star size={13} />
                          Hodnotit
                        </button>
                      )}
                      {(a.status === "COMPLETED" && submittedRatings.has(a.id)) && (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <Star size={13} fill="currentColor" />
                          Ohodnoceno
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Rating form */}
                  {ratingApptId === a.id && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-sm font-medium text-gray-700">Ohodnoťte termín:</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRatingValue(star)}
                            aria-label={`Hodnocení ${star} z 5 hvězd`}
                            aria-pressed={ratingValue >= star}
                            className={`text-2xl ${ratingValue >= star ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400 transition-colors min-h-[44px] min-w-[44px]`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Komentář (volitelné)"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400"
                      />
                      {ratingError && <p className="text-xs text-red-500">{ratingError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSubmitRating(a.id)}
                          className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
                        >
                          Odeslat hodnocení
                        </button>
                        <button
                          onClick={() => setRatingApptId(null)}
                          className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-sm"
                        >
                          Zrušit
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
            {/* Pagination */}
            {histPagination && histPagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="p-1 rounded text-gray-500 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-500">
                  {historyPage} / {histPagination.pages}
                </span>
                <button
                  onClick={() => setHistoryPage((p) => Math.min(histPagination.pages, p + 1))}
                  disabled={historyPage >= histPagination.pages}
                  className="p-1 rounded text-gray-500 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </section>
        </div>
      </Layout>
    </RouteGuard>
  );
}
