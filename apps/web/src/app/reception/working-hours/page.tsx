"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState } from "react";
import { Save, ChevronDown, CheckCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const DAYS = [
  { index: 1, label: "Pondělí" },
  { index: 2, label: "Úterý" },
  { index: 3, label: "Středa" },
  { index: 4, label: "Čtvrtek" },
  { index: 5, label: "Pátek" },
  { index: 6, label: "Sobota" },
  { index: 0, label: "Neděle" },
];

type WHRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type EmployeeWH = {
  id: number;
  name: string;
  email: string;
  workingHours: Array<{ id: number; dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;
};

function defaultHours(): WHRow[] {
  return DAYS.map((d) => ({
    dayOfWeek: d.index,
    startTime: "08:00",
    endTime: "16:00",
    isActive: d.index >= 1 && d.index <= 5,
  }));
}

function EmployeeHoursEditor({ emp, onSaved }: { emp: EmployeeWH; onSaved: () => void }) {
  const shouldReduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<WHRow[]>(() => {
    const base = defaultHours();
    const existing = emp.workingHours;
    return base.map((b) => {
      const found = existing.find((e) => e.dayOfWeek === b.dayOfWeek);
      return found ? { dayOfWeek: found.dayOfWeek, startTime: found.startTime, endTime: found.endTime, isActive: found.isActive } : b;
    });
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (i: number, field: keyof WHRow, value: string | boolean) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: value };
    setRows(next);
    setSaved(false);
  };

  const handleSave = async () => {
    haptics.medium();
    setSaving(true);
    setSaved(false);
    try {
      await api.put(`/working-hours/${emp.id}`, rows);
      haptics.success();
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <motion.button
        className="flex items-center justify-between w-full"
        onClick={() => { haptics.light(); setOpen(!open); }}
        whileTap={shouldReduce ? undefined : { scale: 0.99 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
      >
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{emp.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{emp.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {emp.workingHours.filter((w) => w.isActive).length} aktivních dní
          </span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <ChevronDown size={16} className="text-gray-500 dark:text-gray-400" />
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="hours-panel"
            initial={shouldReduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium px-1 mb-1">
                <span>Den</span>
                <span>Od</span>
                <span>Do</span>
                <span>Aktivní</span>
              </div>
              {DAYS.map((day, i) => {
                const row = rows[i];
                if (!row) return null;
                return (
                  <motion.div
                    key={day.index}
                    initial={shouldReduce ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className={`grid grid-cols-4 gap-2 items-center p-2 rounded-lg ${row.isActive ? "bg-gray-50 dark:bg-gray-800" : "bg-gray-50 dark:bg-gray-800 opacity-50"}`}
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{day.label}</span>
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) => update(i, "startTime", e.target.value)}
                      disabled={!row.isActive}
                      className="input text-sm py-1"
                    />
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(e) => update(i, "endTime", e.target.value)}
                      disabled={!row.isActive}
                      className="input text-sm py-1"
                    />
                    <label className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(e) => { haptics.light(); update(i, "isActive", e.target.checked); }}
                        className="w-4 h-4 accent-primary-600"
                      />
                    </label>
                  </motion.div>
                );
              })}

              <div className="flex items-center justify-between mt-3">
                <AnimatePresence>
                  {saved && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      className="text-xs text-green-600 font-medium flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Uloženo
                    </motion.span>
                  )}
                </AnimatePresence>
                <motion.button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 ml-auto disabled:opacity-50"
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  <Save size={14} /> {saving ? "Ukládám…" : "Uložit"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReceptionWorkingHours() {
  const shouldReduce = useReducedMotion();
  const { data: employees, mutate } = useSWR<EmployeeWH[]>("/working-hours/employees", fetcher as any);

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Pracovní hodiny</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Nastavte dostupnost každého terapeuta pro automatické generování slotů.
          </p>

          <AnimatePresence>
            {(!employees || employees.length === 0) && (
              <motion.div
                key="empty"
                initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="card text-center text-gray-500 dark:text-gray-400 py-10"
              >
                Žádní terapeuti v systému
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            {(employees ?? []).map((emp, i) => (
              <motion.div
                key={emp.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
              >
                <EmployeeHoursEditor emp={emp} onSaved={() => mutate()} />
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
