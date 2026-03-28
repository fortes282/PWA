import {
  Home,
  Calendar,
  Users,
  Settings,
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
  ClipboardList,
  Inbox,
  Wallet,
  Trophy,
  Gift,
  BarChart3,
  Building2,
  BookOpen,
  Dumbbell,
} from "lucide-react";
import type { NavItem, TabItem } from "./types";

// Tab bar height (px) — keep in sync with SOSButton and globals.css
export const TAB_H = 64;

export const CLIENT_TABS: TabItem[] = [
  { label: "Přehled",   href: "/client",               icon: <Home     size={24} strokeWidth={1.75} /> },
  { label: "Rezervovat",href: "/client/booking",       icon: <Calendar size={24} strokeWidth={1.75} />, matchPrefix: "/client/booking" },
  { label: "Termíny",   href: "/client/appointments",  icon: <Clock    size={24} strokeWidth={1.75} />, matchPrefix: "/client/appointments" },
  { label: "Zprávy",    href: "/messages",             icon: <Mail     size={24} strokeWidth={1.75} />, matchPrefix: "/messages" },
  { label: "Více",      href: "#more",                 icon: <MoreHorizontal size={24} strokeWidth={1.75} /> },
];

export const CLIENT_MORE_ITEM_HREFS = [
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

export const NAV_ITEMS: NavItem[] = [
  // CLIENT — simplified: Finance = credits+packages+invoices, Můj progres = reports+progress+questionnaires
  { label: "Dashboard",              href: "/client",                    icon: <Home         size={18} />, roles: ["CLIENT"] },
  { label: "Booking",                href: "/client/booking",            icon: <Calendar     size={18} />, roles: ["CLIENT"] },
  { label: "Moje termíny",           href: "/client/appointments",       icon: <Clock        size={18} />, roles: ["CLIENT"] },
  { label: "Finance",                href: "/client/credits",            icon: <Wallet       size={18} />, roles: ["CLIENT"], matchPrefix: "/client/credits" },
  { label: "Můj progres",            href: "/client/progress",           icon: <Trophy       size={18} />, roles: ["CLIENT"], matchPrefix: "/client/progress" },
  { label: "Úspěchy",                href: "/client/achievements",       icon: <Trophy       size={18} />, roles: ["CLIENT"] },
  { label: "Domácí cvičení",         href: "/client/homework",           icon: <Activity     size={18} />, roles: ["CLIENT"] },
  { label: "Zdravotní karta",        href: "/client/health-record",      icon: <Heart        size={18} />, roles: ["CLIENT"] },
  { label: "Waitlist",               href: "/client/waitlist",           icon: <Clock        size={18} />, roles: ["CLIENT"] },
  { label: "Intenzivní pobyty",      href: "/client/intensive-blocks",   icon: <Calendar     size={18} />, roles: ["CLIENT"] },
  { label: "Výmaz dat (GDPR)",       href: "/client/erasure-request",    icon: <ShieldAlert  size={18} />, roles: ["CLIENT"] },

  // RECEPTION — grouped
  { label: "Přehled",          href: "/reception",                  icon: <Home       size={18} />, roles: ["RECEPTION"], group: "Přehled" },
  { label: "Kalendář",         href: "/reception/calendar",         icon: <Calendar   size={18} />, roles: ["RECEPTION"], group: "Rezervace" },
  { label: "Rezervace",        href: "/reception/appointments",     icon: <Clock      size={18} />, roles: ["RECEPTION"], group: "Rezervace" },
  { label: "Harmonogram",      href: "/reception/schedule",         icon: <Calendar   size={18} />, roles: ["RECEPTION"], group: "Rezervace" },
  { label: "Pracovní hodiny",  href: "/reception/working-hours",    icon: <Calendar   size={18} />, roles: ["RECEPTION"], group: "Rezervace" },
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
  { label: "Šablony poznámek",  href: "/employee/session-templates", icon: <BookOpen  size={18} />, roles: ["EMPLOYEE"] },
  { label: "Knihovna cvičení",   href: "/employee/exercise-library",  icon: <Dumbbell  size={18} />, roles: ["EMPLOYEE"] },
  { label: "Můj wellbeing",      href: "/employee/wellbeing",         icon: <Heart     size={18} />, roles: ["EMPLOYEE"] },

  // ADMIN — grouped
  { label: "Dashboard",          href: "/admin",                      icon: <Home       size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "BI Dashboard",       href: "/admin/bi",                   icon: <TrendingUp size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Statistiky",         href: "/admin/stats",                icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Rezervace",          href: "/reception/appointments",     icon: <Calendar   size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Uživatelé",          href: "/admin/users",                icon: <Users      size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Služby",             href: "/admin/services",             icon: <Activity   size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Místnosti",          href: "/admin/rooms",                icon: <Home       size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Balíčky",            href: "/admin/packages",             icon: <CreditCard size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Dotazníky",          href: "/admin/questionnaires",       icon: <ClipboardList size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Skupiny podpory",    href: "/admin/groups",               icon: <Users      size={18} />, roles: ["ADMIN"], group: "Správa", matchPrefix: "/admin/groups" },
  { label: "Dárkové vouchery",   href: "/admin/vouchers",             icon: <Gift       size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Firemní wellness",   href: "/admin/corporate",            icon: <Building2  size={18} />, roles: ["ADMIN"], group: "Správa" },
  { label: "Vytíženost místností",href: "/admin/heatmap",             icon: <BarChart3  size={18} />, roles: ["ADMIN"], group: "Přehled" },
  { label: "Slevy mimo špičku",  href: "/admin/off-peak",             icon: <TrendingUp size={18} />, roles: ["ADMIN"], group: "Správa" },
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

  // Shared — merged Messages+Notifications → Schránka
  { label: "Schránka",  href: "/notifications", icon: <Inbox size={18} />, roles: ["CLIENT","RECEPTION","EMPLOYEE","ADMIN"] },
  { label: "Zprávy",    href: "/messages",      icon: <Mail  size={18} />, roles: ["CLIENT","RECEPTION","EMPLOYEE","ADMIN"] },
];

export function groupItems(items: NavItem[]): { group: string | null; items: NavItem[] }[] {
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
