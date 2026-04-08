"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import SOSAlertBanner from "@/components/SOSAlertBanner";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Users, Calendar, TrendingUp, Activity, AlertTriangle, Clock, Zap, Home, CreditCard, Settings, BarChart3, CheckCircle2, Bell, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

const ACTIVITY_LABELS: Record<string, string> = {
  USER_LOGIN: "Přihlášení uživatele",
  USER_LOGOUT: "Odhlášení uživatele",
  USER_CREATED: "Vytvořen uživatel",
  USER_UPDATED: "Upraven uživatel",
  USER_DELETED: "Smazán uživatel",
  APPOINTMENT_CREATED: "Vytvořena rezervace",
  APPOINTMENT_UPDATED: "Upravena rezervace",
  APPOINTMENT_CANCELLED: "Zrušena rezervace",
  APPOINTMENT_COMPLETED: "Rezervace dokončena",

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

const ACTIVITY_ICONS: Record<string, typeof CheckCircle2> = {
  APPOINTMENT_COMPLETED: CheckCircle2,
  INVOICE_PAID: CheckCircle2,
  USER_LOGIN: Bell,
  USER_CREATED: Users,
  SETTINGS_UPDATED: Settings,
};

function ActivityFeed() {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<{ items: any[]; total: number }>("/stats/activity-feed?limit=15", fetcher, { refreshInterval: 30_000 });

  if (isLoading) return <p className="text-sm" style={{ color: "#46464F" }}>Načítám aktivitu...</p>;
  if (!data?.items?.length) return <p className="text-sm" style={{ color: "#46464F" }}>Žádná nedávná aktivita.</p>;

  return (
    <div className="relative pl-6">
      {/* Timeline line */}
      <div className="absolute left-2 top-2 bottom-2 w-px" style={{ backgroundColor: "rgba(36, 43, 97, 0.12)" }} />
      {data.items.map((item, i) => {
        const IconComponent = ACTIVITY_ICONS[item.title] || Bell;
        return (
          <motion.div
            key={item.id}
            initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.025 }}
            className="relative flex items-start gap-3 py-3 last:pb-0"
          >
            {/* Timeline dot */}
            <div
              className="absolute -left-6 top-3.5 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#EFF4FF", border: "2px solid #242B61" }}
            >
              <IconComponent size={8} style={{ color: "#242B61" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "#161C24" }}>{ACTIVITY_LABELS[item.title] ?? item.title}</p>
              <p className="text-xs truncate" style={{ color: "#46464F" }}>{item.description}</p>
            </div>
            <span className="text-xs flex-shrink-0 whitespace-nowrap" style={{ color: "#46464F" }}>
              {formatRelativeTime(item.timestamp)}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

function QuickSummary() {
  const shouldReduce = useReducedMotion();
  const { data } = useSWR<any>("/stats/quick-summary", fetcher, { refreshInterval: 30_000 });
  if (!data) return null;

  const summaryCards = [
    {
      label: "Dnes rezervací",
      value: data.today.total,
      sub: `${data.today.completed} hotovo \u00b7 ${data.today.confirmed} potvrzeno`,
      accent: "#242B61",
    },
    {
      label: "Dnešní výnosy",
      value: formatCurrency(data.today.revenue),
      sub: null,
      accent: "#16a34a",
    },
    {
      label: "Blížící se (2h)",
      value: data.upcomingNext2h,
      sub: null,
      accent: "#E86A24",
    },
    {
      label: "Čeká na potvrzení",
      value: data.totalPendingAll,
      sub: null,
      accent: "#dc2626",
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
          className="card"
          style={{ borderLeft: `3px solid ${card.accent}` }}
        >
          <p className="text-xs font-medium" style={{ color: "#46464F" }}>{card.label}</p>
          <p className="text-xl font-bold" style={{ color: card.accent }}>{card.value}</p>
          {card.sub && <p className="text-xs mt-0.5" style={{ color: "#46464F" }}>{card.sub}</p>}
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

/** Mini bar chart for the KPI card */
function MiniBarChart() {
  const bars = [40, 65, 50, 80, 60, 75, 90];
  return (
    <div className="flex items-end gap-1 h-10 mt-2">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm"
          style={{
            height: `${h}%`,
            backgroundColor: "rgba(255, 255, 255, 0.35)",
          }}
        />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const shouldReduce = useReducedMotion();
  const { data: stats } = useSWR("/stats", fetcher);
  const { data: users } = useSWR("/users", fetcher);
  const { data: health } = useSWR("/health/detailed", fetcher, { refreshInterval: 60_000 });
  const { data: pending } = useSWR("/dashboard/admin/pending", fetcher, { refreshInterval: 60_000 });

  const employeeCount = users?.filter((u: any) => u.role === "EMPLOYEE").length ?? 0;

  const pendingCards = [
    { href: "/admin/users", value: pending?.pendingActivations, accent: "#E86A24", label: "rezervací čeká na aktivaci" },
    { href: "/reception/billing", value: pending?.overdueInvoices, accent: "#dc2626", label: "faktur po splatnosti" },
    { href: "/admin/users", value: pending?.waitlistCount, accent: "#242B61", label: "klientů na waitlistu" },
    { href: "/admin/background", value: pending?.lowBehaviorClients, accent: "#E86A24", label: "klientů s nízkým skóre" },
  ];

  const adminHubItems = [
    { href: "/admin/users", label: "Uživatelé", desc: "Správa uživatelů a rolí", icon: <Users size={20} /> },
    { href: "/admin/services", label: "Služby", desc: "Katalog terapeutických služeb", icon: <Activity size={20} /> },
    { href: "/admin/rooms", label: "Místnosti", desc: "Správa prostor a vybavení", icon: <Home size={20} /> },
    { href: "/admin/stats", label: "Statistiky", desc: "Klinické reporty a přehledy", icon: <BarChart3 size={20} /> },
    { href: "/admin/fio", label: "FIO Matching", desc: "Párování plateb", icon: <CreditCard size={20} /> },
    { href: "/admin/background", label: "Automatizace", desc: "Systémové úlohy na pozadí", icon: <Zap size={20} /> },
    { href: "/admin/settings", label: "Nastavení", desc: "Systémová konfigurace", icon: <Settings size={20} /> },
  ];

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto" style={{ fontFamily: "var(--font-lexend, 'Lexend', sans-serif)" }}>
          <SOSAlertBanner />

          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold" style={{ color: "#242B61" }}>
                Přístav Radosti
              </h1>
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
                    className="text-xs"
                    style={{ color: "#46464F" }}
                  >
                    Uptime: {Math.floor(health.uptime / 3600)}h
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <p className="text-sm" style={{ color: "#46464F" }}>
              Centrum exekutivního řízení neurohabilitačních služeb
            </p>
          </motion.div>

          {/* Quick summary -- today */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap size={18} style={{ color: "#242B61" }} />
              <h2 className="font-semibold" style={{ color: "#161C24" }}>Dnešní přehled</h2>
            </div>
            <QuickSummary />
          </motion.div>

          {/* KPI Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {/* Active Patients */}
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.06 }}
              className="card"
              style={{ backgroundColor: "#EFF4FF" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium" style={{ color: "#46464F" }}>Aktivní pacienti</p>
                <Users size={18} style={{ color: "#242B61" }} />
              </div>
              <p className="text-3xl font-bold" style={{ color: "#242B61" }}>{stats?.totalClients ?? "\u2014"}</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp size={12} style={{ color: "#16a34a" }} />
                <span className="text-xs font-medium" style={{ color: "#16a34a" }}>+{employeeCount} staff</span>
              </div>
            </motion.div>

            {/* Staff on Duty */}
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
              className="card"
              style={{ backgroundColor: "#EFF4FF" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium" style={{ color: "#46464F" }}>Zaměstnanců</p>
                <Activity size={18} style={{ color: "#242B61" }} />
              </div>
              <p className="text-3xl font-bold" style={{ color: "#242B61" }}>{employeeCount}</p>
              <p className="text-xs mt-1" style={{ color: "#46464F" }}>aktivních ve službě</p>
            </motion.div>

            {/* Weekly Sessions -- dark primary card with mini bar chart */}
            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
              className="card col-span-2 md:col-span-1 signature-gradient"
              style={{ border: "none" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-white/70">Celkem rezervací</p>
                <Calendar size={18} className="text-white/70" />
              </div>
              <p className="text-3xl font-bold text-white">{stats?.totalAppts ?? "\u2014"}</p>
              <MiniBarChart />
            </motion.div>
          </div>

          {/* Revenue stat */}
          <AnimatePresence>
            {stats && (
              <motion.div
                key="revenue-stats"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                className="grid grid-cols-3 gap-4 mb-8"
              >
                <motion.div className="card text-center" style={{ backgroundColor: "#EFF4FF" }}>
                  <p className="text-2xl font-bold" style={{ color: "#242B61" }}>
                    {stats?.revenue ? formatCurrency(stats.revenue) : "\u2014"}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#46464F" }}>Výnosy</p>
                </motion.div>
                <motion.div className="card text-center" style={{ backgroundColor: "#EFF4FF" }}>
                  <p className="text-2xl font-bold" style={{ color: "#16a34a" }}>{stats?.confirmedAppts}</p>
                  <p className="text-xs mt-1" style={{ color: "#46464F" }}>Potvrzeno</p>
                </motion.div>
                <motion.div className="card text-center" style={{ backgroundColor: "#EFF4FF" }}>
                  <p className="text-2xl font-bold" style={{ color: "#dc2626" }}>{stats?.cancelledAppts}</p>
                  <p className="text-xs mt-1" style={{ color: "#46464F" }}>Zrušeno</p>
                </motion.div>
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
                  <AlertTriangle size={18} style={{ color: "#E86A24" }} />
                  <h2 className="font-semibold" style={{ color: "#161C24" }}>Akce vyžadující pozornost</h2>
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
                        className="card block transition-shadow"
                        style={{ borderLeft: `3px solid ${card.accent}` }}
                      >
                        <p className="text-2xl font-bold" style={{ color: card.accent }}>{card.value}</p>
                        <p className="text-xs mt-1" style={{ color: "#46464F" }}>{card.label}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Weekly Insight Banner */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.18 }}
            className="signature-gradient rounded-2xl p-6 mb-8 flex items-center justify-between"
            style={{ boxShadow: "0 12px 40px 0 rgba(36, 43, 97, 0.15)" }}
          >
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Týdenní přehled</h3>
              <p className="text-sm text-white/70">Prohlédněte si kompletní statistiky a klinické reporty za tento týden.</p>
            </div>
            <Link
              href="/admin/stats"
              className="btn-accent flex-shrink-0 ml-4"
            >
              Zobrazit
            </Link>
          </motion.div>

          {/* Wave divider */}
          <div className="w-full h-8 bg-[url('/brand/wave-divider.svg')] bg-cover bg-no-repeat opacity-30 my-4" aria-hidden="true" />

          {/* System Activity Timeline */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
            className="card mb-8"
            style={{ backgroundColor: "#F8F9FF" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} style={{ color: "#242B61" }} />
              <h2 className="font-semibold" style={{ color: "#161C24" }}>Systémová aktivita</h2>
            </div>
            <ActivityFeed />
          </motion.div>

          {/* Administrative Hub */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.22 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Settings size={18} style={{ color: "#242B61" }} />
              <h2 className="font-semibold" style={{ color: "#161C24" }}>Administrativní centrum</h2>
            </div>
            <div className="card p-0 overflow-hidden" style={{ backgroundColor: "#F8F9FF" }}>
              {adminHubItems.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.24 + i * 0.03 }}
                >
                  <Link
                    href={item.href}
                    className="flex items-center gap-4 px-5 py-4 transition-colors block"
                    style={{
                      borderBottom: i < adminHubItems.length - 1 ? "1px solid rgba(36, 43, 97, 0.08)" : "none",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#EFF4FF")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: "#EFF4FF", color: "#242B61" }}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#161C24" }}>{item.label}</p>
                      <p className="text-xs" style={{ color: "#46464F" }}>{item.desc}</p>
                    </div>
                    <ChevronRight size={16} style={{ color: "#46464F" }} className="flex-shrink-0" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
