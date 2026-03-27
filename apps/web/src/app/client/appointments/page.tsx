"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Star, Trash2, AlertTriangle, X, Calendar } from "lucide-react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { SkeletonAppointmentCard } from "@/components/Skeleton";
import { haptics } from "@/lib/haptics";
import {
  parseClientSelfCancelFromPublicSettings,
  clientMayUseSelfCancelForAppointment,
  clientNeedsLateHealthReasonForAppointment,
} from "@/lib/client-cancel-ui";

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
  const { data: publicSettings } = useSWR<Record<string, string>>("/system-settings/public", fetcher as any);
  const cancelPolicy = parseClientSelfCancelFromPublicSettings(publicSettings);

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
    const isLate = clientNeedsLateHealthReasonForAppointment(cancelPolicy, appt.startTime);
    setCancelModal({ open: true, apptId: appt.id, isLate, reason: "", error: "", loading: false });
  };

  const submitCancel = async () => {
    if (!cancelModal.apptId) return;

    if (cancelModal.isLate && cancelModal.reason.trim().length < 10) {
      setCancelModal((m) => ({ ...m, error: "Uveďte zdravotní důvod (alespoň 10 znaků)." }));
      haptics.error();
      return;
    }

    setCancelModal((m) => ({ ...m, loading: true, error: "" }));

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
      mutate();
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

          {/* Header */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <motion.div
              initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
            >
              <Calendar size={26} className="text-primary-600 dark:text-primary-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moje termíny</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nadcházející a minulé rezervace</p>
            </div>
          </motion.div>

          {/* Upcoming section */}
          <section className="mb-8">
            <motion.h2
              initial={shouldReduceMotion ? {} : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
              className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3"
            >
              Nadcházející
            </motion.h2>

            {/* Skeleton */}
            {!appointments && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <SkeletonAppointmentCard key={i} />)}
              </div>
            )}

            {/* Empty state */}
            <AnimatePresence>
              {appointments && upcoming.length === 0 && (
                <motion.div
                  key="upcoming-empty"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                  className="card text-center py-10"
                >
                  <motion.div
                    initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 }}
                  >
                    <Calendar size={36} className="mx-auto text-gray-300 dark:text-gray-400 mb-3" />
                  </motion.div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Žádné nadcházející termíny</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upcoming list */}
            <div className="space-y-3">
              {upcoming.map((a, i) => {
                const mayCancel = clientMayUseSelfCancelForAppointment(cancelPolicy, a.startTime);
                const isLate = clientNeedsLateHealthReasonForAppointment(cancelPolicy, a.startTime);
                return (
                  <motion.div
                    key={a.id}
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.08 + i * 0.06 }}
                    className="relative overflow-hidden rounded-xl"
                  >
                    {/* Swipe-to-cancel reveal layer */}
                    {mayCancel && (
                      <div className="absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-red-500 rounded-xl">
                        <Trash2 size={18} className="text-white" />
                      </div>
                    )}
                    {/* Draggable card */}
                    <motion.div
                      className="card flex items-center justify-between relative bg-white dark:bg-gray-800"
                      drag={mayCancel && !shouldReduceMotion ? "x" : false}
                      dragConstraints={{ left: -120, right: 0 }}
                      dragElastic={{ left: 0.15, right: 0 }}
                      onDragEnd={(_e, info) => {
                        if (
                          info.offset.x < -80 &&
                          mayCancel &&
                          a.status !== "CANCELLED" &&
                          new Date(a.startTime) > new Date()
                        ) {
                          openCancelModal(a);
                        }
                      }}
                      whileTap={shouldReduceMotion ? undefined : { cursor: "grabbing" }}
                      style={{ touchAction: "pan-y" }}
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(a.startTime)}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {serviceMap[a.serviceId] ?? "Termín"}
                          {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                          {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                        </p>
                        {mayCancel && isLate && (
                          <p className="text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} />
                            Brzké zrušení — vyžadován zdravotní důvod (min. 10 znaků)
                          </p>
                        )}
                        {!mayCancel && cancelPolicy.allowed && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Online zrušení už není možné — kontaktujte recepci.
                          </p>
                        )}
                        {!cancelPolicy.allowed && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Zrušení termínu pouze přes recepci.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                        {mayCancel && a.status !== "CANCELLED" && new Date(a.startTime) > new Date() && (
                          <button
                            type="button"
                            onClick={() => openCancelModal(a)}
                            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 min-h-[36px] px-2"
                          >
                            Zrušit
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* Past section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <motion.h2
                initial={shouldReduceMotion ? {} : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                className="text-lg font-semibold text-gray-800 dark:text-gray-200"
              >
                Minulé
              </motion.h2>
              {histPagination && histPagination.total > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">{histPagination.total} celkem</span>
              )}
            </div>

            {!history && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Načítám…</p>
            )}

            {/* Past empty state */}
            <AnimatePresence>
              {history && past.length === 0 && (
                <motion.div
                  key="past-empty"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                  className="card text-center py-10"
                >
                  <motion.div
                    initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 }}
                  >
                    <Calendar size={36} className="mx-auto text-gray-300 dark:text-gray-400 mb-3" />
                  </motion.div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">Žádné minulé termíny</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Past list */}
            <div className="space-y-3">
              {past.map((a: any, i: number) => (
                <motion.div
                  key={a.id}
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.08 + i * 0.05 }}
                  className="card opacity-80"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(a.startTime)}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
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
                      {a.status === "COMPLETED" && !submittedRatings.has(a.id) && !a.rating && (
                        <button
                          onClick={() => { setRatingApptId(a.id); setRatingValue(0); setRatingComment(""); setRatingError(""); haptics.light(); }}
                          className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 flex items-center gap-1"
                        >
                          <Star size={13} />
                          Hodnotit
                        </button>
                      )}
                      <AnimatePresence>
                        {a.status === "COMPLETED" && (submittedRatings.has(a.id) || a.rating) && (
                          <motion.span
                            key="rated"
                            initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"
                          >
                            <Star size={13} fill="currentColor" />
                            Ohodnoceno
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Rating form */}
                  <AnimatePresence>
                    {ratingApptId === a.id && (
                      <motion.div
                        key="rating-form"
                        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.96, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.96, y: 6 }}
                        transition={{ type: "spring", stiffness: 400, damping: 26 }}
                        className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2"
                      >
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Ohodnoťte termín:</p>
                        <motion.div
                          className="flex gap-1"
                          animate={shouldReduceMotion ? {} : ratingShake ? { x: [0, -8, 8, -8, 8, 0] } : { x: 0 }}
                          transition={{ duration: 0.4, ease: "easeInOut" }}
                        >
                          {[1, 2, 3, 4, 5].map((star) => (
                            <motion.button
                              key={star}
                              onClick={() => { setRatingValue(star); haptics.light(); }}
                              aria-label={`Hodnocení ${star} z 5 hvězd`}
                              aria-pressed={ratingValue >= star}
                              className={`text-2xl ${ratingValue >= star ? "text-yellow-400" : "text-gray-300 dark:text-gray-400"} hover:text-yellow-400 transition-colors min-h-[44px] min-w-[44px]`}
                              whileTap={shouldReduceMotion ? undefined : { scale: 1.3 }}
                              whileHover={shouldReduceMotion ? undefined : { scale: 1.15 }}
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
                          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-yellow-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                        {ratingError && (
                          <motion.p
                            className="text-xs text-red-500 dark:text-red-400"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {ratingError}
                          </motion.p>
                        )}
                        <div className="flex gap-2">
                          <motion.button
                            onClick={() => handleSubmitRating(a.id)}
                            className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                          >
                            Odeslat hodnocení
                          </motion.button>
                          <motion.button
                            onClick={() => setRatingApptId(null)}
                            className="px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm"
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                          >
                            Zrušit
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {histPagination && histPagination.pages > 1 && (
              <motion.div
                initial={shouldReduceMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.2 }}
                className="flex items-center justify-center gap-3 mt-4"
              >
                <motion.button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="p-1 rounded text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                >
                  <ChevronLeft size={18} />
                </motion.button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {historyPage} / {histPagination.pages}
                </span>
                <motion.button
                  onClick={() => setHistoryPage((p) => Math.min(histPagination.pages, p + 1))}
                  disabled={historyPage >= histPagination.pages}
                  className="p-1 rounded text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-30"
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
                >
                  <ChevronRight size={18} />
                </motion.button>
              </motion.div>
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
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Zrušit termín</h2>
                  </div>
                  <button
                    onClick={() => !cancelModal.loading && setCancelModal(CANCEL_MODAL_INIT)}
                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <X size={18} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {cancelModal.isLate ? (
                  <div className="mb-4">
                    <p className="text-sm text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-3">
                      Termín je v krátké době před začátkem. Zrušení vyžaduje zdravotní odůvodnění; může ovlivnit
                      skóre dochvilnosti.
                    </p>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Zdravotní důvod pro zrušení <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={cancelModal.reason}
                      onChange={(e) => setCancelModal((m) => ({ ...m, reason: e.target.value, error: "" }))}
                      placeholder="Popište zdravotní důvod (min. 10 znaků)…"
                      rows={3}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-red-400 focus:border-red-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      disabled={cancelModal.loading}
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-400 mt-1 text-right">
                      {cancelModal.reason.trim().length}/10 min.
                    </p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Opravdu chcete zrušit tento termín?
                    </p>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Důvod (volitelné)
                    </label>
                    <textarea
                      value={cancelModal.reason}
                      onChange={(e) => setCancelModal((m) => ({ ...m, reason: e.target.value }))}
                      placeholder="Proč rušíte termín? (nepovinné)"
                      rows={2}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                      disabled={cancelModal.loading}
                    />
                  </div>
                )}

                {cancelModal.error && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
                    {cancelModal.error}
                  </p>
                )}

                <div className="flex gap-3">
                  <motion.button
                    onClick={() => !cancelModal.loading && setCancelModal(CANCEL_MODAL_INIT)}
                    disabled={cancelModal.loading}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  >
                    Zpět
                  </motion.button>
                  <motion.button
                    onClick={submitCancel}
                    disabled={cancelModal.loading}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  >
                    {cancelModal.loading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : null}
                    Zrušit termín
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
