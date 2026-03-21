"use client";

import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import AnimatedLogo from "@/components/ui/AnimatedLogo";
import {
  Home,
  Calendar,
  Users,
  Settings,
  LogOut,
  CreditCard,
  FileText,
  Activity,
  Clock,
  Heart,
  Bell,
  ShieldAlert,
  Mail,
  TrendingUp,
  MoreHorizontal,
  Menu,
  X,
  ClipboardList,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useReducedMotion } from "framer-motion";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";
import ThemeToggle from "@/components/ThemeToggle";
import Breadcrumbs from "@/components/Breadcrumbs";
import PageTransition from "@/components/PageTransition";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import SOSButton from "@/components/SOSButton";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";

// ── Nav item types ────────────────────────────────────────────────────────────
type Role = "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
  group?: string; // for sidebar grouping
  matchPrefix?: string;
}

// ── Bottom tab items for CLIENT mobile ────────────────────────────────────────
interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix?: string;
}

const CLIENT_TABS: TabItem[] = [
  { label: "Přehled", href: "/client", icon: <Home size={20} /> },
  { label: "Rezervovat", href: "/client/booking", icon: <Calendar size={20} />, matchPrefix: "/client/booking" },
  { label: "Termíny", href: "/client/appointments", icon: <Clock size={20} />, matchPrefix: "/client/appointments" },
  { label: "Zprávy", href: "/messages", icon: <Mail size={20} />, matchPrefix: "/messages" },
  { label: "Více", href: "#more", icon: <MoreHorizontal size={20} /> },
];

