"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
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
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import NotificationBell from "@/components/NotificationBell";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: ("CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN")[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/client", icon: <Home size={18} />, roles: ["CLIENT"] },
  { label: "Booking", href: "/client/booking", icon: <Calendar size={18} />, roles: ["CLIENT"] },
  { label: "Moje termíny", href: "/client/appointments", icon: <Clock size={18} />, roles: ["CLIENT"] },
  { label: "Kredity", href: "/client/credits", icon: <CreditCard size={18} />, roles: ["CLIENT"] },
  { label: "Zprávy", href: "/client/reports", icon: <FileText size={18} />, roles: ["CLIENT"] },
  { label: "Pokrok", href: "/client/progress", icon: <Activity size={18} />, roles: ["CLIENT"] },
  { label: "Waitlist", href: "/client/waitlist", icon: <Clock size={18} />, roles: ["CLIENT"] },

  { label: "Přehled", href: "/reception", icon: <Home size={18} />, roles: ["RECEPTION"] },
  { label: "Termíny", href: "/reception/appointments", icon: <Clock size={18} />, roles: ["RECEPTION"] },
  { label: "Klienti", href: "/reception/clients", icon: <Users size={18} />, roles: ["RECEPTION"] },
  { label: "Waitlist", href: "/reception/waitlist", icon: <Clock size={18} />, roles: ["RECEPTION"] },
  { label: "Billing", href: "/reception/billing", icon: <CreditCard size={18} />, roles: ["RECEPTION"] },
  { label: "Pracovní hodiny", href: "/reception/working-hours", icon: <Calendar size={18} />, roles: ["RECEPTION"] },

  { label: "Kalendář", href: "/employee", icon: <Calendar size={18} />, roles: ["EMPLOYEE"] },
  { label: "Zprávy", href: "/employee/reports", icon: <FileText size={18} />, roles: ["EMPLOYEE"] },
  { label: "Kolegové", href: "/employee/colleagues", icon: <Users size={18} />, roles: ["EMPLOYEE"] },

  { label: "Dashboard", href: "/admin", icon: <Home size={18} />, roles: ["ADMIN"] },
  { label: "Uživatelé", href: "/admin/users", icon: <Users size={18} />, roles: ["ADMIN"] },
  { label: "Služby", href: "/admin/services", icon: <Activity size={18} />, roles: ["ADMIN"] },
  { label: "Místnosti", href: "/admin/rooms", icon: <Home size={18} />, roles: ["ADMIN"] },
  { label: "Statistiky", href: "/admin/stats", icon: <Activity size={18} />, roles: ["ADMIN"] },
  { label: "Background", href: "/admin/background", icon: <Activity size={18} />, roles: ["ADMIN"] },
  { label: "FIO Matching", href: "/admin/fio", icon: <CreditCard size={18} />, roles: ["ADMIN"] },
  { label: "Nastavení", href: "/admin/settings", icon: <Settings size={18} />, roles: ["ADMIN"] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const myNavItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full">
        {/* Brand */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Přístav Radosti</p>
              <p className="text-xs text-gray-400">Neurorehabilitace</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {myNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-700 text-xs font-bold">{getInitials(user.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <div className="mb-2">
            <NotificationBell />
          </div>
          <Link href="/settings" className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 mb-2">
            <Settings size={14} />
            Nastavení
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 w-full"
          >
            <LogOut size={14} />
            Odhlásit se
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="font-semibold text-gray-900">Přístav Radosti</span>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-gray-500"
          >
            <ChevronDown size={20} className={cn("transition-transform", mobileOpen && "rotate-180")} />
          </button>
        </header>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-gray-200 p-4 space-y-1">
            {myNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                  pathname === item.href ? "bg-primary-50 text-primary-700" : "text-gray-600"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-red-500 text-sm w-full">
              <LogOut size={18} />
              Odhlásit se
            </button>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
