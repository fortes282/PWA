"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import SOSAlertBanner from "@/components/SOSAlertBanner";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useState, useEffect, useRef } from "react";
import { CheckCircle, Clock, X, User, MapPin, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 border-yellow-200 text-yellow-800",
  CONFIRMED: "bg-blue-50 border-blue-200 text-blue-800",
  COMPLETED: "bg-green-50 border-green-200 text-green-700",
  CANCELLED: "bg-red-100 border-red-200 text-red-600",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  COMPLETED: "Hotovo",
  CANCELLED: "Zrušeno",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

export default function EmployeeDashboard() {
  const shouldReduce = useReducedMotion();
  const { user } = useAuth();
  // Use /appointments/today for the timeline — employee-scoped on the server
  const { data: empDashboard } = useSWR<any>("/dashboard/employee", fetcher);
  const { data: todayApptsDirect } = useSWR("/appointments/today", fetcher);
  const { data: appointments, mutate } = useSWR(
    user ? `/appointments?employeeId=${user.id}` : null,
    fetcher
  );
  const { data: clients } = useSWR("/clients", fetcher);
  const { data: services } = useSWR("/services", fetcher);

  const clientMap = useMemo(
    () => Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name])),
    [clients]
  );
  const serviceMap = useMemo(
    () => Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name])),
    [services]
  );

  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ apptId: number; status: "COMPLETED"; fromSlideOver?: boolean } | null>(null);
  const [showAllHours, setShowAllHours] = useState(false);
  const nowLineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      nowLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = useMemo(
    () =>
      (todayApptsDirect ?? (appointments ?? [])
        .filter((a: any) => a.startTime.startsWith(today) && a.status !== "CANCELLED"))
        .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime)),
    [todayApptsDirect, appointments, today]
  );

  const nextAppt = empDashboard?.nextAppointment ?? todayAppts.find((a: any) => {
    const start = new Date(a.startTime);
    return start > new Date() && ["PENDING", "CONFIRMED"].includes(a.status);
  });

  const now = useMemo(() => new Date(), []);
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const timelineOffsetPct = Math.max(
    0,
    Math.min(100, ((currentMinute - 7 * 60) / (13 * 60)) * 100)
  );
  const showNowLine = currentMinute >= 7 * 60 && currentMinute <= 20 * 60;

  const getApptAtHour = (hour: number) =>
    todayAppts.filter((a: any) => new Date(a.startTime).getHours() === hour);

  // Compressed timeline: only show hours with appointments ± 1h buffer (+ current hour)
  const visibleHours = useMemo(() => {
    if (showAllHours || todayAppts.length === 0) return HOURS;
    const apptHours = new Set(todayAppts.map((a: any) => new Date(a.startTime).getHours()));
    const expanded = new Set<number>();
    for (const h of apptHours) {
      if (h - 1 >= 7) expanded.add(h - 1);
      expanded.add(h);
      if (h + 1 <= 20) expanded.add(h + 1);
    }
    if (now.getHours() >= 7 && now.getHours() <= 20) expanded.add(now.getHours());
    return HOURS.filter((h) => expanded.has(h));
  }, [todayAppts, showAllHours, now]);

  const handleStatusChange = async (apptId: number, status: string) => {
    await api.patch(`/appointments/${apptId}`, { status });
    mutate();
  };

  const handleConfirmedAction = async () => {
    if (!confirmAction) return;
    await handleStatusChange(confirmAction.apptId, confirmAction.status);
    if (confirmAction.fromSlideOver) setSelectedAppt(null);
    setConfirmAction(null);
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <SOSAlertBanner />
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Dnešní rozvrh</h1>
            <span className="text-sm font-medium text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
              {todayAppts.length} termínů
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            {new Date().toLocaleDateString("cs-CZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>

          {/* Next appointment highlight */}
          <AnimatePresence>
            {nextAppt && (
              <motion.div
                key="next-appt"
                initial={shouldReduce ? false : { opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card mb-4 border-primary-200 bg-primary-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-primary-600" />
                  <p className="text-xs font-medium text-primary-600">Nadcházející termín</p>
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(nextAppt.startTime).toLocaleTimeString("cs-CZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" — "}
                  {clientMap[nextAppt.clientId] ?? `Klient #${nextAppt.clientId}`}
                </p>
                <p className="text-xs text-gray-500">
                  {serviceMap[nextAppt.serviceId] ?? `Služba #${nextAppt.serviceId}`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Day timeline */}
          <div className="card relative overflow-hidden">
            {/* Show all hours toggle */}
            {todayAppts.length > 0 && (
              <motion.button
                whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                onClick={() => { haptics.light(); setShowAllHours((v) => !v); }}
                className="absolute top-3 right-3 z-10 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showAllHours ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showAllHours ? "Skrýt prázdné" : "Všechny hodiny"}
              </motion.button>
            )}
            {/* "Now" indicator line */}
            {showNowLine && (
              <div
                ref={nowLineRef}
                className="absolute left-16 right-4 h-px bg-red-400 z-10 pointer-events-none"
                style={{ top: `${(timelineOffsetPct / 100) * (visibleHours.length * 48)}px` }}
              >
                <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-400" />
              </div>
            )}

            <div className="space-y-0">
              {visibleHours.map((hour, idx) => {
                const prevHour = visibleHours[idx - 1];
                const hasGap = idx > 0 && hour - prevHour > 1;
                const appts = getApptAtHour(hour);
                const isCurrentHour = now.getHours() === hour;
                return (
                  <div key={hour}>
                  {hasGap && (
                    <div className="flex items-center gap-2 px-3 py-1">
                      <div className="flex-1 border-t border-dashed border-gray-200" />
                      <span className="text-[10px] text-gray-300">···</span>
                      <div className="flex-1 border-t border-dashed border-gray-200" />
                    </div>
                  )}
                  <div
                    key={`row-${hour}`}
                    className={`flex gap-4 min-h-[48px] border-b border-gray-50 last:border-0 ${
                      isCurrentHour ? "bg-red-50/30" : ""
                    }`}
                  >
                    <span
                      className={`text-xs w-12 pt-2 flex-shrink-0 text-right ${
                        isCurrentHour ? "text-red-500 font-medium" : "text-gray-500"
                      }`}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </span>
                    <div className="flex-1 py-1 space-y-1">
                      {appts.map((a: any) => (
                        <motion.div
                          key={a.id}
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          onClick={() => { haptics.light(); setSelectedAppt(a); }}
                          className={`rounded border px-2 py-1.5 text-xs cursor-pointer hover:shadow-md transition-shadow ${
                            STATUS_COLORS[a.status] ?? "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">
                                {new Date(a.startTime).toLocaleTimeString("cs-CZ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                {" "}–{" "}
                                {new Date(a.endTime).toLocaleTimeString("cs-CZ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <p className="font-medium mt-0.5">
                                {clientMap[a.clientId] ?? `Klient #${a.clientId}`}
                              </p>
                              <p className="opacity-70">
                                {serviceMap[a.serviceId] ?? `Služba #${a.serviceId}`}
                              </p>
                            </div>
                            {/* Quick actions */}
                            {["PENDING", "CONFIRMED"].includes(a.status) && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmAction({ apptId: a.id, status: "COMPLETED" }); }}
                                  title="Označit jako hotovo"
                                  className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                                >
                                  <CheckCircle size={14} />
                                </button>
                              </div>
                            )}
                            {a.status === "COMPLETED" && (
                              <span className="text-green-600 flex-shrink-0">✓</span>
                            )}
                          </div>
                          {a.status !== "PENDING" && a.status !== "CONFIRMED" && (
                            <span className="inline-block mt-1 text-[10px] opacity-60">
                              {STATUS_LABELS[a.status]}
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  </div>
                );
              })}
            </div>
          </div>

          <AnimatePresence>
            {todayAppts.length === 0 && (
              <motion.p
                key="empty"
                initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 340, damping: 28, delay: 0.2 }}
                className="text-gray-500 text-sm text-center mt-6"
              >
                Dnes nemáte žádné termíny 🎉
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </Layout>

      {/* Slide-over panel for appointment detail */}
      <AnimatePresence>
        {selectedAppt && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => { haptics.light(); setSelectedAppt(null); }}
            />
            <motion.div
              key="slideover"
              initial={shouldReduce ? false : { x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34, mass: 0.9 }}
              className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Detail termínu</h2>
                <motion.button
                  whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  onClick={() => { haptics.light(); setSelectedAppt(null); }}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Zavřít"
                >
                  <X size={20} />
                </motion.button>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className={`rounded-xl border p-4 ${STATUS_COLORS[selectedAppt.status] ?? "bg-gray-50 border-gray-200"}`}>
                  <p className="font-semibold">{STATUS_LABELS[selectedAppt.status]}</p>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Clock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Čas</p>
                      <p className="font-medium text-sm">
                        {new Date(selectedAppt.startTime).toLocaleString("cs-CZ", {
                          weekday: "long", day: "numeric", month: "long",
                          hour: "2-digit", minute: "2-digit",
                        })}
                        {" – "}
                        {new Date(selectedAppt.endTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <User size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Klient</p>
                      <p className="font-medium text-sm">{clientMap[selectedAppt.clientId] ?? `Klient #${selectedAppt.clientId}`}</p>
                    </div>
                  </div>
                  {selectedAppt.serviceId && (
                    <div className="flex items-start gap-3">
                      <CheckCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Služba</p>
                        <p className="font-medium text-sm">{serviceMap[selectedAppt.serviceId] ?? `Služba #${selectedAppt.serviceId}`}</p>
                      </div>
                    </div>
                  )}
                  {selectedAppt.roomId && (
                    <div className="flex items-start gap-3">
                      <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Místnost</p>
                        <p className="font-medium text-sm">Místnost #{selectedAppt.roomId}</p>
                      </div>
                    </div>
                  )}
                  {selectedAppt.clientNote && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Poznámka klienta</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAppt.clientNote}</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Actions */}
              {["PENDING", "CONFIRMED"].includes(selectedAppt.status) && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                  <motion.button
                    whileTap={shouldReduce ? undefined : { scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    onClick={() => { haptics.medium(); setConfirmAction({ apptId: selectedAppt.id, status: "COMPLETED", fromSlideOver: true }); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <CheckCircle size={16} /> Hotovo
                  </motion.button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirm action dialog */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              key="confirm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={() => { haptics.light(); setConfirmAction(null); }}
            />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                key="confirm-dialog"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xs p-6 pointer-events-auto"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100">
                    <AlertTriangle size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      Označit jako hotovo?
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {clientMap[
                        (todayAppts.find((a: any) => a.id === confirmAction.apptId))?.clientId
                      ] ?? "Klient"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={shouldReduce ? undefined : { scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    onClick={() => { haptics.light(); setConfirmAction(null); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Zrušit
                  </motion.button>
                  <motion.button
                    whileTap={shouldReduce ? undefined : { scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    onClick={() => { haptics.success(); handleConfirmedAction(); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors bg-green-600 hover:bg-green-700"
                  >
                    Hotovo
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </RouteGuard>
  );
}
