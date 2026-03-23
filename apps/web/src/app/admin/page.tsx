"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import SOSAlertBanner from "@/components/SOSAlertBanner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Users, Calendar, TrendingUp, Activity, AlertTriangle, Clock, Zap } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

const ACTIVITY_LABELS: Record<string, string> = {
  USER_LOGIN: "Přihlášení uživatele",
  USER_LOGOUT: "Odhlášení uživatele",
  USER_CREATED: "Vytvořen uživatel",
  USER_UPDATED: "Upraven uživatel",
  USER_DELETED: "Smazán uživatel",
  APPOINTMENT_CREATED: "Vytvořen termín",
  APPOINTMENT_UPDATED: "Upraven termín",
  APPOINTMENT_CANCELLED: "Zrušen termín",
  APPOINTMENT_COMPLETED: "Termín dokončen",
  APPOINTMENT_NO_SHOW: "Nedostavení se",
  INVOICE_CREATED: "Vytvořena faktura",
  INVOICE_PAID: "Faktura zaplacena",
  INVOICE_CANCELLED: "Faktura zrušena",
  PASSWORD_CHANGED: "Změna hesla",
  SETTINGS_UPDATED: "Změna nastavení",
  SERVICE_CREATED: "Vytvořena služba",
  SERVICE_UPDATED: "Upravena služba",
  CLIENT_CREATED: "Vytvořen klient",
  CLIENT_UPDATED: "Upraven klient",
};

