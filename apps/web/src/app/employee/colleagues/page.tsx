"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Calendar } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any[]>(url);

const DAY_NAMES: Record<number, string> = {
  0: "Ne",
  1: "Po",
  2: "Út",
  3: "St",
  4: "Čt",
  5: "Pá",
  6: "So",
};

export default function EmployeeColleagues() {
  const shouldReduce = useReducedMotion();
  const { user } = useAuth();
  const { data: colleagues } = useSWR<any[]>("/working-hours/employees", fetcher as any);

  // Filter out self from colleagues
  const others = (colleagues ?? []).filter((c: any) => c.id !== user?.id);

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <Users size={24} className="text-primary-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Kolegové</h1>
          </div>

          <AnimatePresence>
            {others.length === 0 && (
              <motion.div
                key="empty"
                initial={shouldReduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="card text-center text-gray-500 dark:text-gray-400 py-12"
              >
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p>Žádní kolegové v systému</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="space-y-4"
          >
            {others.map((c: any, i: number) => {
              const activeDays = (c.workingHours ?? []).filter((wh: any) => wh.isActive);
              return (
                <motion.div
                  key={c.id}
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                  className="card"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <motion.div
                        initial={shouldReduce ? false : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.05 }}
                        className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center"
                      >
                        <span className="text-primary-600 font-bold text-sm">
                          {c.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </span>
                      </motion.div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.email}</p>
                      </div>
                    </div>
                    <span className={`badge ${activeDays.length > 0 ? "badge-green" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}`}>
                      {activeDays.length > 0 ? `${activeDays.length} dní/týden` : "Žádné hodiny"}
                    </span>
                  </div>

                  {activeDays.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 flex items-center gap-1">
                        <Calendar size={12} /> Pracovní hodiny
                      </p>
                      <div
                        className="flex flex-wrap gap-2"
                      >
                        {activeDays
                          .sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek)
                          .map((wh: any, j: number) => (
                            <motion.div
                              key={wh.id}
                              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + j * 0.04 }}
                              className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5 text-xs"
                            >
                              <span className="font-semibold text-gray-700 dark:text-gray-300">{DAY_NAMES[wh.dayOfWeek] ?? wh.dayOfWeek}</span>
                              <span className="text-gray-500 dark:text-gray-400 ml-1">{wh.startTime}–{wh.endTime}</span>
                            </motion.div>
                          ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
