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
import { haptics } from "@/lib/haptics";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";

// Tab bar height (px) — keep in sync with SOSButton and globals.css
const TAB_H = 64;

// ── Nav item types ─────────────────────────────────────────────────────────────
type Role = "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: Role[];
  group?: string;
  matchPrefix?: string;
}

interface TabItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  matchPrefix?: string;
}

const CLIENT_TABS: TabItem[] = [
  { label: "Přehled",   href: "/client",               icon: <Home     size={24} strokeWidth={1.75} /> },
  { label: "Rezervovat",href: "/client/booking",       icon: <Calendar size={24} strokeWidth={1.75} />, matchPrefix: "/client/booking" },
  { label: "Termíny",   href: "/client/appointments",  icon: <Clock    size={24} strokeWidth={1.75} />, matchPrefix: "/client/appointments" },
  { label: "Zprávy",    href: "/messages",             icon: <Mail     size={24} strokeWidth={1.75} />, matchPrefix: "/messages" },
  { label: "Více",      href: "#more",                 icon: <MoreHorizontal size={24} strokeWidth={1.75} /> },
];

const CLIENT_MORE_ITEM_HREFS = [
  "/client/credits",
  "/client/credit-request",
  "/client/reports",
  "/client/progress",
  "/client/invoices",
  "/client/health-record",
  "/client/packages",
  "/client/homework",
  "/client/questionnaires",
  "/client/waitlist",
  "/client/groups",
  "/client/settings",
  "/client/erasure-request",
];

