"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { SkeletonLine } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { ShieldAlert } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

const ACTION_OPTIONS = [
  "USER_LOGIN",
  "USER_LOGOUT",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_DELETED",
  "USER_REACTIVATED",
  "APPOINTMENT_CONFIRMED",
  "APPOINTMENT_CANCELLED",
  "APPOINTMENT_STATUS_CHANGED",
  "INVOICE_CREATED",
  "INVOICE_UPDATED",
  "SERVICE_CREATED",
  "SERVICE_UPDATED",
  "SERVICE_DELETED",
  "ROOM_CREATED",
  "ROOM_UPDATED",
  "ROOM_DELETED",
];

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "Přihlášení uživatele",
  USER_LOGOUT: "Odhlášení uživatele",
  USER_CREATED: "Vytvoření uživatele",
  USER_UPDATED: "Úprava uživatele",
  USER_DELETED: "Smazání uživatele",
  USER_REACTIVATED: "Reaktivace uživatele",
  APPOINTMENT_CONFIRMED: "Rezervace potvrzena",
  APPOINTMENT_CANCELLED: "Rezervace zrušena",
  APPOINTMENT_STATUS_CHANGED: "Změna stavu rezervace",
  INVOICE_CREATED: "Faktura vytvořena",
  INVOICE_UPDATED: "Faktura upravena",
  SERVICE_CREATED: "Služba přidána",
  SERVICE_UPDATED: "Služba upravena",
  SERVICE_DELETED: "Služba smazána",
  ROOM_CREATED: "Místnost přidána",
  ROOM_UPDATED: "Místnost upravena",
  ROOM_DELETED: "Místnost smazána",
};

export default function AdminAuditPage() {
  const shouldReduce = useReducedMotion();
  const [userId, setUserId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", "20");
  if (userId) params.set("userId", userId);
  if (action) params.set("action", action);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, isLoading } = useSWR(`/audit?${params.toString()}`, fetcher);

  const items: any[] = data?.items ?? [];
  const pagination = data?.pagination;

  function resetFilters() {
    setUserId("");
    setAction("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.h1
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"
          >
            <ShieldAlert size={24} className="text-indigo-600" />
            Audit log
          </motion.h1>

          {/* Filters */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  ID uživatele
                </label>
                <input
                  type="number"
                  placeholder="Všichni"
                  value={userId}
                  onChange={(e) => { setUserId(e.target.value); setPage(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Akce
                </label>
                <select
                  value={action}
                  onChange={(e) => { setAction(e.target.value); setPage(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Všechny akce</option>
                  {ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Od
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); setPage(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Do
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); setPage(1); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <AnimatePresence>
              {(userId || action || from || to) && (
                <motion.button
                  initial={shouldReduce ? {} : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={shouldReduce ? {} : { opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  onClick={resetFilters}
                  className="mt-3 text-sm text-indigo-600 hover:underline"
                >
                  Zrušit filtry
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Table */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Čas</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akce</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uživatel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cíl</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <SkeletonLine height="h-4" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          icon="🔍"
                          title="Žádné záznamy"
                          description="Pro zadané filtry nebyly nalezeny žádné audit záznamy."
                        />
                      </td>
                    </tr>
                  ) : (
                    items.map((row: any, i: number) => (
                      <motion.tr
                        key={row.id}
                        initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.02 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleString("cs-CZ")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800" title={row.action}>
                            {ACTION_LABELS[row.action] ?? row.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.userId ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.targetType && row.targetId
                            ? `${row.targetType} #${row.targetId}`
                            : row.targetId
                            ? `#${row.targetId}`
                            : row.details ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                          {row.ip ?? "—"}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Stránka {pagination.page} z {pagination.pages} ({pagination.total} záznamů)
                </p>
                <div className="flex gap-2">
                  <motion.button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    ← Předchozí
                  </motion.button>
                  <motion.button
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
                    whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Další →
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
