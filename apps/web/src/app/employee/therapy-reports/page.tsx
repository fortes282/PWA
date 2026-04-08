"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Plus, FileText, Download, Edit2, CheckCircle, Clock } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const categoryLabel: Record<string, string> = {
  intake: "Vstupní vyšetření",
  progress: "Průběžná zpráva",
  final: "Závěrečná zpráva",
  cognitive: "Kognitivní hodnocení",
};

const categoryColor: Record<string, string> = {
  intake: "bg-blue-100 text-blue-700",
  progress: "bg-green-100 text-green-700",
  final: "bg-purple-100 text-purple-700",
  cognitive: "bg-orange-100 text-orange-700",
};

export default function TherapyReportsPage() {
  const shouldReduce = useReducedMotion();
  const router = useRouter();
  const { data: reports, isLoading } = useSWR("/reports/therapy", fetcher);

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Terapeutické zprávy</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Strukturované zprávy ze šablon s PDF exportem</p>
            </div>
            <motion.button
              whileTap={shouldReduce ? undefined : { scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              onClick={() => { haptics.light(); router.push("/employee/therapy-reports/new"); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Nová zpráva
            </motion.button>
          </div>

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
            </div>
          )}

          <AnimatePresence>
            {!isLoading && (!reports || reports.length === 0) && (
              <motion.div
                key="empty"
                initial={shouldReduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="card text-center py-16 text-gray-500"
              >
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Žádné zprávy zatím</p>
                <p className="text-sm mt-1">Klikněte na &bdquo;Nová zpráva&ldquo; pro vytvoření strukturované terapeutické zprávy.</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div
            className="space-y-3"
          >
            {reports?.map((r: any, i: number) => (
              <motion.div
                key={r.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                whileTap={shouldReduce ? undefined : { scale: 0.988 }}
                className="card hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {r.client?.name ?? `Klient #${r.clientId}`}
                          </span>
                          <span className="text-gray-300 dark:text-gray-400">·</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.createdAt)}</span>
                          {r.template && (
                            <>
                              <span className="text-gray-300 dark:text-gray-400">·</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor[r.template.category] ?? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"}`}>
                                {categoryLabel[r.template.category] ?? r.template.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.status === "FINAL" ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle size={12} /> Finální
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                            <Clock size={12} /> Koncept
                          </span>
                        )}
                        <motion.button
                          whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          onClick={() => { haptics.light(); router.push(`/employee/therapy-reports/${r.id}`); }}
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                        >
                          <Edit2 size={11} /> Upravit
                        </motion.button>
                        <motion.button
                          whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          onClick={() => { haptics.light(); router.push(`/employee/therapy-reports/${r.id}?export=pdf`); }}
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                        >
                          <Download size={11} /> PDF
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