const NAV_ITEMS: NavItem[] = [
  // CLIENT
  { label: "Dashboard",              href: "/client",                    icon: <Home         size={18} />, roles: ["CLIENT"] },
  { label: "Booking",                href: "/client/booking",            icon: <Calendar     size={18} />, roles: ["CLIENT"] },
  { label: "Moje termíny",           href: "/client/appointments",       icon: <Clock        size={18} />, roles: ["CLIENT"] },
  { label: "Kredity",                href: "/client/credits",            icon: <CreditCard   size={18} />, roles: ["CLIENT"] },
  { label: "Terapeutické zprávy",    href: "/client/reports",            icon: <FileText     size={18} />, roles: ["CLIENT"] },
  { label: "Pokrok",                 href: "/client/progress",           icon: <Activity     size={18} />, roles: ["CLIENT"] },
  { label: "Waitlist",               href: "/client/waitlist",           icon: <Clock        size={18} />, roles: ["CLIENT"] },
  { label: "Faktury",                href: "/client/invoices",           icon: <FileText     size={18} />, roles: ["CLIENT"] },
  { label: "Požádat o kredit",       href: "/client/credit-request",     icon: <CreditCard   size={18} />, roles: ["CLIENT"] },
  { label: "Zdravotní karta",        href: "/client/health-record",      icon: <Heart        size={18} />, roles: ["CLIENT"] },
  { label: "Balíčky",                href: "/client/packages",           icon: <CreditCard   size={18} />, roles: ["CLIENT"] },
  { label: "Domácí cvičení",         href: "/client/homework",           icon: <Activity     size={18} />, roles: ["CLIENT"] },
  { label: "Dotazníky",              href: "/client/questionnaires",     icon: <ClipboardList size={18} />, roles: ["CLIENT"] },
  { label: "Nastavení notifikací",   href: "/client/settings",           icon: <Bell         size={18} />, roles: ["CLIENT"] },
  { label: "Skupiny podpory",        href: "/client/groups",             icon: <Users        size={18} />, roles: ["CLIENT"], matchPrefix: "/client/groups" },
  { label: "Výmaz dat (GDPR)",       href: "/client/erasure-request",    icon: <ShieldAlert  size={18} />, roles: ["CLIENT"] },

  // RECEPTION — grouped
  { label: "Přehled",          href: "/reception",                  icon: <Home       size={18} />, roles: ["RECEPTION"], group: "Přehled" },
  { label: "Kalendář",         href: "/reception/calendar",         icon: <Calendar   size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Termíny",          href: "/reception/appointments",     icon: <Clock      size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Harmonogram",      href: "/reception/schedule",         icon: <Calendar   size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Pracovní hodiny",  href: "/reception/working-hours",    icon: <Calendar   size={18} />, roles: ["RECEPTION"], group: "Termíny" },
  { label: "Klienti",          href: "/reception/clients",          icon: <Users      size={18} />, roles: ["RECEPTION"], group: "Klienti" },
  { label: "Zdravotní záznamy",href: "/reception/health-records",   icon: <Heart      size={18} />, roles: ["RECEPTION"], group: "Klienti" },
  { label: "Waitlist",         href: "/reception/waitlist",         icon: <Clock      size={18} />, roles: ["RECEPTION"], group: "Klienti" },
  { label: "Billing",          href: "/reception/billing",          icon: <CreditCard size={18} />, roles: ["RECEPTION"], group: "Finance" },
  { label: "Žádosti o kredit", href: "/reception/credit-requests",  icon: <CreditCard size={18} />, roles: ["RECEPTION"], group: "Finance" },

  // EMPLOYEE
  { label: "Kalendář",           href: "/employee",                   icon: <Calendar  size={18} />, roles: ["EMPLOYEE"] },
  { label: "Termíny",            href: "/employee/appointments",      icon: <Clock     size={18} />, roles: ["EMPLOYEE"] },
  { label: "Lékařské zprávy",    href: "/employee/reports",           icon: <FileText  size={18} />, roles: ["EMPLOYEE"] },
  { label: "Šablony zpráv (PDF)",href: "/employee/therapy-reports",   icon: <FileText  size={18} />, roles: ["EMPLOYEE"] },
  { label: "Domácí cvičení",     href: "/employee/homework",          icon: <Activity  size={18} />, roles: ["EMPLOYEE"] },
  { label: "Moji klienti",       href: "/employee/clients",           icon: <Users     size={18} />, roles: ["EMPLOYEE"] },
  { label: "Kolegové",           href: "/employee/colleagues",        icon: <Users     size={18} />, roles: ["EMPLOYEE"] },
  { label: "Skupiny podpory",    href: "/employee/groups",            icon: <Users     size={18} />, roles: ["EMPLOYEE"], matchPrefix: "/employee/groups" },
  { label: "Můj wellbeing",      href: "/employee/wellbeing",         icon: <Heart     size={18} />, roles: ["EMPLOYEE"] },

  // ADMIN — grouped
  { label: "Dashboard",          href: "/admin",                      icon: <Home       size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "BI Dashboard",       href: "/admin/bi",                   icon: <TrendingUp size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Statistiky",         href: "/admin/stats",                icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Termíny",            href: "/reception/appointments",     icon: <Calendar   size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Uživatelé",          href: "/admin/users",                icon: <Users      size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Služby",             href: "/admin/services",             icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Místnosti",          href: "/admin/rooms",                icon: <Home       size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Balíčky",            href: "/admin/packages",             icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Dotazníky",          href: "/admin/questionnaires",       icon: <ClipboardList size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Skupiny podpory",    href: "/admin/groups",               icon: <Users      size={18} />, roles: ["ADMIN"], group: "Správa", matchPrefix: "/admin/groups" },
  { label: "Platby a párování",  href: "/admin/fio",                  icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "Pojišťovny",         href: "/admin/insurance",            icon: <FileText   size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "Poj. fakturace",     href: "/admin/insurance/billing",    icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "Žádosti o kredit",   href: "/reception/credit-requests",  icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Finance" },
  { label: "AI Waitlist",        href: "/admin/ai-waitlist",          icon: <TrendingUp size={18} />, roles: ["ADMIN"], group: "Nástroje" },
  { label: "Automatizace",       href: "/admin/background",           icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Monitoring",         href: "/admin/monitoring",           icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Relace",             href: "/admin/sessions",             icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "API klíče",          href: "/admin/api-keys",             icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "GDPR",               href: "/admin/gdpr",                 icon: <ShieldAlert size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Audit log",          href: "/admin/audit",                icon: <ShieldAlert size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Lékařské zprávy",    href: "/admin/medical-reports",      icon: <FileText   size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Hromadné notif.",    href: "/admin/notifications",        icon: <Bell       size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Systémové nastavení",href: "/admin/settings",             icon: <Settings   size={18} />, roles: ["ADMIN"], group: "Systém" },
  { label: "Wellbeing týmu",     href: "/admin/staff-wellbeing",      icon: <Heart      size={18} />, roles: ["ADMIN"], group: "Systém" },

  // Shared
  { label: "Zprávy",     href: "/messages",      icon: <Mail size={18} />, roles: ["CLIENT","RECEPTION","EMPLOYEE","ADMIN"] },
  { label: "Notifikace", href: "/notifications", icon: <Bell size={18} />, roles: ["CLIENT","RECEPTION","EMPLOYEE","ADMIN"] },
];

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

// ── Component ──────────────────────────────────────────────────────────────────
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

  const clientMoreItems = isClient
    ? myNavItems.filter((item) => CLIENT_MORE_ITEM_HREFS.includes(item.href))
    : [];

  const isTabActive = (tab: TabItem) => {
    if (tab.href === "/client") return pathname === "/client";
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix);
    return false;
  };

  const isMoreRouteActive = CLIENT_MORE_ITEM_HREFS.some((href) =>
    pathname === href || pathname.startsWith(href + "/")
  );

  return (
    // h-[100dvh] + overflow-hidden = fixed shell, only <main> scrolls
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ═══ Desktop Sidebar ═══ */}
      <aside
        aria-label="Postranní navigace"
        className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed inset-y-0 left-0"
      >
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

        {/* Nav */}
        <nav aria-label="Hlavní navigace" className="flex-1 p-4 space-y-1 overflow-y-auto">
          {["ADMIN", "RECEPTION", "EMPLOYEE"].includes(user.role) && (
            <div className="mb-3"><GlobalSearch /></div>
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
                <Image src={`/api${user.avatarUrl}`} alt={user.name} width={32} height={32} unoptimized className="w-full h-full object-cover" />
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
          <button onClick={logout} className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 w-full min-h-[44px]">
            <LogOut size={14} />
            Odhlásit se
          </button>
        </div>
      </aside>

      {/* ═══ Main content column ═══ */}
      <div
        className={cn(
          "flex-1 flex flex-col overflow-hidden md:ml-64",
          // Bottom padding reserves space for the fixed tab bar (CLIENT mobile only)
          isClient && `pb-[calc(${TAB_H}px+env(safe-area-inset-bottom,0px))] md:pb-0`
        )}
      >
        {/* ── Mobile header ── */}
        <header className="md:hidden flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 h-14 flex items-center px-3 gap-2">
          {/* Hamburger (non-CLIENT) */}
          {!isClient && (
            <button
              onClick={() => setMobileOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 flex-shrink-0"
              aria-label="Otevřít menu"
              aria-expanded={mobileOpen}
            >
              <Menu size={22} />
            </button>
          )}

          {/* Brand */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <AnimatedLogo size={20} />
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">Přístav Radosti</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* ── Search bar for staff (sticky below header on mobile) ── */}
        {["ADMIN", "RECEPTION", "EMPLOYEE"].includes(user.role) && (
          <div className="md:hidden flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-3 py-2">
            <GlobalSearch />
          </div>
        )}

        {/* ── Page content ── */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6"
          tabIndex={-1}
        >
          <Breadcrumbs />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* ═══ Non-CLIENT Mobile Drawer (left slide-in) ═══ */}
      {!isClient && (
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="md:hidden fixed inset-0 bg-black/50 z-[59]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setMobileOpen(false)}
              />

              {/* Drawer panel */}
              <motion.aside
                aria-label="Mobilní navigace"
                className="md:hidden fixed inset-y-0 left-0 w-[288px] bg-white dark:bg-gray-900 z-[60] flex flex-col shadow-2xl"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.85 }}
              >
                {/* Drawer header — teal with user info */}
                <div className="relative bg-primary-600 px-5 pb-5 pt-10 safe-area-top flex-shrink-0">
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white"
                    aria-label="Zavřít menu"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <Image src={`/api${user.avatarUrl}`} alt={user.name} width={48} height={48} unoptimized className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">{getInitials(user.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-base truncate">{user.name}</p>
                      <p className="text-white/70 text-xs truncate">{user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-2">
                  {grouped.map((section, idx) => {
                    const isCollapsible = ["ADMIN", "RECEPTION"].includes(user.role) && !!section.group;
                    const isCollapsed = isCollapsible && collapsedGroups.has(section.group!);
                    return (
                      <div key={section.group ?? `d-${idx}`}>
                        {section.group && (
                          isCollapsible ? (
                            <button
                              type="button"
                              onClick={() => toggleGroup(section.group!)}
                              className="flex items-center justify-between w-full px-5 py-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
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
                            <p className="px-5 py-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              {section.group}
                            </p>
                          )
                        )}
                        {!isCollapsed && section.items.map((item) => {
                          const isActive = pathname === item.href || (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname.startsWith(item.href + "/"));
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "flex items-center gap-4 px-5 py-3.5 text-[15px] min-h-[52px] transition-colors",
                                isActive
                                  ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium border-l-[3px] border-primary-600"
                                  : "text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-800 border-l-[3px] border-transparent"
                              )}
                            >
                              <span className={isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}>
                                {item.icon}
                              </span>
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </nav>

                {/* Drawer footer */}
                <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-4 safe-area-bottom space-y-1">
                  <div className="flex items-center justify-between px-1 mb-2">
                    <NotificationBell />
                    <ThemeToggle />
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-[15px] text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-800 min-h-[52px]"
                  >
                    <Settings size={18} className="text-gray-400" />
                    Nastavení
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); logout(); }}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-[15px] text-red-500 w-full min-h-[52px] active:bg-red-50 dark:active:bg-red-950/20"
                  >
                    <LogOut size={18} />
                    Odhlásit se
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      {/* ═══ CLIENT Mobile Bottom Tab Bar ═══ */}
      {isClient && (
        <>
          <nav
            aria-label="Mobilní navigace"
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-[55]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-stretch" style={{ height: `${TAB_H}px` }}>
              {CLIENT_TABS.map((tab) => {
                if (tab.href === "#more") {
                  const active = moreOpen || isMoreRouteActive;
                  return (
                    <button
                      key="more"
                      onClick={() => { haptics.light(); setMoreOpen(!moreOpen); }}
                      className="flex-1 flex flex-col items-center justify-center gap-1"
                    >
                      <motion.div
                        className={cn(
                          "rounded-2xl px-3 py-1.5 flex items-center justify-center transition-colors",
                          active ? "bg-primary-100 dark:bg-primary-900/40" : ""
                        )}
                        whileTap={{ scale: 0.82 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        <span className={active ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}>
                          {tab.icon}
                        </span>
                      </motion.div>
                      <span className={cn(
                        "text-[11px] leading-none",
                        active ? "text-primary-600 dark:text-primary-400 font-medium" : "text-gray-500 dark:text-gray-400"
                      )}>
                        {tab.label}
                      </span>
                    </button>
                  );
                }
                const active = isTabActive(tab);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => { if (!active) haptics.light(); setMoreOpen(false); }}
                    className="flex-1 flex flex-col items-center justify-center gap-1"
                  >
                    <motion.div
                      className={cn(
                        "rounded-2xl px-3 py-1.5 flex items-center justify-center transition-colors",
                        active ? "bg-primary-100 dark:bg-primary-900/40" : ""
                      )}
                      whileTap={{ scale: 0.82 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      <span className={active ? "text-primary-600 dark:text-primary-400" : "text-gray-400 dark:text-gray-500"}>
                        {tab.icon}
                      </span>
                    </motion.div>
                    <span className={cn(
                      "text-[11px] leading-none",
                      active ? "text-primary-600 dark:text-primary-400 font-medium" : "text-gray-500 dark:text-gray-400"
                    )}>
                      {tab.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* "Více" bottom sheet */}
          <AnimatePresence>
            {moreOpen && (
              <>
                <motion.div
                  className="md:hidden fixed inset-0 bg-black/30 z-[45]"
                  style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setMoreOpen(false)}
                />
                <motion.div
                  data-testid="more-sheet"
                  className="md:hidden fixed left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl border-t border-gray-200 dark:border-gray-800 max-h-[60vh] overflow-y-auto"
                  style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` }}
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.85 }}
                  drag="y"
                  dragConstraints={{ top: 0 }}
                  dragElastic={{ top: 0, bottom: 0.3 }}
                  onDragEnd={(_, info) => { if (info.offset.y > 80) { haptics.light(); setMoreOpen(false); } }}
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
                            "flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] min-h-[52px]",
                            pathname === item.href || pathname.startsWith(item.href + "/")
                              ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium"
                              : "text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-800"
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
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] text-gray-700 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-800 min-h-[52px]"
                      >
                        <Settings size={18} />
                        Nastavení účtu
                      </Link>
                      <button
                        onClick={() => { setMoreOpen(false); logout(); }}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] text-red-500 w-full min-h-[52px] active:bg-red-50 dark:active:bg-red-950/20"
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

      <SOSButton aboveTabBar={isClient} />
      <PWAInstallBanner />
      <PushNotificationPrompt />
    </div>
  );
}
