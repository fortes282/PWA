"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 - 20:00

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    from: monday.toISOString().split("T")[0],
    to: sunday.toISOString().split("T")[0],
  };
}

function getCellColor(count: number): string {
  if (count === 0) return "bg-gray-50 dark:bg-gray-800/30";
  if (count <= 2) return "bg-green-200 dark:bg-green-900/40";
  if (count <= 4) return "bg-green-400 dark:bg-green-700/60";
  return "bg-green-600 dark:bg-green-500/80";
}

function getCellTextColor(count: number): string {
  if (count === 0) return "text-gray-400 dark:text-gray-600";
  if (count <= 2) return "text-green-800 dark:text-green-200";
  if (count <= 4) return "text-white dark:text-green-100";
  return "text-white dark:text-white";
}

export default function AdminHeatmap() {
  const shouldReduce = useReducedMotion();
  const defaultRange = useMemo(() => getWeekRange(), []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  const { data } = useSWR<{ rooms: any[]; grid: Record<string, Record<string, number>> }>(
    `/heatmap/rooms?from=${from}&to=${to}`,
    fetcher
  );

  const rooms = data?.rooms ?? [];
  const grid = data?.grid ?? {};

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3"
          >
            <BarChart3 size={24} className="text-primary" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vytíženost místností</h1>
          </motion.div>

          {/* Date range selector */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="card"
          >
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Od:</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Do:</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent min-h-[44px] text-sm"
                />
              </div>
            </div>
          </motion.div>

          {/* Heatmap grid */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="card overflow-x-auto"
          >
            {rooms.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Žádná data pro vybrané období</p>
              </div>
            ) : (
              <>
                <div
                  className="grid gap-px min-w-[700px]"
                  style={{
                    gridTemplateColumns: `140px repeat(${HOURS.length}, 1fr)`,
                  }}
                >
                  {/* Header row */}
                  <div className="p-2" />
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400"
                    >
                      {h}:00
                    </div>
                  ))}

                  {/* Data rows */}
                  {rooms.map((room: any, rowIdx: number) => (
                    <>
                      <motion.div
                        key={`label-${room.id}`}
                        initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 + rowIdx * 0.04 }}
                        className="p-2 flex items-center text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
                      >
                        {room.name}
                      </motion.div>
                      {HOURS.map((h, colIdx) => {
                        const count = grid?.[room.id]?.[String(h)] ?? 0;
                        return (
                          <motion.div
                            key={`${room.id}-${h}`}
                            initial={shouldReduce ? {} : { opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              type: "spring",
                              stiffness: 400,
                              damping: 28,
                              delay: 0.12 + rowIdx * 0.03 + colIdx * 0.01,
                            }}
                            className={`p-1 text-center text-xs font-medium rounded-sm ${getCellColor(count)} ${getCellTextColor(count)} transition-colors`}
                            title={`${room.name} ${h}:00 - ${count} rezervací`}
                          >
                            {count > 0 ? count : ""}
                          </motion.div>
                        );
                      })}
                    </>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Legenda:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-sm bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">0</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-sm bg-green-200 dark:bg-green-900/40" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">1-2</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-sm bg-green-400 dark:bg-green-700/60" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">3-4</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-sm bg-green-600 dark:bg-green-500/80" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">5+</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
