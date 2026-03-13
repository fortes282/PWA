"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Users, Calendar, TrendingUp, Activity } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminDashboard() {
  const { data: stats } = useSWR("/stats", fetcher);
  const { data: users } = useSWR("/users", fetcher);

  const employeeCount = users?.filter((u: any) => u.role === "EMPLOYEE").length ?? 0;

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

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
