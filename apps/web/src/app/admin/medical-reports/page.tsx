"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { FileText, Search, Download } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const fetcher = (url: string) => api.get<any[]>(url);
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export default function AdminMedicalReports() {
  const shouldReduce = useReducedMotion();
  const { data: reports } = useSWR("/medical-reports", fetcher);
  const { data: users } = useSWR("/users", fetcher);

  const [search, setSearch] = useState("");

  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.name]));

  const filtered = (reports ?? []).filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.diagnosis?.toLowerCase().includes(q) ||
      userMap[r.clientId]?.toLowerCase().includes(q) ||
      userMap[r.employeeId]?.toLowerCase().includes(q)
    );
  });

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FileText size={24} className="text-blue-600" /> Lékařské zprávy
            </h1>
            <motion.span
              initial={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
              className="text-sm text-gray-500"
            >
              {sorted.length} zpráv
            </motion.span>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
            className="card mb-4"
          >
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Hledat dle nadpisu, diagnózy, klienta nebo terapeuta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
          </motion.div>

          {/* Reports list */}
          <AnimatePresence mode="wait">
            {sorted.length === 0 ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <EmptyState
                  icon={<FileText size={32} className="text-gray-300" />}
                  title="Žádné lékařské zprávy"
                  description={search ? "Žádné zprávy neodpovídají hledání." : "Zatím nebyly vytvořeny žádné lékařské zprávy."}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {sorted.map((r: any, i: number) => (
                  <motion.div
                    key={r.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.04 }}
                    className="card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <motion.div
                          initial={shouldReduce ? {} : { scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 + 0.05 }}
                          className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        >
                          <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{r.title}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                            <span>
                              <span className="font-medium text-gray-600 dark:text-gray-400">Klient:</span>{" "}
                              {userMap[r.clientId] ?? `#${r.clientId}`}
                            </span>
                            <span>
                              <span className="font-medium text-gray-600 dark:text-gray-400">Terapeut:</span>{" "}
                              {userMap[r.employeeId] ?? `#${r.employeeId}`}
                            </span>
                            <span>{formatDateTime(r.createdAt)}</span>
                          </div>
                          {r.diagnosis && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              <span className="font-medium">Diagnóza:</span> {r.diagnosis}
                            </p>
                          )}
                          {r.content && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.content}</p>
                          )}
                        </div>
                      </div>

                      {/* Download buttons */}
                      <div className="flex gap-2 flex-shrink-0">
                        {r.pdfPath && (
                          <motion.a
                            href={`${API_BASE}/pdf/medical/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 px-2 py-1.5 rounded-lg transition-colors"
                            title="Stáhnout PDF"
                          >
                            <Download size={12} /> PDF
                          </motion.a>
                        )}
                        {r.docxPath && (
                          <motion.a
                            href={`${API_BASE}/pdf/docx/${r.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-2 py-1.5 rounded-lg transition-colors"
                            title="Stáhnout DOCX"
                          >
                            <Download size={12} /> DOCX
                          </motion.a>
                        )}
                        {!r.pdfPath && !r.docxPath && (
                          <span className="text-xs text-gray-500 py-1">Bez souboru</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
