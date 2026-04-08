"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, CreditCard, Clock, ArrowRight, Video, Sparkles, WifiOff, CalendarPlus, X } from "lucide-react";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { haptics } from "@/lib/haptics";
import { useEffect, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";


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
  const { mutate: mutateNotifs } = useSWR<any>("/notifications", fetcher);
  const { data: services } = useSWR<any[]>("/services", fetcher);
  const { data: employees } = useSWR<any[]>("/employees", fetcher);
  const { data: creditRequests } = useSWR<any[]>("/credit-requests", fetcher);

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
        <div className="max-w-4xl mx-auto px-1">

          {/* ── Welcome Hero ── */}
          {(() => {
            const { greeting, dateStr } = getDailyGreeting(user?.name ?? "");
            return (
              <motion.div
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="mb-8 pt-2"
              >
                <h1 className="text-4xl font-extrabold tracking-tight text-primary">{greeting}</h1>
                <p className="text-on-surface-variant text-base mt-1.5">
                  Vaše útočiště pro odolnost a pokrok.
                </p>
                <p className="text-on-surface-variant/60 text-sm mt-0.5">{dateStr}</p>
              </motion.div>
            );
          })()}

          {/* Offline notice */}
          {isOffline && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-secondary-100 px-4 py-3 text-secondary-700 text-sm"
                 style={{ border: '1px solid rgba(232, 106, 36, 0.15)' }}>
              <WifiOff size={16} className="flex-shrink-0 text-secondary" />
              <span>Zobrazena jsou uložená data z poslední návštěvy.</span>
            </div>
          )}

          {/* Onboarding checklist */}
          <OnboardingChecklist />

          {/* ── Hero: Next Session Card ── */}
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
                <motion.div
                  className="relative overflow-hidden rounded-2xl bg-white p-6 mb-8 atmospheric-shadow"
                  style={{ border: '1px solid rgba(199, 197, 209, 0.12)' }}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28, mass: 0.8 }}
                >
                  {/* Decorative sparkle */}
                  <div className="absolute top-3 right-3 text-primary-100">
                    <Sparkles size={64} className="opacity-30" />
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
                    Vaše příští sezení — {timeLabel}
                  </p>
                  <p className="text-3xl font-bold text-primary mb-1">{formatDateTime(next.startTime)}</p>
                  <div className="flex flex-wrap gap-2 text-sm text-on-surface-variant mb-5">
                    {next.serviceId && serviceMap[next.serviceId] && (
                      <span>{serviceMap[next.serviceId]}</span>
                    )}
                    {next.employeeId && employeeMap[next.employeeId] && (
                      <span>· {employeeMap[next.employeeId]}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      onClick={() => downloadIcs(next)}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary text-sm gap-1.5"
                    >
                      <CalendarPlus size={14} /> Přidat do kalendáře
                    </motion.button>
                    {next.status !== "CANCELLED" && (
                      <motion.button
                        onClick={() => handleCancelNext(next.id)}
                        disabled={cancellingId === next.id}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all min-h-[44px] text-on-surface-variant hover:text-error hover:bg-error-container/40"
                        style={{ border: '1px solid rgba(199, 197, 209, 0.15)' }}
                      >
                        <X size={14} /> {cancellingId === next.id ? "Ruším…" : "Zrušit"}
                      </motion.button>
                    )}
                    {next.isOnline && next.status === "CONFIRMED" && isVideoActive(next.startTime) && (
                      <Link
                        href={`/video/${next.id}`}
                        className="btn-accent text-sm gap-1.5"
                      >
                        <Video size={14} /> Připojit se
                      </Link>
                    )}
                  </div>
                </motion.div>
              );
            })() : (
              <motion.div
                className="relative overflow-hidden rounded-2xl bg-surface-container-low p-8 mb-8 text-center atmospheric-shadow"
                style={{ border: '2px dashed rgba(36, 43, 97, 0.2)' }}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 340, damping: 28, mass: 0.8 }}
              >
                <img src="/brand/empty-appointments.svg" alt="" className="w-24 h-24 mx-auto mb-4" aria-hidden="true" />
                <h2 className="text-xl font-bold text-primary mb-2">
                  Nemáte žádný nadcházející termín
                </h2>
                <p className="text-on-surface-variant text-sm mb-6">
                  Rezervujte si termín a začněte svou cestu k uzdravení.
                </p>
                <Link
                  href="/client/booking"
                  onClick={() => haptics.success()}
                  className="btn-accent text-base font-semibold inline-flex items-center gap-2 px-8 py-4"
                >
                  <Calendar size={18} /> Rezervovat termín
                </Link>
              </motion.div>
            )
          )}

          {/* ── Progress Bento Grid (Stats) ── */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Kredit</p>
                <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                  <CreditCard size={18} className="text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-primary">
                {balance ? formatCurrency(balance.balance) : "—"}
              </p>
              <Link href="/client/credits" className="text-xs text-secondary hover:text-secondary-600 font-medium mt-2 inline-flex items-center gap-1">
                Zobrazit transakce <ArrowRight size={12} />
              </Link>
              {(creditRequests ?? []).filter((r: any) => r.status === "PENDING").length > 0 && (
                <Link href="/client/credit-request" className="text-xs text-secondary-600 hover:text-secondary-700 font-medium block mt-1">
                  Čeká {(creditRequests ?? []).filter((r: any) => r.status === "PENDING").length} žádost o kredit
                </Link>
              )}
            </motion.div>

            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 }}
              className="card"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Termínů celkem</p>
                <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Calendar size={18} className="text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-primary">{appointments?.length ?? 0}</p>
              <Link href="/client/appointments" className="text-xs text-secondary hover:text-secondary-600 font-medium mt-2 inline-flex items-center gap-1">
                Zobrazit vše <ArrowRight size={12} />
              </Link>
            </motion.div>
          </div>

          {/* ── Upcoming Appointments (7 days) ── */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
            className="card mb-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-primary flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Clock size={16} className="text-primary" />
                </div>
                Nadcházející termíny
              </h2>
              <Link href="/client/appointments" className="text-xs text-secondary hover:text-secondary-600 font-medium inline-flex items-center gap-1">
                Vše <ArrowRight size={12} />
              </Link>
            </div>
            {(upcoming ?? []).length > 0 ? (
              <div className="space-y-1">
                {(upcoming ?? []).slice(0, 5).map((appt: any, i: number) => (
                  <motion.div
                    key={appt.id}
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.25 + i * 0.05 }}
                    className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-surface-container-low transition-colors"
                  >
                    <div>
                      <p className="font-medium text-on-surface text-sm">{formatDateTime(appt.startTime)}</p>
                      {appt.serviceId && serviceMap[appt.serviceId] && (
                        <p className="text-xs text-on-surface-variant mt-0.5">{serviceMap[appt.serviceId]}</p>
                      )}
                      {appt.employeeId && employeeMap[appt.employeeId] && (
                        <p className="text-xs text-on-surface-variant/70 mt-0.5">Terapeut: {employeeMap[appt.employeeId]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {appt.price != null && (
                        <span className="text-xs text-on-surface-variant">{formatCurrency(appt.price)}</span>
                      )}
                      {appt.isOnline && (
                        <span className="text-xs bg-primary-50 text-primary px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
                          <Video size={10} /> Online
                        </span>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        appt.status === "CONFIRMED"
                          ? "bg-primary-50 text-primary"
                          : appt.status === "PENDING"
                          ? "bg-secondary-100 text-secondary-700"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}>
                        {appt.status === "CONFIRMED" ? "Potvrzeno" : appt.status === "PENDING" ? "Čeká" : appt.status}
                      </span>
                      {appt.isOnline && appt.status === "CONFIRMED" && isVideoActive(appt.startTime) && (
                        <Link
                          href={`/video/${appt.id}`}
                          className="btn-accent text-xs px-3 py-1 rounded-full gap-1"
                        >
                          <Video size={10} /> Připojit se
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
                {(upcoming ?? []).length > 5 && (
                  <p className="text-xs text-on-surface-variant text-center pt-2">
                    + {(upcoming ?? []).length - 5} dalších termínů
                  </p>
                )}
              </div>
            ) : upcoming !== undefined ? (
              <div className="text-center py-6">
                <p className="text-on-surface-variant text-sm mb-4">Žádný nadcházející termín v příštích 7 dnech</p>
                <Link href="/client/booking" onClick={() => haptics.success()} className="btn-accent text-sm inline-flex items-center gap-2">
                  Rezervovat <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="text-center py-6 text-on-surface-variant/50 text-sm">Načítám…</div>
            )}
          </motion.div>

          {/* ── Quick Links ── */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.25 }}
            className="card mb-6"
          >
            <h2 className="font-semibold text-primary mb-4">Rychlé odkazy</h2>
            <div className="space-y-1">
              {[
                { href: "/client/booking", icon: <Calendar size={18} />, label: "Rezervovat termín" },
                { href: "/client/appointments", icon: <Clock size={18} />, label: "Moje termíny" },
                { href: "/client/credits", icon: <CreditCard size={18} />, label: "Kredit a platby" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-surface-container-low transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium text-on-surface">{item.label}</span>
                  <ArrowRight size={14} className="ml-auto text-on-surface-variant/40 group-hover:text-secondary transition-colors" />
                </Link>
              ))}
            </div>
          </motion.div>

        </div>
        </PullToRefresh>
      </Layout>
    </RouteGuard>
  );
}
