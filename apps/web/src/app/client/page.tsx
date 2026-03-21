"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, CreditCard, Clock, ArrowRight, FileText, Video, Sparkles, WifiOff, CalendarPlus, X } from "lucide-react";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { haptics } from "@/lib/haptics";
import { useEffect, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { staggerContainer, listItem } from "@/lib/motion";


function getDailyGreeting(name: string): { greeting: string; dateStr: string } {
  const hour = new Date().getHours();
  const firstName = name.split(" ")[0];
  const greeting =
    hour < 12 ? `Dobré ráno, ${firstName}!`
    : hour < 18 ? `Dobré odpoledne, ${firstName}!`
    : `Dobrý večer, ${firstName}!`;
  const dateStr = new Date().toLocaleDateString("cs-CZ", {
    weekday: "long", day: "numeric", month: "long",
  });
  return { greeting, dateStr: dateStr.charAt(0).toUpperCase() + dateStr.slice(1) };
}

function isVideoActive(startTime: string): boolean {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  return now >= start - 5 * 60 * 1000 && now <= start + 3 * 60 * 60 * 1000;
}

const fetcher = (url: string) => api.get<any>(url);

export default function ClientDashboard() {
  const shouldReduceMotion = useReducedMotion();
  const { user } = useAuth();
  const { data: appointments, mutate: mutateAppointments } = useSWR<any[]>("/appointments?status=CONFIRMED", fetcher);
  const { data: upcoming, mutate: mutateUpcoming } = useSWR<any[]>("/appointments/upcoming", fetcher);
  const { data: balance, mutate: mutateBalance } = useSWR<{ balance: number }>("/credits/balance", fetcher);
  const { data: rawNotifs, mutate: mutateNotifs } = useSWR<any>("/notifications", fetcher);
  const { data: services } = useSWR<any[]>("/services", fetcher);
  const { data: employees } = useSWR<any[]>("/employees", fetcher);
  const { data: creditRequests } = useSWR<any[]>("/credit-requests", fetcher);

  const notifications = rawNotifs?.notifications ?? (Array.isArray(rawNotifs) ? rawNotifs : []);
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  const [isOffline, setIsOffline] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const handleRefresh = useCallback(async () => {
    await Promise.all([mutateUpcoming(), mutateAppointments(), mutateBalance(), mutateNotifs()]);
  }, [mutateUpcoming, mutateAppointments, mutateBalance, mutateNotifs]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const handleCancelNext = useCallback(async (apptId: number) => {
    if (!confirm("Opravdu chcete zrušit tento termín?")) return;
    setCancellingId(apptId);
    try {
      await api.patch(`/appointments/${apptId}`, { status: "CANCELLED" });
      mutateUpcoming();
    } catch {
      // ignore
    } finally {
      setCancellingId(null);
    }
  }, [mutateUpcoming]);

  const downloadIcs = useCallback((appt: any) => {
    const start = new Date(appt.startTime);
    const end = new Date(appt.endTime ?? appt.startTime);
    const fmt = (d: Date) =>
      d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const svcName = appt.serviceId && serviceMap[appt.serviceId] ? serviceMap[appt.serviceId] : "Terapie";
    const empName = appt.employeeId && employeeMap[appt.employeeId] ? employeeMap[appt.employeeId] : "";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Přístav Radosti//CS",
      "BEGIN:VEVENT",
      `UID:appt-${appt.id}@pristav-radosti.cz`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${svcName}`,
      empName ? `DESCRIPTION:Terapeut: ${empName}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `termin-${appt.id}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }, [serviceMap, employeeMap]);

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <PullToRefresh onRefresh={handleRefresh}>
        <div className="max-w-4xl mx-auto">
          {(() => {
            const { greeting, dateStr } = getDailyGreeting(user?.name ?? "");
            return (
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{greeting}</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{dateStr}</p>
              </div>
            );
          })()}

          {/* Offline cached data notice */}
          {isOffline && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-amber-800 dark:text-amber-300 text-sm">
              <WifiOff size={16} className="flex-shrink-0" />
              <span>Zobrazena jsou uložená data z poslední návštěvy.</span>
            </div>
          )}

          {/* Onboarding checklist */}
          <OnboardingChecklist />

          {/* Hero: Next Appointment */}
          {upcoming !== undefined && (
            upcoming && upcoming.length > 0 ? (() => {
              const next = upcoming[0];
              const start = new Date(next.startTime);
              const now = new Date();
              const diffMs = start.getTime() - now.getTime();
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              const timeLabel = diffDays > 0
                ? `za ${diffDays} ${diffDays === 1 ? "den" : diffDays < 5 ? "dny" : "dní"}`
                : diffHours > 0
                  ? `za ${diffHours} ${diffHours === 1 ? "hodinu" : diffHours < 5 ? "hodiny" : "hodin"}`
                  : "brzy";

              return (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-900 text-white p-6 mb-8 shadow-lg">
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
                    <Sparkles size={128} />
                  </div>
                  <p className="text-primary-200 text-xs font-medium uppercase tracking-wider mb-1">Příští termín — {timeLabel}</p>
                  <p className="text-2xl font-bold mb-1">{formatDateTime(next.startTime)}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-primary-100 mb-4">
                    {next.serviceId && serviceMap[next.serviceId] && (
                      <span>{serviceMap[next.serviceId]}</span>
                    )}
                    {next.employeeId && employeeMap[next.employeeId] && (
                      <span>· {employeeMap[next.employeeId]}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => downloadIcs(next)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors min-h-[44px]"
                    >
                      <CalendarPlus size={14} /> Přidat do kalendáře
                    </button>
                    {next.status !== "CANCELLED" && (
                      <button
                        onClick={() => handleCancelNext(next.id)}
                        disabled={cancellingId === next.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors min-h-[44px] disabled:opacity-50"
                      >
                        <X size={14} /> {cancellingId === next.id ? "Ruším…" : "Zrušit"}
                      </button>
                    )}
                    {next.isOnline && next.status === "CONFIRMED" && isVideoActive(next.startTime) && (
                      <Link
                        href={`/video/${next.id}`}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors min-h-[44px]"
                      >
                        <Video size={14} /> Připojit se
                      </Link>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-100 to-white dark:from-gray-800 dark:to-gray-900 border-2 border-dashed border-primary-300 dark:border-primary-700 p-8 mb-8 text-center">
                <Calendar size={48} className="mx-auto text-primary-400 mb-4" />
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                  Nemáte žádný nadcházející termín
                </h2>
                <p className="text-gray-500 dark:text-gray-500 text-sm mb-6">
                  Rezervujte si termín a začněte svou cestu k uzdravení.
                </p>
                <Link
                  href="/client/booking"
                  onClick={() => haptics.success()}
                  className="btn-primary text-base font-semibold inline-flex items-center gap-2 px-8 py-4"
                >
                  <Calendar size={18} /> Rezervovat termín
                </Link>
              </div>
            )
          )}

          {/* Stats grid */}
          <motion.div
            className="grid grid-cols-2 gap-4 mb-8"
            variants={staggerContainer}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
          >
            <motion.div variants={listItem} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Kredit</p>
                <CreditCard size={18} className="text-primary-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {balance ? formatCurrency(balance.balance) : "—"}
              </p>
              <Link href="/client/credits" className="text-xs text-primary-600 hover:underline mt-1 block">
                Zobrazit transakce →
              </Link>
              {(creditRequests ?? []).filter((r: any) => r.status === "PENDING").length > 0 && (
                <Link href="/client/credit-request" className="text-xs text-yellow-600 hover:underline block">
                  Čeká {(creditRequests ?? []).filter((r: any) => r.status === "PENDING").length} žádost o kredit
                </Link>
              )}
            </motion.div>

            <motion.div variants={listItem} className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Termínů celkem</p>
                <Calendar size={18} className="text-primary-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{appointments?.length ?? 0}</p>
              <Link href="/client/appointments" className="text-xs text-primary-600 hover:underline mt-1 block">
                Zobrazit vše →
              </Link>
            </motion.div>
          </motion.div>

          {/* Upcoming appointments — next 7 days */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-primary-500" />
                Nadcházející termíny (7 dní)
              </h2>
              <Link href="/client/appointments" className="text-xs text-primary-600 hover:underline">
                Vše →
              </Link>
            </div>
            {(upcoming ?? []).length > 0 ? (
              <div className="space-y-3">
                {(upcoming ?? []).slice(0, 5).map((appt: any) => (
                  <div key={appt.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{formatDateTime(appt.startTime)}</p>
                      {appt.serviceId && serviceMap[appt.serviceId] && (
                        <p className="text-xs text-gray-600 mt-0.5">{serviceMap[appt.serviceId]}</p>
                      )}
                      {appt.employeeId && employeeMap[appt.employeeId] && (
                        <p className="text-xs text-gray-500 mt-0.5">Terapeut: {employeeMap[appt.employeeId]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {appt.price != null && (
                        <span className="text-xs text-gray-500">{formatCurrency(appt.price)}</span>
                      )}
                      {appt.isOnline && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Video size={10} /> Online
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        appt.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                        appt.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {appt.status === "CONFIRMED" ? "Potvrzeno" : appt.status === "PENDING" ? "Čeká" : appt.status}
                      </span>
                      {appt.isOnline && appt.status === "CONFIRMED" && isVideoActive(appt.startTime) && (
                        <Link
                          href={`/video/${appt.id}`}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-0.5 rounded-full flex items-center gap-1"
                        >
                          <Video size={10} /> Připojit se
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                {(upcoming ?? []).length > 5 && (
                  <p className="text-xs text-gray-500 text-center pt-1">
                    + {(upcoming ?? []).length - 5} dalších termínů
                  </p>
                )}
              </div>
            ) : upcoming !== undefined ? (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-3">Žádný nadcházející termín v příštích 7 dnech</p>
                <Link href="/client/booking" onClick={() => haptics.success()} className="btn-primary text-sm inline-flex items-center gap-2">
                  Rezervovat <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-300 text-sm">Načítám…</div>
            )}
          </div>

          {/* Quick actions */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
            variants={staggerContainer}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
          >
            {[
              { href: "/client/booking", label: "Rezervovat", icon: <Calendar size={20} /> },
              { href: "/client/appointments", label: "Termíny", icon: <Clock size={20} /> },
              { href: "/client/credits", label: "Kredity", icon: <CreditCard size={20} /> },
              { href: "/client/reports", label: "Zprávy", icon: <FileText size={20} /> },
            ].map((item) => (
              <motion.div key={item.href} variants={listItem} whileHover={shouldReduceMotion ? {} : { scale: 1.02 }} whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}>
                <Link
                  href={item.href}
                  onClick={() => item.href === "/client/booking" ? haptics.success() : haptics.light()}
                  className="card flex flex-col items-center gap-2 py-4 hover:shadow-md transition-shadow text-center block"
                >
                  <span className="text-primary-600">{item.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
        </PullToRefresh>
      </Layout>
    </RouteGuard>
  );
}