// ── All nav items ─────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  // CLIENT
  { label: "Dashboard", href: "/client", icon: <Home size={18} />, roles: ["CLIENT"] },
  { label: "Booking", href: "/client/booking", icon: <Calendar size={18} />, roles: ["CLIENT"] },
  { label: "Moje termíny", href: "/client/appointments", icon: <Clock size={18} />, roles: ["CLIENT"] },
  { label: "Kredity", href: "/client/credits", icon: <CreditCard size={18} />, roles: ["CLIENT"] },
  { label: "Terapeutické zprávy", href: "/client/reports", icon: <FileText size={18} />, roles: ["CLIENT"] },
  { label: "Pokrok", href: "/client/progress", icon: <Activity size={18} />, roles: ["CLIENT"] },
  { label: "Waitlist", href: "/client/waitlist", icon: <Clock size={18} />, roles: ["CLIENT"] },
  { label: "Faktury", href: "/client/invoices", icon: <FileText size={18} />, roles: ["CLIENT"] },
  { label: "Požádat o kredit", href: "/client/credit-request", icon: <CreditCard size={18} />, roles: ["CLIENT"] },
  { label: "Zdravotní karta", href: "/client/health-record", icon: <Heart size={18} />, roles: ["CLIENT"] },
  { label: "Balíčky", href: "/client/packages", icon: <CreditCard size={18} />, roles: ["CLIENT"] },
  { label: "Domácí cvičení", href: "/client/homework", icon: <Activity size={18} />, roles: ["CLIENT"] },
  { label: "Dotazníky", href: "/client/questionnaires", icon: <ClipboardList size={18} />, roles: ["CLIENT"] },
  { label: "Nastavení notifikací", href: "/client/settings", icon: <Bell size={18} />, roles: ["CLIENT"] },
  { label: "Skupiny podpory", href: "/client/groups", icon: <Users size={18} />, roles: ["CLIENT"], matchPrefix: "/client/groups" },
  { label: "Výmaz dat (GDPR)", href: "/client/erasure-request", icon: <ShieldAlert size={18} />, roles: ["CLIENT"] },

  // RECEPTION — grouped
  { label: "Přehled", href: "/reception", icon: <Home size={18} />, roles: ["RECEPTION"], group: "Přehled" },
  { label: "Kalendář", href: "/reception/calendar", icon: <Calendar size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Termíny", href: "/reception/appointments", icon: <Clock size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Harmonogram", href: "/reception/schedule", icon: <Calendar size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Pracovní hodiny", href: "/reception/working-hours", icon: <Calendar size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Klienti", href: "/reception/clients", icon: <Users size={18} />, roles: ["RECEPTION"], group: "Klienti" },
  { label: "Zdravotní záznamy", href: "/reception/health-records", icon: <Heart size={18} />, roles: ["RECEPTION"], group: "Klienti" },
  { label: "Waitlist", href: "/reception/waitlist", icon: <Clock size={18} />, roles: ["RECEPTION"], group: "Klienti" },
  { label: "Billing", href: "/reception/billing", icon: <CreditCard size={18} />, roles: ["RECEPTION"], group: "Finance" },
  { label: "Žádosti o kredit", href: "/reception/credit-requests", icon: <CreditCard size={18} />, roles: ["RECEPTION"], group: "Finance" },

  // EMPLOYEE
  { label: "Kalendář", href: "/employee", icon: <Calendar size={18} />, roles: ["EMPLOYEE"] },
  { label: "Termíny", href: "/employee/appointments", icon: <Clock size={18} />, roles: ["EMPLOYEE"] },
  { label: "Lékařské zprávy", href: "/employee/reports", icon: <FileText size={18} />, roles: ["EMPLOYEE"] },
  { label: "Šablony zpráv (PDF)", href: "/employee/therapy-reports", icon: <FileText size={18} />, roles: ["EMPLOYEE"] },
  { label: "Domácí cvičení", href: "/employee/homework", icon: <Activity size={18} />, roles: ["EMPLOYEE"] },
  { label: "Moji klienti", href: "/employee/clients", icon: <Users size={18} />, roles: ["EMPLOYEE"] },
  { label: "Kolegové", href: "/employee/colleagues", icon: <Users size={18} />, roles: ["EMPLOYEE"] },
  { label: "Skupiny podpory", href: "/employee/groups", icon: <Users size={18} />, roles: ["EMPLOYEE"], matchPrefix: "/employee/groups" },
  { label: "Můj wellbeing", href: "/employee/wellbeing", icon: <Heart size={18} />, roles: ["EMPLOYEE"] },

  // ADMIN — grouped
  { label: "Dashboard", href: "/admin", icon: <Home size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "BI Dashboard", href: "/admin/bi", icon: <TrendingUp size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Statistiky", href: "/admin/stats", icon: <Activity size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Termíny", href: "/reception/appointments", icon: <Calendar size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Uživatelé", href: "/admin/users", icon: <Users size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Služby", href: "/admin/services", icon: <Activity size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Místnosti", href: "/admin/rooms", icon: <Home size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Balíčky", href: "/admin/packages", icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Dotazníky", href: "/admin/questionnaires", icon: <ClipboardList size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Skupiny podpory", href: "/admin/groups", icon: <Users size={18} />, roles: ["ADMIN"], group: "Správa", matchPrefix: "/admin/groups" },
  { label: "Platby a párování", href: "/admin/fio", icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "Pojišťovny", href: "/admin/insurance", icon: <FileText size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "Poj. fakturace", href: "/admin/insurance/billing", icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "Žádosti o kredit", href: "/reception/credit-requests", icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "AI Waitlist", href: "/admin/ai-waitlist", icon: <TrendingUp size={18} />, roles: ["ADMIN"], group: "Nástroje" },
  { label: "Automatizace", href: "/admin/background", icon: <Activity size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Monitoring", href: "/admin/monitoring", icon: <Activity size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Relace", href: "/admin/sessions", icon: <Activity size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "API klíče", href: "/admin/api-keys", icon: <Activity size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "GDPR", href: "/admin/gdpr", icon: <ShieldAlert size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Audit log", href: "/admin/audit", icon: <ShieldAlert size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Lékařské zprávy", href: "/admin/medical-reports", icon: <FileText size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Hromadné notif.", href: "/admin/notifications", icon: <Bell size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Systémové nastavení", href: "/admin/settings", icon: <Settings size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Wellbeing týmu", href: "/admin/staff-wellbeing", icon: <Heart size={18} />, roles: ["ADMIN"], group: "Systém" },

  // ── Shared items (always at bottom) ─────────────────────────────────────────
  { label: "Zprávy", href: "/messages", icon: <Mail size={18} />, roles: ["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"] },
  { label: "Notifikace", href: "/notifications", icon: <Bell size={18} />, roles: ["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"] },
];

