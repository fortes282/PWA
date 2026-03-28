"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";

import useSWR from "swr";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar, Users, Video, X } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any[]>(url);

type ViewMode = "week" | "month";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 border-yellow-300 text-yellow-800",
  CONFIRMED: "bg-blue-100 border-blue-300 text-blue-800",
  COMPLETED: "bg-green-100 border-green-300 text-green-800",
  CANCELLED: "bg-red-100 border-red-300 text-red-600 line-through",
  UNJUSTIFIED_CANCEL: "bg-red-100 border-red-300 text-red-800",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00
const DAYS_CZ = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
const MONTHS_CZ = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // start on Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMonthDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Pad to Monday
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const endPad = lastDay.getDay() === 0 ? 0 : 7 - lastDay.getDay();

  const days: Date[] = [];
  for (let i = startPad; i > 0; i--) days.push(addDays(firstDay, -i));
  for (let d = new Date(firstDay); d <= lastDay; d = addDays(d, 1)) days.push(new Date(d));
  for (let i = 1; i <= endPad; i++) days.push(addDays(lastDay, i));
  return days;
}

export default function ReceptionCalendar() {
  const shouldReduce = useReducedMotion();
  const [view, setView] = useState<ViewMode>("week");
  const [current, setCurrent] = useState(() => new Date());
  const [selectedTherapist, setSelectedTherapist] = useState<string>("all");
  const [selectedAppt, setSelectedAppt] = useState<any>(null);

  const { data: appointments } = useSWR("/appointments", fetcher);
  const { data: employees } = useSWR("/employees", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);
  const { data: services } = useSWR("/services", fetcher);

  const employeeMap = useMemo(
    () => Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name])),
    [employees]
  );
  const clientMap = useMemo(
    () => Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name])),
    [clients]
  );
  const serviceMap = useMemo(
    () => Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name])),
    [services]
  );

  // Filter appointments by therapist
  const filtered = useMemo(() => {
    if (!appointments) return [];
    if (selectedTherapist === "all") return appointments;
    return appointments.filter((a: any) => String(a.employeeId) === selectedTherapist);
  }, [appointments, selectedTherapist]);

  // ── WEEK VIEW ────────────────────────────────────────────────────────────────
  const weekStart = getWeekStart(current);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function apptsByDay(day: Date) {
    return filtered.filter((a: any) => {
      const d = new Date(a.startTime);
      return isSameDay(d, day);
    });
  }

  function apptTop(startTime: string): number {
    const d = new Date(startTime);
    const minutes = (d.getHours() - 7) * 60 + d.getMinutes();
    return Math.max(0, (minutes / 60) * 56); // 56px per hour
  }

  function apptHeight(startTime: string, endTime: string): number {
    const s = new Date(startTime);
    const e = new Date(endTime);
    const minutes = (e.getTime() - s.getTime()) / 60000;
    return Math.max(24, (minutes / 60) * 56);
  }

  // ── MONTH VIEW ───────────────────────────────────────────────────────────────
  const monthDays = getMonthDays(current.getFullYear(), current.getMonth());

  function navigatePrev() {
    haptics.light();
    if (view === "week") {
      setCurrent(addDays(current, -7));
    } else {
      const d = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      setCurrent(d);
    }
  }

  function navigateNext() {
    haptics.light();
    if (view === "week") {
      setCurrent(addDays(current, 7));
    } else {
      const d = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      setCurrent(d);
    }
  }

  function headerLabel() {
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return `${weekStart.getDate()}. ${MONTHS_CZ[weekStart.getMonth()]} – ${end.getDate()}. ${MONTHS_CZ[end.getMonth()]} ${end.getFullYear()}`;
    }
    return `${MONTHS_CZ[current.getMonth()]} ${current.getFullYear()}`;
  }

  const today = new Date();

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            className="flex flex-wrap items-center gap-3 mb-4"
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Calendar size={20} className="text-primary-600" />
            <h1 className="text-xl font-bold text-gray-900 flex-1">Kalendář</h1>

            {/* Therapist filter */}
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-500" />
              <select
                className="input py-1 text-sm"
                value={selectedTherapist}
                onChange={(e) => { haptics.light(); setSelectedTherapist(e.target.value); }}
              >
                <option value="all">Všichni terapeuti</option>
                {employees?.map((e: any) => (
                  <option key={e.id} value={String(e.id)}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(["week", "month"] as ViewMode[]).map((v) => (
                <motion.button
                  key={v}
                  onClick={() => { haptics.light(); setView(v); }}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    view === v
                      ? "bg-primary-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                  whileTap={shouldReduce ? undefined : { scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                >
                  {v === "week" ? "Týden" : "Měsíc"}
                </motion.button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-1">
              <motion.button
                onClick={() => { haptics.light(); setCurrent(new Date()); }}
                className="btn-secondary text-xs py-1 px-2"
                whileTap={shouldReduce ? undefined : { scale: 0.94 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                Dnes
              </motion.button>
              <motion.button
                onClick={navigatePrev}
                className="p-1 rounded hover:bg-gray-100"
                whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                <ChevronLeft size={18} />
              </motion.button>
              <span className="text-sm font-medium text-gray-700 min-w-[220px] text-center">
                {headerLabel()}
              </span>
              <motion.button
                onClick={navigateNext}
                className="p-1 rounded hover:bg-gray-100"
                whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                <ChevronRight size={18} />
              </motion.button>
            </div>
          </motion.div>

          {/* ── WEEK VIEW ─────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {view === "week" && (
              <motion.div
                key="week-view"
                initial={shouldReduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Day headers */}
                <div className="grid grid-cols-8 border-b border-gray-200">
                  <div className="py-2 text-xs text-gray-500 text-center">Čas</div>
                  {weekDays.map((day) => {
                    const isToday = isSameDay(day, today);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`py-2 text-center border-l border-gray-200 ${
                          isToday ? "bg-primary-50" : ""
                        }`}
                      >
                        <p className="text-xs text-gray-500">{DAYS_CZ[day.getDay()]}</p>
                        <p
                          className={`text-sm font-semibold ${
                            isToday
                              ? "text-primary-600 bg-primary-600 text-white w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                              : "text-gray-900"
                          }`}
                        >
                          {day.getDate()}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid */}
                <div className="grid grid-cols-8 overflow-auto max-h-[600px]">
                  {/* Hour labels */}
                  <div>
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="h-14 border-b border-gray-100 flex items-start justify-center"
                      >
                        <span className="text-[10px] text-gray-500 mt-1">
                          {String(h).padStart(2, "0")}:00
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day) => {
                    const dayAppts = apptsByDay(day);
                    const isToday = isSameDay(day, today);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`relative border-l border-gray-200 ${
                          isToday ? "bg-primary-50/30" : ""
                        }`}
                        style={{ height: `${HOURS.length * 56}px` }}
                      >
                        {/* Hour lines */}
                        {HOURS.map((h) => (
                          <div
                            key={h}
                            className="absolute left-0 right-0 border-b border-gray-100"
                            style={{ top: `${(h - 7) * 56}px`, height: "56px" }}
                          />
                        ))}

                        {/* Now line */}
                        {isToday && (() => {
                          const now = new Date();
                          const nowMinutes = (now.getHours() - 7) * 60 + now.getMinutes();
                          if (nowMinutes >= 0 && nowMinutes <= HOURS.length * 60) {
                            return (
                              <div
                                className="absolute left-0 right-0 border-t-2 border-red-400 z-10"
                                style={{ top: `${(nowMinutes / 60) * 56}px` }}
                              >
                                <div className="w-2 h-2 rounded-full bg-red-400 -mt-1 -ml-1" />
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Appointments */}
                        {dayAppts.map((a: any) => (
                          <motion.button
                            key={a.id}
                            onClick={() => { haptics.light(); setSelectedAppt(a); }}
                            className={`absolute left-0.5 right-0.5 rounded text-[10px] font-medium px-1 overflow-hidden border text-left hover:opacity-80 transition-opacity ${
                              STATUS_COLORS[a.status] ?? "bg-gray-100 border-gray-300"
                            }`}
                            style={{
                              top: `${apptTop(a.startTime)}px`,
                              height: `${apptHeight(a.startTime, a.endTime)}px`,
                            }}
                            title={`${clientMap[a.clientId] ?? "Klient"} — ${serviceMap[a.serviceId] ?? "Služba"}`}
                            whileTap={shouldReduce ? undefined : { scale: 0.96, opacity: 0.8 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <span className="block truncate">
                              {new Date(a.startTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="block truncate font-semibold">
                              {clientMap[a.clientId] ?? `#${a.clientId}`}
                            </span>
                            <span className="block truncate text-[9px] opacity-70">
                              {employeeMap[a.employeeId] ?? ""}
                              {a.isOnline && " 📹"}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ── MONTH VIEW ────────────────────────────────────────────────── */}
            {view === "month" && (
              <motion.div
                key="month-view"
                initial={shouldReduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* Weekday headers */}
                <div className="grid grid-cols-7 border-b border-gray-200">
                  {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div className="grid grid-cols-7">
                  {monthDays.map((day, i) => {
                    const isCurrentMonth = day.getMonth() === current.getMonth();
                    const isToday = isSameDay(day, today);
                    const dayAppts = apptsByDay(day).filter(
                      (a: any) => a.status !== "CANCELLED"
                    );

                    return (
                      <div
                        key={i}
                        className={`min-h-[90px] p-1 border-b border-r border-gray-100 ${
                          !isCurrentMonth ? "bg-gray-50" : ""
                        } ${isToday ? "bg-primary-50/50" : ""}`}
                      >
                        <p
                          className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? "bg-primary-600 text-white"
                              : isCurrentMonth
                              ? "text-gray-800"
                              : "text-gray-500"
                          }`}
                        >
                          {day.getDate()}
                        </p>
                        <div className="space-y-0.5">
                          {dayAppts.slice(0, 3).map((a: any) => (
                            <motion.button
                              key={a.id}
                              onClick={() => { haptics.light(); setSelectedAppt(a); }}
                              className={`w-full text-left text-[10px] px-1 rounded truncate border ${
                                STATUS_COLORS[a.status] ?? "bg-gray-100"
                              }`}
                              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            >
                              {new Date(a.startTime).toLocaleTimeString("cs-CZ", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}{" "}
                              {clientMap[a.clientId] ?? `#${a.clientId}`}
                            </motion.button>
                          ))}
                          {dayAppts.length > 3 && (
                            <p className="text-[10px] text-gray-500 pl-1">
                              +{dayAppts.length - 3} dalších
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <motion.div
            className="mt-3 flex flex-wrap gap-3"
            initial={shouldReduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {Object.entries({
              PENDING: "Čeká",
              CONFIRMED: "Potvrzeno",
              COMPLETED: "Dokončeno",
              UNJUSTIFIED_CANCEL: "Neoprávněné storno",
              CANCELLED: "Zrušeno",
            }).map(([status, label]) => (
              <span
                key={status}
                className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[status]}`}
              >
                {label}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── Appointment Detail Modal ──────────────────────────────────────── */}
        <AnimatePresence>
          {selectedAppt && (
            <motion.div
              key="appt-modal-backdrop"
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setSelectedAppt(null); }}
            >
              <motion.div
                className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Detail rezervace</h2>
                  <motion.button
                    onClick={() => { haptics.light(); setSelectedAppt(null); }}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <X size={18} />
                  </motion.button>
                </div>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Klient</dt>
                    <dd className="font-medium">
                      {clientMap[selectedAppt.clientId] ?? `#${selectedAppt.clientId}`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Terapeut</dt>
                    <dd className="font-medium">
                      {employeeMap[selectedAppt.employeeId] ?? `#${selectedAppt.employeeId}`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Služba</dt>
                    <dd className="font-medium">
                      {serviceMap[selectedAppt.serviceId] ?? `#${selectedAppt.serviceId}`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Začátek</dt>
                    <dd className="font-medium">
                      {new Date(selectedAppt.startTime).toLocaleString("cs-CZ", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Konec</dt>
                    <dd className="font-medium">
                      {new Date(selectedAppt.endTime).toLocaleString("cs-CZ", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <span
                        className={`px-2 py-0.5 rounded text-xs border ${
                          STATUS_COLORS[selectedAppt.status]
                        }`}
                      >
                        {selectedAppt.status}
                      </span>
                    </dd>
                  </div>
                  {selectedAppt.notes && (
                    <div>
                      <dt className="text-gray-500 mb-1">Poznámka</dt>
                      <dd className="text-gray-700 bg-gray-50 rounded p-2 text-xs">
                        {selectedAppt.notes}
                      </dd>
                    </div>
                  )}
                </dl>

                {selectedAppt.isOnline && (
                  <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-700 text-sm">
                    <Video size={14} />
                    <span className="font-medium">Online rezervace</span>
                    {selectedAppt.status === "CONFIRMED" && (
                      <Link
                        href={`/video/${selectedAppt.id}`}
                        className="ml-auto text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg"
                      >
                        Zahájit
                      </Link>
                    )}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <a
                    href={`/reception/appointments`}
                    className="btn-secondary text-sm flex-1 text-center"
                    onClick={() => haptics.light()}
                  >
                    Správa rezervací
                  </a>
                  <motion.button
                    onClick={() => { haptics.light(); setSelectedAppt(null); }}
                    className="btn-primary text-sm flex-1"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    Zavřít
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
