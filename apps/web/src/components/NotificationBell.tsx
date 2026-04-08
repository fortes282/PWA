"use client";

import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = (url: string) => api.get<any>(url);

const dropdownVariants = {
  hidden: { opacity: 0, y: -6, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 400, damping: 28, mass: 0.7 },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.97,
    transition: { duration: 0.12, ease: "easeIn" as const },
  },
};

const notifItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, delay: i * 0.04 },
  }),
};

export default function NotificationBell({ size = "md" }: { size?: "md" | "lg" } = {}) {
  const [open, setOpen] = useState(false);
  const shouldReduce = useReducedMotion();
  // Lightweight badge: poll count every 30s without fetching payloads
  const { data: countData } = useSWR<{ count: number }>("/notifications/unread-count", fetcher, {
    refreshInterval: 30_000,
  });
  // Full list: only fetch when dropdown is open (or on mount for first render)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawNotifData, mutate } = useSWR<any>(open ? "/notifications" : null, fetcher);
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifications: NotificationItem[] = Array.isArray(rawNotifData)
    ? rawNotifData
    : (rawNotifData?.notifications ?? []);
  const unread = countData?.count ?? notifications.filter((n) => !n.isRead).length;

  // App Badge API — shows count on home screen icon
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return;
    if (unread > 0) {
      navigator.setAppBadge(unread).catch(() => {});
    } else {
      navigator.clearAppBadge?.().catch(() => {});
    }
  }, [unread]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleReadAll = async () => {
    await api.post("/notifications/read-all", {});
    mutate();
  };

  const handleRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`, {});
    mutate();
  };

  const handleClearRead = async () => {
    await api.delete("/notifications/clear-read");
    mutate();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.delete(`/notifications/${id}`);
    mutate();
  };

  const hasRead = notifications.some((n) => n.isRead);

  const TYPE_LABELS: Record<string, string> = {
    APPOINTMENT_CONFIRMED: "Termín potvrzen",
    APPOINTMENT_REMINDER: "Připomínka termínu",
    APPOINTMENT_CANCELLED: "Termín zrušen",
    WAITLIST_AVAILABLE: "Volný termín",
    INVOICE: "Faktura",
    GENERAL: "Zpráva",
  };

  return (
    <div ref={ref} className="relative">
      <motion.button
        onClick={() => setOpen(!open)}
        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
        className={`relative text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
          size === "lg" ? "p-3" : "p-2"
        }`}
        aria-label="Notifikace"
      >
        <Bell size={size === "lg" ? 26 : 20} />
        {unread > 0 && (
          <motion.span
            key={unread}
            className={`absolute bg-red-500 text-white font-bold rounded-full flex items-center justify-center ${
              size === "lg" ? "top-1 right-1 w-5 h-5 text-[11px]" : "top-1 right-1 w-4 h-4 text-[10px]"
            }`}
            initial={shouldReduce ? undefined : { scale: 0 }}
            animate={shouldReduce ? undefined : { scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Notifikace"
            className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
            variants={shouldReduce ? undefined : dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Notifikace</h3>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button
                    onClick={handleReadAll}
                    className="text-xs text-primary hover:text-primary"
                  >
                    Označit vše
                  </button>
                )}
                {hasRead && (
                  <button
                    onClick={handleClearRead}
                    className="text-xs text-gray-500 hover:text-red-500"
                    title="Smazat přečtené"
                  >
                    Smazat přečtené
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Žádné notifikace
                </div>
              )}
              {[...notifications]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 20)
                .map((n, i) => (
                  <motion.div
                    key={n.id}
                    custom={i}
                    variants={shouldReduce ? undefined : notifItemVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={() => { if (!n.isRead) handleRead(n.id); }}
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      !n.isRead ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {TYPE_LABELS[n.type] ?? n.type}
                      </p>
                      <p className="text-xs text-gray-900 dark:text-gray-100 font-medium truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleDateString("cs-CZ", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(n.id, e)}
                      className="text-gray-300 hover:text-red-400 flex-shrink-0 self-start mt-0.5 text-xs"
                      title="Smazat"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
