"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Users, Calendar, TrendingUp, Activity, AlertTriangle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminDashboard() {
  const { data: stats } = useSWR("/stats", fetcher);
  const { data: users } = useSWR("/users", fetcher);
  const { data: health } = useSWR("/health/detailed", fetcher, { refreshInterval: 60_000 });
  const { data: pending } = useSWR("/dashboard/admin/pending", fetcher, { refreshInterval: 60_000 });

  const employeeCount = users?.filter((u: any) => u.role === "EMPLOYEE").length ?? 0;

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            {health && (
              <span className={`badge ${health.status === "ok" ? "badge-green" : "badge-red"}`}>
                {health.status === "ok" ? "Systém OK" : "Chyba DB"}
              </span>
            )}
            {health && (
              <span className="text-xs text-gray-400">
                Uptime: {Math.floor(health.uptime / 3600)}h
              </span>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Celkem termínů", value: stats?.totalAppts ?? "—", icon: <Calendar size={18} />, color: "blue" },
              { label: "Klientů", value: stats?.totalClients ?? "—", icon: <Users size={18} />, color: "green" },
              { label: "Výnosy", value: stats?.revenue ? formatCurrency(stats.revenue) : "—", icon: <TrendingUp size={18} />, color: "purple" },
              { label: "Zaměstnanců", value: employeeCount, icon: <Activity size={18} />, color: "orange" },
            ].map((s) => (
              <div key={s.label} className="card">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <span className="text-primary-500">{s.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="card text-center">
                <p className="text-2xl font-bold text-green-600">{stats.confirmedAppts}</p>
                <p className="text-xs text-gray-500 mt-1">Potvrzeno</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-red-500">{stats.cancelledAppts}</p>
                <p className="text-xs text-gray-500 mt-1">Zrušeno</p>
              </div>
              <div className="card text-center">
                <p className="text-2xl font-bold text-gray-400">{stats.noShowAppts}</p>
                <p className="text-xs text-gray-500 mt-1">No-show</p>
              </div>
            </div>
          )}

          {/* Pending items widget */}
          {pending && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-500" />
                <h2 className="font-semibold text-gray-800">Akce vyžadující pozornost</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Link href="/admin/users" className="card hover:shadow-md transition-shadow border-l-4 border-yellow-400">
                  <p className="text-2xl font-bold text-yellow-600">{pending.pendingActivations}</p>
                  <p className="text-xs text-gray-500 mt-1">termínů čeká na aktivaci</p>
                </Link>
                <Link href="/reception/billing" className="card hover:shadow-md transition-shadow border-l-4 border-red-400">
                  <p className="text-2xl font-bold text-red-600">{pending.overdueInvoices}</p>
                  <p className="text-xs text-gray-500 mt-1">faktur po splatnosti</p>
                </Link>
                <Link href="/admin/users" className="card hover:shadow-md transition-shadow border-l-4 border-blue-400">
                  <p className="text-2xl font-bold text-blue-600">{pending.waitlistCount}</p>
                  <p className="text-xs text-gray-500 mt-1">klientů na waitlistu</p>
                </Link>
                <Link href="/admin/background" className="card hover:shadow-md transition-shadow border-l-4 border-orange-400">
                  <p className="text-2xl font-bold text-orange-600">{pending.lowBehaviorClients}</p>
                  <p className="text-xs text-gray-500 mt-1">klientů s nízkým skóre</p>
                </Link>
              </div>
            </div>
          )}

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
            ].map((item) => (
              <Link key={item.href} href={item.href} className="card hover:shadow-md transition-shadow text-center py-4">
                <p className="font-medium text-gray-700">{item.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
