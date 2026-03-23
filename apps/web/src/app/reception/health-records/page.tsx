"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState } from "react";
import { Heart, Search, ChevronRight, AlertCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function HealthRecordsList() {
  const shouldReduce = useReducedMotion();
  const { data: records } = useSWR("/health-records", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);
  const [search, setSearch] = useState("");

  const clientsWithRecord = new Set((records ?? []).map((r: any) => r.clientId));
  const clientsWithoutRecord = (clients ?? []).filter(
    (c: any) => !clientsWithRecord.has(c.id)
  );

  const filteredRecords = (records ?? []).filter((r: any) => {
    const q = search.toLowerCase();
    return (
      (r.clientName ?? "").toLowerCase().includes(q) ||
      (r.clientEmail ?? "").toLowerCase().includes(q) ||
      (r.primaryDiagnosis ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN", "EMPLOYEE"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Heart size={20} className="text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Zdravotní záznamy</h1>
          </motion.div>

          {/* Search */}
          <motion.div
            className="relative mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
          >
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Hledat klienta nebo diagnózu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </motion.div>

          {/* Clients without records */}
          <AnimatePresence>
            {clientsWithoutRecord.length > 0 && !search && (
              <motion.div
                key="no-record-warning"
                initial={shouldReduce ? false : { opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border-orange-200 bg-orange-50"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle size={16} className="text-orange-500" />
                  <h2 className="font-semibold text-orange-800">
                    Klienti bez záznamu ({clientsWithoutRecord.length})
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {clientsWithoutRecord.map((c: any, i: number) => (
                    <motion.a
                      key={c.id}
                      href={`/reception/health-records/${c.id}`}
                      initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22, delay: i * 0.03 }}
                      whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                      onClick={() => haptics.light()}
                      className="text-xs px-2 py-1 bg-white rounded border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      {c.name}
                    </motion.a>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Records list */}
          <div className="space-y-3">
            <AnimatePresence>
              {filteredRecords.length === 0 && (
                <motion.div
                  key="empty"
                  initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="card text-center text-gray-500 dark:text-gray-400 py-12"
                >
                  {search ? "Žádný záznam neodpovídá hledání." : "Zatím nejsou žádné zdravotní záznamy."}
                </motion.div>
              )}
            </AnimatePresence>

            {filteredRecords.map((r: any, i: number) => (
              <motion.a
                key={r.id}
                href={`/reception/health-records/${r.clientId}`}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                layout
                whileHover={shouldReduce ? undefined : { y: -1 }}
                whileTap={shouldReduce ? undefined : { scale: 0.99 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                onClick={() => haptics.light()}
                className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <motion.div
                  className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"
                  whileHover={shouldReduce ? undefined : { scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  <Heart size={18} className="text-red-500" />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{r.clientName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{r.clientEmail}</p>
                  {r.primaryDiagnosis && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      <span className="font-medium">Diagnóza:</span> {r.primaryDiagnosis}
                    </p>
                  )}
                  {r.allergies && (
                    <p className="text-xs text-red-600 mt-0.5">
                      <span className="font-medium">Alergie:</span> {r.allergies}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Aktualizováno {formatDate(r.updatedAt)}
                  </p>
                  <motion.div
                    className="ml-auto mt-1 w-fit"
                    animate={{ x: 0 }}
                    whileHover={shouldReduce ? undefined : { x: 3 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <ChevronRight size={16} className="text-gray-500 dark:text-gray-400" />
                  </motion.div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
