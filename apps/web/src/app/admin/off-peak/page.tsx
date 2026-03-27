"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Clock, Plus, Trash2, Percent } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

const DAYS_CZ: Record<string, string> = {
  MON: "Pondělí",
  TUE: "Úterý",
  WED: "Středa",
  THU: "Čtvrtek",
  FRI: "Pátek",
  SAT: "Sobota",
  SUN: "Neděle",
};

const DAY_OPTIONS = [
  { value: "MON", label: "Pondělí" },
  { value: "TUE", label: "Úterý" },
  { value: "WED", label: "Středa" },
  { value: "THU", label: "Čtvrtek" },
  { value: "FRI", label: "Pátek" },
  { value: "SAT", label: "Sobota" },
  { value: "SUN", label: "Neděle" },
];

export default function AdminOffPeak() {
  const shouldReduce = useReducedMotion();
  const { data: rules, mutate } = useSWR("/off-peak/rules", fetcher);
  const { toast } = useToast();

  const [dayOfWeek, setDayOfWeek] = useState("MON");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("09:00");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (discountPercent < 5 || discountPercent > 50) {
      toast("error", "Sleva musí být mezi 5 % a 50 %.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/off-peak/rules", {
        dayOfWeek,
        startTime,
        endTime,
        discountPercent,
      });
      toast("success", "Pravidlo bylo vytvořeno.");
      mutate();
    } catch {
      toast("error", "Chyba při vytváření pravidla.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    haptics.medium();
    try {
      await api.delete(`/off-peak/rules/${id}`);
      toast("success", "Pravidlo bylo smazáno.");
      mutate();
    } catch {
      toast("error", "Chyba při mazání pravidla.");
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3"
          >
            <Percent size={24} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Slevy mimo špičku</h1>
          </motion.div>

          {/* Create form */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="card"
          >
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Nové pravidlo</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Den v týdnu
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sleva (%)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={50}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Od
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Do
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors min-h-[44px] text-sm font-medium"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                <Plus size={16} />
                {submitting ? "Vytvářím..." : "Přidat pravidlo"}
              </motion.button>
            </form>
          </motion.div>

          {/* Rules list */}
          <AnimatePresence mode="wait">
            {!rules ? (
              <motion.p
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Načítám pravidla...
              </motion.p>
            ) : rules.length === 0 ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card text-center py-8"
              >
                <Clock size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Zatím nejsou definována žádná pravidla</p>
              </motion.div>
            ) : (
              <motion.div
                key="rules-list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {rules.map((rule: any, i: number) => (
                  <motion.div
                    key={rule.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className="card flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {DAYS_CZ[rule.dayOfWeek] ?? rule.dayOfWeek}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {rule.startTime} – {rule.endTime}
                      </span>
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                        -{rule.discountPercent} %
                      </span>
                    </div>
                    <motion.button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                    >
                      <Trash2 size={16} />
                    </motion.button>
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