function ActivityFeed() {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<{ items: any[]; total: number }>("/stats/activity-feed?limit=15", fetcher, { refreshInterval: 30_000 });

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Načítám aktivitu…</p>;
  if (!data?.items?.length) return <p className="text-sm text-gray-500 dark:text-gray-400">Žádná nedávná aktivita.</p>;

  return (
    <div className="space-y-1">
      {data.items.map((item, i) => (
        <motion.div
          key={item.id}
          initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.025 }}
          className="flex items-start gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
        >
          <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{ACTIVITY_LABELS[item.title] ?? item.title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap">
            {formatRelativeTime(item.timestamp)}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function QuickSummary() {
  const shouldReduce = useReducedMotion();
  const { data } = useSWR<any>("/stats/quick-summary", fetcher, { refreshInterval: 30_000 });
  if (!data) return null;

  const summaryCards = [
    {
      borderColor: "border-blue-400 dark:border-blue-600",
      label: "Dnes termínů",
      value: data.today.total,
      valueColor: "text-blue-600 dark:text-blue-400",
      sub: `${data.today.completed} hotovo · ${data.today.confirmed} potvrzeno`,
    },
    {
      borderColor: "border-green-400 dark:border-green-600",
      label: "Dnešní výnosy",
      value: formatCurrency(data.today.revenue),
      valueColor: "text-green-600 dark:text-green-400",
      sub: null,
    },
    {
      borderColor: "border-amber-400 dark:border-amber-600",
      label: "Blížící se (2h)",
      value: data.upcomingNext2h,
      valueColor: "text-amber-600 dark:text-amber-400",
      sub: null,
    },
    {
      borderColor: "border-red-400 dark:border-red-600",
      label: "Čeká na potvrzení",
      value: data.totalPendingAll,
      valueColor: "text-red-600 dark:text-red-400",
      sub: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {summaryCards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
          className={`card border-l-4 ${card.borderColor}`}
        >
          <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
          <p className={`text-xl font-bold ${card.valueColor}`}>{card.value}</p>
          {card.sub && <p className="text-xs text-gray-500 dark:text-gray-400">{card.sub}</p>}
        </motion.div>
      ))}
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "právě teď";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return timestamp.slice(0, 10);
}

export default function AdminDashboard() {
  const shouldReduce = useReducedMotion();
  const { data: stats } = useSWR("/stats", fetcher);
  const { data: users } = useSWR("/users", fetcher);
  const { data: health } = useSWR("/health/detailed", fetcher, { refreshInterval: 60_000 });
  const { data: pending } = useSWR("/dashboard/admin/pending", fetcher, { refreshInterval: 60_000 });

  const employeeCount = users?.filter((u: any) => u.role === "EMPLOYEE").length ?? 0;

  const secondaryStats = [
    { value: stats?.confirmedAppts, color: "text-green-600 dark:text-green-400", label: "Potvrzeno" },
    { value: stats?.cancelledAppts, color: "text-red-500 dark:text-red-400", label: "Zrušeno" },
    { value: stats?.noShowAppts, color: "text-gray-500 dark:text-gray-400", label: "No-show" },
  ];

  const pendingCards = [
    { href: "/admin/users", value: pending?.pendingActivations, borderColor: "border-yellow-400", valueColor: "text-yellow-600 dark:text-yellow-400", label: "termínů čeká na aktivaci" },
    { href: "/reception/billing", value: pending?.overdueInvoices, borderColor: "border-red-400", valueColor: "text-red-600 dark:text-red-400", label: "faktur po splatnosti" },
    { href: "/admin/users", value: pending?.waitlistCount, borderColor: "border-blue-400", valueColor: "text-blue-600 dark:text-blue-400", label: "klientů na waitlistu" },
    { href: "/admin/background", value: pending?.lowBehaviorClients, borderColor: "border-orange-400", valueColor: "text-orange-600 dark:text-orange-400", label: "klientů s nízkým skóre" },
  ];

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <SOSAlertBanner />

          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
            <AnimatePresence>
              {health && (
                <motion.span
                  key="health-badge"
                  initial={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={`badge ${health.status === "ok" ? "badge-green" : "badge-red"}`}
                >
                  {health.status === "ok" ? "Systém OK" : "Chyba DB"}
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {health && (
                <motion.span
                  key="uptime"
                  initial={shouldReduce ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduce ? {} : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xs text-gray-500 dark:text-gray-400"
                >
                  Uptime: {Math.floor(health.uptime / 3600)}h
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Quick summary — today */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap size={18} className="text-blue-500" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Dnešní přehled</h2>
            </div>
            <QuickSummary />
          </motion.div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Celkem termínů", value: stats?.totalAppts ?? "—", icon: <Calendar size={18} />, color: "blue" },
              { label: "Klientů", value: stats?.totalClients ?? "—", icon: <Users size={18} />, color: "green" },
              { label: "Výnosy", value: stats?.revenue ? formatCurrency(stats.revenue) : "—", icon: <TrendingUp size={18} />, color: "purple" },
              { label: "Zaměstnanců", value: employeeCount, icon: <Activity size={18} />, color: "orange" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.06 + i * 0.04 }}
                className="card"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
                  <span className="text-primary-500">{s.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Secondary stats */}
          <AnimatePresence>
            {stats && (
              <motion.div
                key="secondary-stats"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                className="grid grid-cols-3 gap-4 mb-8"
              >
                {secondaryStats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 + i * 0.04 }}
                    className="card text-center"
                  >
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending items widget */}
          <AnimatePresence>
            {pending && (
              <motion.div
                key="pending-items"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
                className="mb-8"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <h2 className="font-semibold text-gray-800 dark:text-gray-200">Akce vyžadující pozornost</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {pendingCards.map((card, i) => (
                    <motion.div
                      key={card.label}
                      initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.17 + i * 0.04 }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      <Link
                        href={card.href}
                        className={`card hover:shadow-md transition-shadow border-l-4 ${card.borderColor} block`}
                      >
                        <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Activity feed */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
            className="card mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-gray-500 dark:text-gray-400" />
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Nedávná aktivita</h2>
            </div>
            <ActivityFeed />
          </motion.div>

          {/* Quick links */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { href: "/admin/users", label: "Uživatelé" },
              { href: "/admin/services", label: "Služby" },
              { href: "/admin/rooms", label: "Místnosti" },
              { href: "/admin/stats", label: "Statistiky" },
              { href: "/admin/fio", label: "FIO Matching" },
              { href: "/admin/background", label: "Background" },
              { href: "/admin/settings", label: "Nastavení" },
            ].map((item, i) => (
              <motion.div
                key={item.href}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.22 + i * 0.04 }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <Link href={item.href} className="card hover:shadow-md transition-shadow text-center py-4 block">
                  <p className="font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
