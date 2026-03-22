"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Star, Trash2, AlertTriangle, X } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { staggerContainer, listItem, shakeVariant, bounceIn } from "@/lib/motion";
import { SkeletonAppointmentCard } from "@/components/Skeleton";
import { haptics } from "@/lib/haptics";

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
  NO_SHOW: "badge-orange",
};

/** Returns true if appointment starts within 24 hours */
function isWithinCancellationDeadline(startTime: string): boolean {
  const diff = new Date(startTime).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

const fetcher = (url: string) => api.get<any>(url);

interface CancelModal {
  open: boolean;
  apptId: number | null;
  isLate: boolean;
  reason: string;
  error: string;
  loading: boolean;
}

const CANCEL_MODAL_INIT: CancelModal = {
  open: false, apptId: null, isLate: false,
  reason: "", error: "", loading: false,
};

export default function ClientAppointments() {
  const [historyPage, setHistoryPage] = useState(1);
  const [ratingApptId, setRatingApptId] = useState<number | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingError, setRatingError] = useState("");
  const [submittedRatings, setSubmittedRatings] = useState<Set<number>>(new Set());
  const [ratingShake, setRatingShake] = useState(false);
  const [cancelModal, setCancelModal] = useState<CancelModal>(CANCEL_MODAL_INIT);

  const { data: appointments, mutate } = useSWR<any[]>("/appointments/upcoming", fetcher as any);
  const { data: history } = useSWR<any>(`/appointments/history?page=${historyPage}&limit=10`, fetcher as any);
  const { data: employees } = useSWR<any[]>("/employees", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);

  const shouldReduceMotion = useReducedMotion();
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));

  const handleSubmitRating = async (apptId: number) => {
    if (!ratingValue) {
      setRatingError("Vyberte hodnocení 1–5 hvězd.");
      setRatingShake(true);
      setTimeout(() => setRatingShake(false), 600);
      haptics.error();
      return;
    }
    try {
      await api.post(`/appointments/${apptId}/rating`, { rating: ratingValue, comment: ratingComment });
      setSubmittedRatings((prev) => new Set(prev).add(apptId));
      setRatingApptId(null);
      setRatingValue(0);
      setRatingComment("");
      setRatingError("");
      haptics.success();
    } catch (e: any) {
      setRatingError(e.message ?? "Chyba při odesílání hodnocení");
      haptics.error();
    }
  };

  const openCancelModal = (appt: any) => {
    haptics.medium();
    const isLate = isWithinCancellationDeadline(appt.startTime);
    setCancelModal({ open: true, apptId: appt.id, isLate, reason: "", error: "", loading: false });
  };

  const submitCancel = async () => {
    if (!cancelModal.apptId) return;

    // Validate reason when within cancellation deadline
    if (cancelModal.isLate && cancelModal.reason.trim().length < 10) {
      setCancelModal((m) => ({ ...m, error: "Uveďte zdravotní důvod (alespoň 10 znaků)." }));
      haptics.error();
      return;
    }

    setCancelModal((m) => ({ ...m, loading: true, error: "" }));

    // Optimistic update
    const apptId = cancelModal.apptId;
    mutate((current) => (current ?? []).filter((a: any) => a.id !== apptId), false);

    try {
      await api.post(`/appointments/${apptId}/cancel`, {
        cancellationReason: cancelModal.reason.trim() || undefined,
      });
      mutate();
      haptics.success();
      setCancelModal(CANCEL_MODAL_INIT);
    } catch (e: any) {
      mutate(); // revert on error
      haptics.error();
      setCancelModal((m) => ({ ...m, loading: false, error: e.message ?? "Chyba při rušení termínu." }));
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
            {!appointments && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <SkeletonAppointmentCard key={i} />)}
              </div>
            )}
            {appointments && upcoming?.length === 0 && (
              <EmptyState title="Žádné nadcházející termíny" />
            )}
            <motion.div
              className="space-y-3"
              variants={staggerContainer}
              initial={shouldReduceMotion ? "visible" : "hidden"}
              animate="visible"
            >
              {upcoming?.map((a) => {
                const isLate = isWithinCancellationDeadline(a.startTime);
                return (
                  <motion.div
                    key={a.id}
                    variants={listItem}
                    className="relative overflow-hidden rounded-xl"
                  >
                    {/* Swipe-to-cancel reveal layer */}
                    <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-500 rounded-xl">
                      <Trash2 size={18} className="text-white" />
                    </div>
                    {/* Draggable card */}
                    <motion.div
                      className="card flex items-center justify-between relative bg-white dark:bg-gray-800"
                      drag={shouldReduceMotion ? false : "x"}
                      dragConstraints={{ left: -120, right: 0 }}
                      dragElastic={{ left: 0.15, right: 0 }}
                      onDragEnd={(_e, info) => {
                        if (info.offset.x < -80 && a.status !== "CANCELLED" && new Date(a.startTime) > new Date()) {
                          openCancelModal(a);
                        }
                      }}
                      whileTap={shouldReduceMotion ? {} : { cursor: "grabbing" }}
                      style={{ touchAction: "pan-y" }}
                    >
                      <div>
                        <p className="font-medium">{formatDateTime(a.startTime)}</p>
                        <p className="text-sm text-gray-500">
                          {serviceMap[a.serviceId] ?? "Termín"}
                          {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                          {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                        </p>
                        {isLate && (
                          <p className="text-xs text-orange-500 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} />
                            Zrušení do 24 h — vyžadován zdravotní důvod
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                        {a.status !== "CANCELLED" && new Date(a.startTime) > new Date() && (
                          <button
                            onClick={() => openCancelModal(a)}
                            className="text-xs text-red-500 hover:text-red-700 min-h-[36px] px-2"
                          >
                            Zrušit
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
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
                          onClick={() => { setRatingApptId(a.id); setRatingValue(0); setRatingComment(""); setRatingError(""); haptics.light(); }}
                          className="text-xs text-yellow-600 hover:text-yellow-800 flex items-center gap-1"
                        >
                          <Star size={13} />
                          Hodnotit
                        </button>
                      )}
                      {(a.status === "COMPLETED" && submittedRatings.has(a.id)) && (
                        <motion.span
                          className="text-xs text-green-600 flex items-center gap-1"
                          variants={bounceIn}
                          initial="hidden"
                          animate="visible"
                        >
                          <Star size={13} fill="currentColor" />
                          Ohodnoceno
                        </motion.span>
                      )}
                    </div>
                  </div>
                  {/* Rating form */}
                  {ratingApptId === a.id && (
                    <motion.div
                      className="mt-3 pt-3 border-t space-y-2"
                      variants={bounceIn}
                      initial="hidden"
                      animate="visible"
                    >
                      <p className="text-sm font-medium text-gray-700">Ohodnoťte termín:</p>
                      <motion.div
                        className="flex gap-1"
                        variants={shakeVariant}
                        initial="idle"
                        animate={ratingShake ? "shake" : "idle"}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <motion.button
                            key={star}
                            onClick={() => { setRatingValue(star); haptics.light(); }}
                            aria-label={`Hodnocení ${star} z 5 hvězd`}
                            aria-pressed={ratingValue >= star}
                            className={`text-2xl ${ratingValue >= star ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400 transition-colors min-h-[44px] min-w-[44px]`}
                            whileTap={shouldReduceMotion ? {} : { scale: 1.3 }}
                            whileHover={shouldReduceMotion ? {} : { scale: 1.15 }}
                          >
                            ★
                          </motion.button>
                        ))}
                      </motion.div>
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="Komentář (volitelné)"
                        rows={2}
                        className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400"
                      />
                      {ratingError && (
                        <motion.p
                          className="text-xs text-red-500"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {ratingError}
                        </motion.p>
                      )}
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
                    </motion.div>
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

        {/* Cancellation Modal */}
        <AnimatePresence>
          {cancelModal.open && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Backdrop */}
              <motion.div
                className="absolute inset-0 bg-black/50"
                onClick={() => !cancelModal.loading && setCancelModal(CANCEL_MODAL_INIT)}
              />
              {/* Sheet */}
              <motion.div
                className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {cancelModal.isLate && <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />}
                    <h2 className="text-lg font-semibold text-gray-900">Zrušit termín</h2>
                  </div>
                  <button
                    onClick={() => !cancelModal.loading && setCancelModal(CANCEL_MODAL_INIT)}
                    className="p-1 rounded-full hover:bg-gray-100"
                  >
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>

                {cancelModal.isLate ? (
                  <div className="mb-4">
                    <p className="text-sm text-orange-700 bg-orange-50 rounded-lg p-3 mb-3">
                      Termín je do 24 hodin. Zrušení v takto krátké době vyžaduje
                      zdravotní odůvodnění, jinak může negativně ovlivnit vaše skóre dochvilnosti.
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zdravotní důvod pro zrušení <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={cancelModal.reason}
                      onChange={(e) => setCancelModal((m) => ({ ...m, reason: e.target.value, error: "" }))}
                      placeholder="Popište zdravotní důvod (min. 10 znaků)…"
                      rows={3}
                      className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-400 focus:border-red-400"
                      disabled={cancelModal.loading}
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {cancelModal.reason.trim().length}/10 min.
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Opravdu chcete zrušit tento termín?
                    </p>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Důvod (volitelné)
                    </label>
                    <textarea
                      value={cancelModal.reason}
                      onChange={(e) => setCancelModal((m) => ({ ...m, reason: e.target.value }))}
                      placeholder="Proč rušíte termín? (nepovinné)"
                      rows={2}
                      className="w-full border rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-gray-300"
                      disabled={cancelModal.loading}
                    />
                  </div>
                )}

                {cancelModal.error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                    {cancelModal.error}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => !cancelModal.loading && setCancelModal(CANCEL_MODAL_INIT)}
                    disabled={cancelModal.loading}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Zpět
                  </button>
                  <button
                    onClick={submitCancel}
                    disabled={cancelModal.loading}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cancelModal.loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    Zrušit termín
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
