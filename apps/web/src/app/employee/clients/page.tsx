"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Users, Search, Star, TrendingUp, Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

function StatCard({ icon, label, value, color = "text-gray-900" }: any) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

export default function EmployeeClients() {
  const shouldReduce = useReducedMotion();
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moji klienti</h1>
          </div>

          {/* Stats */}
          <AnimatePresence>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 }}
                >
                  <StatCard icon={<Calendar size={18} className="text-blue-500" />} label="celkem termínů" value={stats.totalAppointments} />
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.08 }}
                >
                  <StatCard icon={<Users size={18} className="text-green-500" />} label="unikátní klienti" value={stats.uniqueClients} />
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 }}
                >
                  <StatCard icon={<TrendingUp size={18} className="text-purple-500" />} label="dokončeno %" value={`${stats.completionRate}%`} color={stats.completionRate >= 80 ? "text-green-600" : "text-yellow-600"} />
                </motion.div>
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.16 }}
                >
                  <StatCard icon={<Star size={18} className="text-yellow-500" />} label="průměrné hodnocení" value={stats.avgRating ? `${stats.avgRating} ★` : "—"} color="text-yellow-600" />
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Hledat klienta…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
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

          <AnimatePresence>
            {!isLoading && filtered.length === 0 && (
              <motion.div
                key="empty"
                initial={shouldReduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3"
              >
                <Users size={40} />
                <p className="text-sm">
                  {search ? "Žádní klienti neodpovídají hledání" : "Zatím žádní klienti"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-3">
            {filtered.map((c: any, i) => (
              <motion.div
                key={c.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.06 + i * 0.04 }}
                whileTap={shouldReduce ? undefined : { scale: 0.985 }}
              >
                <Link href={`/employee/clients/${c.id}`} className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
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
                      <p className="text-xs text-gray-500">
                        poslední: {c.daysSinceLastSession === 0 ? "dnes" : `${c.daysSinceLastSession} dní`}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      (c.behavior_score ?? 100) >= 80 ? "bg-green-100 text-green-700" :
                      (c.behavior_score ?? 100) >= 50 ? "bg-yellow-100 text-yellow-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {Math.round(c.behavior_score ?? 100)}/100
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
