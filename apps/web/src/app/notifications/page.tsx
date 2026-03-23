"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any>(url);

const TYPE_LABELS: Record<string, string> = {
  APPOINTMENT_CONFIRMED: "Termín potvrzen",
  APPOINTMENT_REMINDER: "Připomínka termínu",
  APPOINTMENT_CANCELLED: "Termín zrušen",
  WAITLIST_AVAILABLE: "Volný termín",
  INVOICE: "Faktura",
  GENERAL: "Zpráva",
};

const TYPE_COLORS: Record<string, string> = {
  APPOINTMENT_CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  APPOINTMENT_REMINDER: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  APPOINTMENT_CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  WAITLIST_AVAILABLE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  INVOICE: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  GENERAL: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export default function NotificationsPage() {
  const shouldReduce = useReducedMotion();
  const { data: rawData, mutate } = useSWR("/notifications", fetcher, {
    refreshInterval: 30000,
  });

  const notifications = rawData?.notifications ?? (Array.isArray(rawData) ? rawData : []);
  const unread = notifications.filter((n: any) => !n.isRead);
  const sorted = [...notifications].sort(
    (a: any, b: any) => b.createdAt.localeCompare(a.createdAt)
  );

  const handleReadAll = async () => {
    haptics.light();
    await api.post("/notifications/read-all", {});
    mutate();
  };

  const handleRead = async (id: number) => {
    haptics.light();
    await api.post(`/notifications/${id}/read`, {});
    mutate();
  };

  const handleDelete = async (id: number) => {
    haptics.medium();
    await api.delete(`/notifications/${id}`);
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            className="flex items-center justify-between mb-6"
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Notifikace</h1>
              <AnimatePresence>
                {unread.length > 0 && (
                  <motion.span
                    key="badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full"
                  >
                    {unread.length}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {unread.length > 0 && (
                <motion.button
                  initial={shouldReduce ? {} : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={shouldReduce ? {} : { opacity: 0, x: 12 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.94 }}
                  onClick={handleReadAll}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <CheckCheck size={16} />
                  Označit vše přečteno
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          <AnimatePresence>
            {sorted.length === 0 && (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="card text-center py-12"
              >
                <motion.div
                  initial={shouldReduce ? {} : { scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.08 }}
                >
                  <Bell size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                </motion.div>
                <p className="text-gray-500 dark:text-gray-400">Žádné notifikace</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {sorted.map((n: any, i: number) => (
                <motion.div
                  key={n.id}
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.04 + i * 0.04 }}
                  layout
                  className={`card flex gap-4 transition-colors ${
                    !n.isRead
                      ? "border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800"
                      : ""
                  }`}
                >
                  {/* Unread dot */}
                  <div className="flex-shrink-0 mt-1">
                    <motion.div
                      animate={{
                        scale: n.isRead ? 1 : [1, 1.3, 1],
                        backgroundColor: n.isRead ? "#9ca3af" : "#3b82f6",
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-2 h-2 rounded-full mt-1"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            TYPE_COLORS[n.type] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {TYPE_LABELS[n.type] ?? n.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(n.createdAt).toLocaleDateString("cs-CZ", {
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!n.isRead && (
                          <motion.button
                            whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            onClick={() => handleRead(n.id)}
                            title="Označit přečteno"
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Check size={14} />
                          </motion.button>
                        )}
                        <motion.button
                          whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          onClick={() => handleDelete(n.id)}
                          title="Smazat"
                          className="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </motion.button>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{n.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{n.message}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