// ── Group nav items by group ──────────────────────────────────────────────────
function groupItems(items: NavItem[]): { group: string | null; items: NavItem[] }[] {
  const groups: { group: string | null; items: NavItem[] }[] = [];
  let current: { group: string | null; items: NavItem[] } | null = null;
  for (const item of items) {
    const g = item.group ?? null;
    if (!current || current.group !== g) {
      current = { group: g, items: [item] };
      groups.push(current);
    } else {
      current.items.push(item);
    }
  }
  return groups;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const shouldReduce = useReducedMotion();

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+K → focus search, Escape → close mobile menu
  const shortcuts = useMemo(
    () => [
      {
        key: "k",
        meta: true,
        handler: () => {
          const input = document.querySelector<HTMLInputElement>('[placeholder="Hledat..."]');
          input?.focus();
        },
      },
      {
        key: "Escape",
        global: true,
        handler: () => {
          setMobileOpen(false);
          setMoreOpen(false);
        },
      },
    ],
    []
  );
  useKeyboardShortcuts(shortcuts);

  if (!user) return null;

  const myNavItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const grouped = groupItems(myNavItems);
  const isClient = user.role === "CLIENT";

  // Items for client "More" bottom sheet (items not in bottom tabs)
  const clientMoreItems = isClient
    ? myNavItems.filter(
        (item) => !CLIENT_TABS.some((tab) => tab.href === item.href) && item.href !== "/client"
      )
    : [];

  const isTabActive = (tab: TabItem) => {
    if (tab.href === "/client") return pathname === "/client";
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix);
    return false;
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside aria-label="Postranní navigace" className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed h-full">
        {/* Brand */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <AnimatedLogo size={28} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Přístav Radosti</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Neurorehabilitace</p>
            </div>
          </div>
        </div>

        {/* Nav with groups */}
        <nav aria-label="Hlavní navigace" className="flex-1 p-4 space-y-1 overflow-y-auto">
          {["ADMIN", "RECEPTION", "EMPLOYEE"].includes(user.role) && (
            <div className="mb-3">
              <GlobalSearch />
            </div>
          )}
          {grouped.map((section, idx) => {
            const isCollapsible = ["ADMIN", "RECEPTION"].includes(user.role) && !!section.group;
            const isCollapsed = isCollapsible && collapsedGroups.has(section.group!);
            return (
              <div key={section.group ?? `ungrouped-${idx}`}>
                {section.group && (
                  isCollapsible ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(section.group!)}
                      className="flex items-center justify-between w-full text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mt-4 mb-1 px-3 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <span>{section.group}</span>
                      <motion.span
                        animate={shouldReduce ? {} : { rotate: isCollapsed ? -90 : 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ display: "inline-flex" }}
                      >
                        <ChevronDown size={12} />
                      </motion.span>
                    </button>
                  ) : (
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mt-4 mb-1 px-3">
                      {section.group}
                    </p>
                  )
                )}
                {!isCollapsed && section.items.map((item) => {
                  const isActive = pathname === item.href || (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname.startsWith(item.href + "/"));
                  return (
                    <motion.div
                      key={item.href}
                      className="relative"
                      whileHover={shouldReduce ? {} : { x: 2 }}
                      transition={{ duration: 0.15 }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 bg-primary-50 dark:bg-primary-900/30 rounded-lg"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <Link
                        href={item.href}
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors min-h-[44px]",
                          isActive
                            ? "text-primary-700 dark:text-primary-400 font-medium"
                            : "text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User panel */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-primary-100 dark:bg-primary-900/40 flex-shrink-0">
              {user.avatarUrl ? (
                <Image
                  src={`${process.env.NEXT_PUBLIC_API_URL || "/api"}${user.avatarUrl}`}
                  alt={user.name}
                  width={32}
                  height={32}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-primary-700 dark:text-primary-400 text-xs font-bold">{getInitials(user.name)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <NotificationBell />
            <ThemeToggle />
          </div>
          <Link href="/settings" className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 mb-2 min-h-[44px]">
            <Settings size={14} />
            Nastavení
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 w-full min-h-[44px]"
          >
            <LogOut size={14} />
            Odhlásit se
          </button>
        </div>
      </aside>

      {/* ═══ Main content ═══ */}
      <div className={cn("flex-1 md:ml-64 flex flex-col", isClient && "pb-16 md:pb-0")}>
        {/* Mobile header */}
        <header className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <AnimatedLogo size={24} />
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Přístav Radosti</span>
          </div>
          {["ADMIN", "RECEPTION", "EMPLOYEE"].includes(user.role) && (
            <div className="flex-1 max-w-xs">
              <GlobalSearch />
            </div>
          )}
          <ThemeToggle />
          {/* Non-CLIENT roles get hamburger menu */}
          {!isClient && (
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-gray-500 dark:text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={mobileOpen ? "Zavřít menu" : "Otevřít menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
          {/* CLIENT gets notification bell in header instead */}
          {isClient && <NotificationBell />}
        </header>

        {/* Mobile nav (non-CLIENT hamburger dropdown) */}
        <AnimatePresence>
        {mobileOpen && !isClient && (
          <motion.nav
            aria-label="Mobilní navigace"
            className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 space-y-1 max-h-[70vh] overflow-y-auto"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" as const }}
          >
            {grouped.map((section, idx) => (
              <div key={section.group ?? `m-ungrouped-${idx}`}>
                {section.group && (
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mt-3 mb-1 px-3">
                    {section.group}
                  </p>
                )}
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm min-h-[44px]",
                      pathname === item.href || pathname.startsWith(item.href + "/")
                        ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                        : "text-gray-600 dark:text-gray-500"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
            <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-red-500 text-sm w-full min-h-[44px]">
              <LogOut size={18} />
              Odhlásit se
            </button>
          </motion.nav>
        )}
        </AnimatePresence>

        {/* Content */}
        <main id="main-content" className="flex-1 p-4 md:p-6" tabIndex={-1}>
          <Breadcrumbs />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* ═══ CLIENT Mobile Bottom Tab Bar ═══ */}
      {isClient && (
        <>
          <nav
            aria-label="Mobilní navigace"
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40 safe-area-bottom"
          >
            <div className="flex items-stretch justify-around">
              {CLIENT_TABS.map((tab) => {
                if (tab.href === "#more") {
                  return (
                    <button
                      key="more"
                      onClick={() => setMoreOpen(!moreOpen)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-h-[56px] text-[10px] transition-colors",
                        moreOpen
                          ? "text-primary-600 dark:text-primary-400"
                          : "text-gray-500 dark:text-gray-500"
                      )}
                    >
                      <MoreHorizontal size={20} />
                      <span>{tab.label}</span>
                    </button>
                  );
                }
                const active = isTabActive(tab);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-0.5 py-2 px-1 flex-1 min-h-[56px] text-[10px] transition-colors",
                      active
                        ? "text-primary-600 dark:text-primary-400"
                        : "text-gray-500 dark:text-gray-500"
                    )}
                  >
                    {tab.icon}
                    <span className={cn(active && "font-semibold")}>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* "More" bottom sheet */}
          <AnimatePresence>
          {moreOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="md:hidden fixed inset-0 bg-black/30 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setMoreOpen(false)}
              />
              {/* Sheet */}
              <motion.div
                className="md:hidden fixed bottom-[56px] left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-800 max-h-[60vh] overflow-y-auto safe-area-bottom"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.28, ease: "easeOut" as const }}
              >
                <div className="p-4">
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                  <div className="space-y-1">
                    {clientMoreItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm min-h-[44px]",
                          pathname === item.href || pathname.startsWith(item.href + "/")
                            ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium"
                            : "text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    ))}
                    <div className="border-t border-gray-100 dark:border-gray-800 my-2" />
                    <Link
                      href="/settings"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-600 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[44px]"
                    >
                      <Settings size={18} />
                      Nastavení účtu
                    </Link>
                    <button
                      onClick={() => { setMoreOpen(false); logout(); }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-red-500 w-full min-h-[44px]"
                    >
                      <LogOut size={18} />
                      Odhlásit se
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
          </AnimatePresence>
        </>
      )}

      {/* SOS floating button — visible on every page */}
      <SOSButton />

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Push Notification Prompt (after 2nd login) */}
      <PushNotificationPrompt />
    </div>
  );
}
