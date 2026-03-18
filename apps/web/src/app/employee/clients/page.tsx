"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Users, Search, Star, TrendingUp, Calendar } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

function StatCard({ icon, label, value, color = "text-gray-900" }: any) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

export default function EmployeeClients() {
  const [search, setSearch] = useState("");

  const { data: clients, isLoading } = useSWR<any[]>("/employees/me/clients", fetcher as any);
  const { data: stats } = useSWR<any>("/employees/me/stats", fetcher as any);

  const filtered = (clients ?? []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Users className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900">Moji klienti</h1>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard
                icon={<Calendar size={18} className="text-blue-500" />}
                label="celkem termínů"
                value={stats.totalAppointments}
              />
              <StatCard
                icon={<Users size={18} className="text-green-500" />}
                label="unikátní klienti"
                value={stats.uniqueClients}
              />
              <StatCard
                icon={<TrendingUp size={18} className="text-purple-500" />}
                label="dokončeno %"
                value={`${stats.completionRate}%`}
                color={stats.completionRate >= 80 ? "text-green-600" : "text-yellow-600"}
              />
              <StatCard
                icon={<Star size={18} className="text-yellow-500" />}
                label="průměrné hodnocení"
                value={stats.avgRating ? `${stats.avgRating} ★` : "—"}
                color="text-yellow-600"
              />
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Hledat klienta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Client list */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <Users size={40} />
              <p className="text-sm">
                {search ? "Žádní klienti neodpovídají hledání" : "Zatím žádní klienti"}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((c: any) => (
              <div key={c.id} className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-semibold text-sm">
                    {(c.name ?? "?")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-800">{c.session_count}× sezení</p>
                  {c.daysSinceLastSession != null && (
                    <p className="text-xs text-gray-400">
                      poslední: {c.daysSinceLastSession === 0 ? "dnes" : `${c.daysSinceLastSession} dní`}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    (c.behavior_score ?? 100) >= 80 ? "bg-green-100 text-green-700" :
                    (c.behavior_score ?? 100) >= 50 ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {Math.round(c.behavior_score ?? 100)}/100
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
