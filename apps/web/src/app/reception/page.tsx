"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import SOSAlertBanner from "@/components/SOSAlertBanner";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, Users, Clock, CreditCard, TrendingUp, AlertTriangle, UserCheck, UserX, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { SkeletonStats, SkeletonList } from "@/components/Skeleton";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any>(url);

export default function ReceptionDashboard() {
  const shouldReduce = useReducedMotion();
  const today = new Date().toISOString().slice(0, 10);
  const { data: appointments, mutate } = useSWR("/appointments", fetcher);
  const { data: todayApptsDirect } = useSWR<any[]>("/appointments/today", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);
  const { data: employees } = useSWR("/employees", fetcher);
  const { data: waitlist } = useSWR("/waitlist", fetcher);
  const { data: creditRequests } = useSWR("/credit-requests", fetcher);
  const { data: revSummary } = useSWR<any>("/stats/revenue-summary", fetcher);
  const { data: rebooking } = useSWR<any[]>("/recommendations/rebooking?days=30&limit=5", fetcher as any);
  const { data: atRisk } = useSWR<any[]>("/recommendations/at-risk?limit=5", fetcher as any);

  const clientMap = Object.fromEntries(((clients as any[]) ?? []).map((c: any) => [c.id, c.name]));
  const employeeMap = Object.fromEntries(((employees as any[]) ?? []).map((e: any) => [e.id, e.name]));

  // Prefer the dedicated /appointments/today endpoint; fall back to filtering all
  const todayAppts = todayApptsDirect ?? ((appointments as any[]) ?? []).filter((a: any) =>
    a.startTime.startsWith(today) && a.status !== "CANCELLED"
  );
  const pendingActivation = ((appointments as any[]) ?? []).filter((a: any) => !a.bookingActivated && a.status === "PENDING");

  // Pre-compute riskToday outside JSX to avoid IIFE
  const riskClients = ((clients as any[]) ?? []).filter((c: any) =>
    c.behaviorScore != null && c.behaviorScore < 60
  );
  const riskToday = todayAppts?.filter((a: any) =>
    riskClients.some((c: any) => c.id === a.clientId)
  ) ?? [];

  const handleActivate = async (id: number) => {
    haptics.medium();
    await api.post(`/appointments/${id}/activate`, {});
    mutate();
  };

  const handleCheckin = async (id: number, status: string) => {
    haptics.medium();
    await api.patch(`/appointments/${id}`, { status });
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto w-full min-w-0">
          <SOSAlertBanner />
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recepce</h1>
          </div>

          {/* Loading state */}
          {!appointments && (
            <div className="space-y-6">
              <SkeletonList count={3} />
              <SkeletonStats count={4} />
            </div>
          )}

          {appointments && (<>

          {/* 1. Dnešní rozvrh — NAHOŘE */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar size={18} className="text-primary-500" />
                Dnešní rozvrh
                <span className="text-xs font-normal text-gray-500">({todayAppts?.length ?? 0})</span>
              </h2>
              <Link href="/reception/schedule" className="text-xs text-primary-600 hover:underline">
                Kalendář →
              </Link>
            </div>
            {todayAppts?.length === 0 && (
              <p className="text-gray-500 text-sm">Dnes nejsou žádné rezervace</p>
            )}
            <div className="space-y-2">
              {todayAppts
                ?.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))
                .map((a: any, i) => (
                  <motion.div
                    key={a.id}
                    layout
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.02 + i * 0.03 }}
                    className="flex items-start justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{formatDateTime(a.startTime)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {clientMap[a.clientId] ?? `Klient #${a.clientId}`} → {employeeMap[a.employeeId] ?? `Terapeut #${a.employeeId}`}
                        {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                      </p>
                    </div>
                    {["PENDING", "CONFIRMED"].includes(a.status) ? (
                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                        <motion.button
                          onClick={() => handleCheckin(a.id, "COMPLETED")}
                          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="flex items-center gap-1 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium transition-colors min-h-[32px]"
                        >
                          <CheckCircle size={12} /> Dorazil
                        </motion.button>
                        <motion.button
                          onClick={() => handleCheckin(a.id, "UNJUSTIFIED_CANCEL")}
                          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors min-h-[32px]"
                        >
                          <XCircle size={12} /> Neoprávněné storno
                        </motion.button>
                        <motion.button
                          onClick={() => handleCheckin(a.id, "PENDING")}
                          whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs font-medium transition-colors min-h-[32px]"
                        >
                          <RotateCcw size={12} /> Odložit
                        </motion.button>
                      </div>
                    ) : (
                      <span className={`badge flex-shrink-0 ${
                        a.status === "COMPLETED" ? "badge-green" :
                        a.status === "UNJUSTIFIED_CANCEL" ? "badge-red" :
                        "badge-gray"
                      }`}>
                        {a.status === "COMPLETED" ? "✓ Dorazil" :
                         a.status === "UNJUSTIFIED_CANCEL" ? "Neoprávněné storno" :
                         a.status === "CANCELLED" ? "Zrušeno" : a.status}
                      </span>
                    )}
                  </motion.div>
                ))}
            </div>
          </div>

          {/* 2. Akce vyžadující pozornost */}

          {/* Pending activation */}
          <AnimatePresence>
            {(pendingActivation?.length ?? 0) > 0 && (
              <motion.div
                key="pending-activation"
                initial={shouldReduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Nové rezervace k potvrzení</h2>
                <div className="space-y-3">
                  {pendingActivation?.map((a: any, i) => (
                    <motion.div
                      key={a.id}
                      layout
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100"
                    >
                      <div>
                        <p className="text-sm font-medium">{formatDateTime(a.startTime)}</p>
                        <p className="text-xs text-gray-500">{clientMap[a.clientId] ?? `Klient #${a.clientId}`}</p>
                      </div>
                      <motion.button
                        onClick={() => handleActivate(a.id)}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-primary text-xs"
                      >
                        Aktivovat
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Unjustified cancel risk */}
          <AnimatePresence>
            {riskToday.length > 0 && (
              <motion.div
                key="risk-today"
                initial={shouldReduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border-l-4 border-orange-400"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-500" />
                  Riziko neoprávněného storna dnes ({riskToday.length})
                </h2>
                <div className="space-y-2">
                  {riskToday.map((a: any, i) => {
                    const client = riskClients.find((c: any) => c.id === a.clientId);
                    return (
                      <motion.div
                        key={a.id}
                        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.03 + i * 0.04 }}
                        className="flex items-center justify-between text-sm py-1"
                      >
                        <span className="text-gray-700">{formatDateTime(a.startTime)} — {clientMap[a.clientId] ?? `Klient #${a.clientId}`}</span>
                        <span className="text-orange-600 font-medium text-xs">Skóre: {client?.behaviorScore?.toFixed(0)}</span>
                      </motion.div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">Klienti se skóre &lt; 60 mají vyšší pravděpodobnost neoprávněného storna</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rebooking recommendations */}
          <AnimatePresence>
            {rebooking && rebooking.length > 0 && (
              <motion.div
                key="rebooking"
                initial={shouldReduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border-l-4 border-blue-400"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <UserCheck size={16} className="text-blue-500" />
                  Doporučit novou rezervaci ({rebooking.length})
                </h2>
                <div className="space-y-2">
                  {rebooking.slice(0, 5).map((c: any, i) => (
                    <motion.div
                      key={c.id}
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.03 + i * 0.04 }}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div>
                        <span className="text-gray-800 font-medium">{c.name}</span>
                        <span className="text-gray-500 text-xs ml-2">poslední návštěva: {c.daysSinceLastVisit} dní</span>
                      </div>
                      <a href={`/reception/clients/${c.id}`} className="text-xs text-blue-600 hover:underline">
                        Detail →
                      </a>
                    </motion.div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Klienti bez nadcházející rezervace v posledních 30 dnech</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* At-Risk Clients */}
          <AnimatePresence>
            {atRisk && atRisk.length > 0 && (
              <motion.div
                key="at-risk"
                initial={shouldReduce ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border-l-4 border-red-400"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <UserX size={16} className="text-red-500" />
                  Rizikoví klienti — sledování ({atRisk.length})
                </h2>
                <div className="space-y-2">
                  {atRisk.slice(0, 5).map((c: any, i) => (
                    <motion.div
                      key={c.id}
                      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.03 + i * 0.04 }}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <div>
                        <span className="text-gray-800 font-medium">{c.name}</span>
                        <span className="text-red-400 text-xs ml-2">
                          {c.risks?.slice(0, 2).join(", ")}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-red-600">
                        {c.behavior_score ?? "?"}/100
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 3. Statistiky — DOLE */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Dnešní rezervace", value: todayAppts?.length ?? 0, icon: <Calendar size={18} />, href: "/reception/appointments" },
              { label: "Klientů", value: (clients as any[])?.length ?? 0, icon: <Users size={18} />, href: "/reception/clients" },
              { label: "Nové rezervace k potvrzení", value: pendingActivation?.length ?? 0, icon: <Clock size={18} />, href: "/reception/appointments" },
              { label: "Waitlist", value: ((waitlist as any[]) ?? []).filter((w: any) => w.status === "WAITING").length, icon: <CreditCard size={18} />, href: "/reception/waitlist" },
              { label: "Týdenní výnosy", value: revSummary ? formatCurrency(revSummary.weekRevenue ?? 0) : "—", icon: <TrendingUp size={18} />, href: "/reception/billing" },
              { label: "Žádosti o kredit", value: ((creditRequests as any[]) ?? []).filter((r: any) => r.status === "PENDING").length, icon: <CreditCard size={18} />, href: "/reception/credit-requests" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 + i * 0.04 }}
              >
                <Link href={stat.href} className="card hover:shadow-md transition-shadow block">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">{stat.label}</p>
                    <span className="text-primary-500">{stat.icon}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                </Link>
              </motion.div>
            ))}
          </div>
          </>)}
        </div>
      </Layout>
    </RouteGuard>
  );
}
