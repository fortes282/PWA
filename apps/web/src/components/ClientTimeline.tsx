"use client";

import { api } from "@/lib/api";
import useSWR from "swr";
import { Calendar, FileText, CreditCard, BookOpen, Star, Mail, Activity } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

interface TimelineEvent {
  type: string;
  id: number;
  createdAt: string;
  title: string;
  subtitle?: string;
  badge: string;
  badgeColor: string;
  data: Record<string, unknown>;
}

interface TimelineResponse {
  clientId: number;
  events: TimelineEvent[];
  nextCursor: string | null;
  total: number;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  appointment: <Calendar size={16} className="text-blue-600" />,
  invoice: <FileText size={16} className="text-purple-600" />,
  credit: <CreditCard size={16} className="text-green-600" />,
  medical_report: <BookOpen size={16} className="text-indigo-600" />,
  loyalty: <Star size={16} className="text-yellow-500" />,
  message: <Mail size={16} className="text-sky-600" />,
};

const BADGE_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-600",
  yellow: "bg-yellow-100 text-yellow-700",
  purple: "bg-purple-100 text-purple-700",
  indigo: "bg-indigo-100 text-indigo-700",
  sky: "bg-sky-100 text-sky-700",
};

function formatEventDate(dt: string) {
  try {
    return new Date(dt).toLocaleString("cs-CZ", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

export default function ClientTimeline({ clientId }: { clientId: number | string }) {
  const shouldReduceMotion = useReducedMotion();
  const fetcher = (url: string) => api.get<TimelineResponse>(url);
  const { data, isLoading } = useSWR<TimelineResponse>(
    `/clients/${clientId}/timeline?limit=30`,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400 gap-2">
        <Activity size={28} />
        <p className="text-sm">Žádné události</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line with draw-on effect */}
      <motion.div
        className="absolute left-3.5 top-0 w-0.5 bg-gray-200 dark:bg-gray-700"
        initial={shouldReduceMotion ? { height: "100%" } : { height: 0 }}
        animate={{ height: "100%" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      <div
        className="space-y-4"
      >
        {data.events.map((ev, i) => (
          <motion.div
            key={`${ev.type}-${ev.id}`}
            className="flex gap-3 relative"
            initial={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ type: "spring", stiffness: 340, damping: 30, delay: 0.04 + i * 0.04 }}
          >
            {/* Icon bubble */}
            <div className="w-7 h-7 rounded-full bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center flex-shrink-0 z-10">
              {TYPE_ICON[ev.type] ?? <Activity size={14} className="text-gray-500 dark:text-gray-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2 min-w-0">
              <div className="flex items-start gap-2 justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{ev.title}</p>
                  {ev.subtitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ev.subtitle}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLORS[ev.badgeColor] ?? BADGE_COLORS.gray}`}>
                    {ev.badge}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatEventDate(ev.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {data.nextCursor && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
          Zobrazeno {data.events.length} událostí
        </p>
      )}
    </div>
  );
}
