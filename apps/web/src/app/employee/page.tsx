"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import SOSAlertBanner from "@/components/SOSAlertBanner";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo, useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Clock, X, User, MapPin } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 border-yellow-200 text-yellow-800",
  CONFIRMED: "bg-blue-50 border-blue-200 text-blue-800",
  COMPLETED: "bg-green-50 border-green-200 text-green-700",
  CANCELLED: "bg-red-100 border-red-200 text-red-600",
  NO_SHOW: "bg-red-50 border-red-200 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  COMPLETED: "Hotovo",
  CANCELLED: "Zrušeno",
  NO_SHOW: "No-show",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

export default function EmployeeDashboard() {
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

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const timelineOffsetPct = Math.max(
    0,
    Math.min(100, ((currentMinute - 7 * 60) / (13 * 60)) * 100)
  );
  const showNowLine = currentMinute >= 7 * 60 && currentMinute <= 20 * 60;

  const getApptAtHour = (hour: number) =>
    todayAppts.filter((a: any) => new Date(a.startTime).getHours() === hour);

  const handleStatusChange = async (apptId: number, status: string) => {
    await api.patch(`/appointments/${apptId}`, { status });
    mutate();
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
          {nextAppt && (
            <div className="card mb-4 border-primary-200 bg-primary-50">
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
            </div>
          )}

          {/* Day timeline */}
          <div className="card relative overflow-hidden">
            {/* "Now" indicator line */}
            {showNowLine && (
              <div
                ref={nowLineRef}
                className="absolute left-16 right-4 h-px bg-red-400 z-10 pointer-events-none"
                style={{ top: `${(timelineOffsetPct / 100) * (HOURS.length * 48)}px` }}
              >
                <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-400" />
              </div>
            )}

            <div className="space-y-0">
              {HOURS.map((hour) => {
                const appts = getApptAtHour(hour);
                const isCurrentHour = now.getHours() === hour;
                return (
                  <div
                    key={hour}
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
                        <div
                          key={a.id}
                          onClick={() => setSelectedAppt(a)}
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
                                  onClick={() => handleStatusChange(a.id, "COMPLETED")}
                                  title="Označit jako hotovo"
                                  className="p-1 rounded hover:bg-green-100 text-green-600 transition-colors"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  onClick={() => handleStatusChange(a.id, "NO_SHOW")}
                                  title="No-show"
                                  className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
                                >
                                  <XCircle size={14} />
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
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {todayAppts.length === 0 && (
            <p className="text-gray-500 text-sm text-center mt-6">
              Dnes nemáte žádné termíny 🎉
            </p>
          )}
        </div>
      </Layout>

      {/* Slide-over panel for appointment detail */}
      {selectedAppt && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSelectedAppt(null)}
          />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Detail termínu</h2>
              <button
                onClick={() => setSelectedAppt(null)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Zavřít"
              >
                <X size={20} />
              </button>
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
                    <p className="text-xs text-gray-500 dark:text-gray-500">Čas</p>
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
                    <p className="text-xs text-gray-500 dark:text-gray-500">Klient</p>
                    <p className="font-medium text-sm">{clientMap[selectedAppt.clientId] ?? `Klient #${selectedAppt.clientId}`}</p>
                  </div>
                </div>
                {selectedAppt.serviceId && (
                  <div className="flex items-start gap-3">
                    <CheckCircle size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Služba</p>
                      <p className="font-medium text-sm">{serviceMap[selectedAppt.serviceId] ?? `Služba #${selectedAppt.serviceId}`}</p>
                    </div>
                  </div>
                )}
                {selectedAppt.roomId && (
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-500">Místnost</p>
                      <p className="font-medium text-sm">Místnost #{selectedAppt.roomId}</p>
                    </div>
                  </div>
                )}
                {selectedAppt.clientNote && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">Poznámka klienta</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAppt.clientNote}</p>
                  </div>
                )}
              </div>
            </div>
            {/* Actions */}
            {["PENDING", "CONFIRMED"].includes(selectedAppt.status) && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                <button
                  onClick={() => { handleStatusChange(selectedAppt.id, "COMPLETED"); setSelectedAppt(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle size={16} /> Hotovo
                </button>
                <button
                  onClick={() => { handleStatusChange(selectedAppt.id, "NO_SHOW"); setSelectedAppt(null); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <XCircle size={16} /> No-show
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </RouteGuard>
  );
}
