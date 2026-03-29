"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  X,
  User,
  Sparkles,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const DAY_NAMES_FULL = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];
const DAY_NAMES_SHORT = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

const TIME_OFF_TYPES: Record<string, string> = {
  vacation: "Dovolená",
  sick: "Nemoc",
  other: "Jiný důvod",
};

const THERAPIST_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-300", text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-500" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-300", text: "text-purple-800 dark:text-purple-300", dot: "bg-purple-500" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", border: "border-teal-300", text: "text-teal-800 dark:text-teal-300", dot: "bg-teal-500" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", border: "border-rose-300", text: "text-rose-800 dark:text-rose-300", dot: "bg-rose-500" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300", text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300", text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500" },
];

const TIME_GRID: string[] = [];
for (let h = 8; h <= 16; h++) {
  TIME_GRID.push(`${String(h).padStart(2, "0")}:00`);
  TIME_GRID.push(`${String(h).padStart(2, "0")}:30`);
}

interface EmployeeUser {
  id: number;
  name: string;
  role: string;
}

interface WorkScheduleRow {
  id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

interface DaySchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  enabled: boolean;
}

interface SlotRow {
  id: number;
  employee_id: number;
  date: string;
  time: string;
  status: "open" | "booked" | "cancelled";
  client_name?: string;
  client_phone?: string;
  employee_name?: string;
  b_id?: number;
}

interface TimeOffRow {
  id: number;
  date_from: string;
  date_to: string;
  type: string;
  note: string | null;
}

interface ClientUser {
  id: number;
  name: string;
  email: string;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: string, n: number) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function getMonday(offset: number): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  d.setDate(diff);
  d.setHours(12, 0, 0, 0);
  return toDateStr(d);
}

function formatWeekRange(mondayStr: string): string {
  const mon = new Date(mondayStr + "T12:00:00");
  const sun = new Date(mondayStr + "T12:00:00");
  sun.setDate(sun.getDate() + 6);
  const fmtDay = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
  const year = sun.getFullYear();
  return `${fmtDay(mon)} – ${fmtDay(sun)}${year}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ReceptionSchedule() {
  const shouldReduce = useReducedMotion();
  const { toast } = useToast();
  const today = toDateStr(new Date());
  const [activeTab, setActiveTab] = useState<"schedule" | "slots" | "timeoff" | "autofill">("slots");
  const [selectedEmpId, setSelectedEmpId] = useState<number | "all">("all");

  // ── Employees ──
  const { data: employees } = useSWR<EmployeeUser[]>("/users?role=EMPLOYEE", fetcher);

  const emp = typeof selectedEmpId === "number"
    ? employees?.find((e) => e.id === selectedEmpId)
    : null;

  const therapistColorMap = useMemo(() => {
    const map = new Map<number, (typeof THERAPIST_COLORS)[0]>();
    (employees ?? []).forEach((e, i) => {
      map.set(e.id, THERAPIST_COLORS[i % THERAPIST_COLORS.length]);
    });
    return map;
  }, [employees]);

  // ── Work Schedule (read-only) ──
  const [scheduleRows, setScheduleRows] = useState<DaySchedule[]>(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      startTime: "08:00",
      endTime: "17:00",
      breakStart: "12:00",
      breakEnd: "13:00",
      enabled: d >= 1 && d <= 5,
    }))
  );

  const scheduleEmpId = typeof selectedEmpId === "number" ? selectedEmpId : null;
  const { data: workScheduleRaw } = useSWR<WorkScheduleRow[]>(
    scheduleEmpId ? `/work-schedule/${scheduleEmpId}` : null,
    fetcher
  );

  useEffect(() => {
    if (workScheduleRaw && workScheduleRaw.length > 0) {
      setScheduleRows((prev) =>
        prev.map((row) => {
          const found = workScheduleRaw.find((d) => d.day_of_week === row.dayOfWeek);
          if (found) {
            return {
              ...row,
              startTime: found.start_time,
              endTime: found.end_time,
              breakStart: found.break_start ?? "12:00",
              breakEnd: found.break_end ?? "13:00",
              enabled: true,
            };
          }
          return { ...row, enabled: false };
        })
      );
    }
  }, [workScheduleRaw]);

  // ── Calendar Week Navigation ──
  const [weekOffset, setWeekOffset] = useState(0);
  const weekMonday = getMonday(weekOffset);
  const weekSunday = addDays(weekMonday, 6);

  const weekDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(weekMonday, i));
    }
    return dates;
  }, [weekMonday]);

  // ── Slots ──
  const [openSlotsModal, setOpenSlotsModal] = useState(false);
  const [openPeriodFrom, setOpenPeriodFrom] = useState(today);
  const [openPeriodTo, setOpenPeriodTo] = useState(addDays(today, 6));
  const [openingSlots, setOpeningSlots] = useState(false);
  const [slotDetailModal, setSlotDetailModal] = useState<SlotRow | null>(null);
  const [bookingClientId, setBookingClientId] = useState<number | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  const slotsKey = useMemo(() => {
    const base = `/slots?from=${weekMonday}&to=${weekSunday}`;
    if (typeof selectedEmpId === "number") {
      return `${base}&employeeId=${selectedEmpId}`;
    }
    return base;
  }, [selectedEmpId, weekMonday, weekSunday]);

  const { data: slotsData, mutate: mutateSlots } = useSWR<SlotRow[]>(slotsKey, fetcher);
  const { data: clientsData } = useSWR<ClientUser[]>("/users?role=CLIENT", fetcher);

  const slotGrid = useMemo(() => {
    const grid = new Map<string, SlotRow[]>();
    for (const slot of slotsData ?? []) {
      if (slot.status === "cancelled") continue;
      const key = `${slot.date}__${slot.time}`;
      const existing = grid.get(key) ?? [];
      grid.set(key, [...existing, slot]);
    }
    return grid;
  }, [slotsData]);

  const visibleTherapists = useMemo(() => {
    if (typeof selectedEmpId === "number") {
      const found = employees?.find((e) => e.id === selectedEmpId);
      return found ? [found] : [];
    }
    const ids = new Set<number>();
    for (const slot of slotsData ?? []) {
      if (slot.status !== "cancelled") ids.add(slot.employee_id);
    }
    return (employees ?? []).filter((e) => ids.has(e.id));
  }, [selectedEmpId, slotsData, employees]);

  const openSlots = useCallback(async () => {
    const empIdForOpen = typeof selectedEmpId === "number" ? selectedEmpId : null;
    if (!empIdForOpen) return;
    haptics.medium();
    setOpeningSlots(true);
    try {
      const result = await api.post<{ preview: number; created: number; skipped: number }>("/slots/open", {
        employeeId: empIdForOpen,
        from: openPeriodFrom,
        to: openPeriodTo,
      });
      haptics.success();
      toast("success", `Otevřeno ${result.created} nových rezervací`);
      setOpenSlotsModal(false);
      mutateSlots();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chyba";
      toast("error", `Chyba: ${msg}`);
    } finally {
      setOpeningSlots(false);
    }
  }, [selectedEmpId, openPeriodFrom, openPeriodTo, toast, mutateSlots]);

  const closeSlot = useCallback(async (slotId: number) => {
    haptics.medium();
    try {
      await api.delete(`/slots/${slotId}`);
      haptics.success();
      toast("success", "Slot zrušen");
      setSlotDetailModal(null);
      mutateSlots();
    } catch {
      toast("error", "Chyba při rušení slotu");
    }
  }, [toast, mutateSlots]);

  const bookForClient = useCallback(async () => {
    if (!slotDetailModal || !bookingClientId) return;
    haptics.medium();
    setBookingInProgress(true);
    try {
      await api.post("/bookings-v2", {
        slotId: slotDetailModal.id,
        clientId: bookingClientId,
        note: bookingNote || undefined,
      });
      haptics.success();
      toast("success", "Rezervace potvrzena");
      setSlotDetailModal(null);
      setBookingClientId(null);
      setBookingNote("");
      mutateSlots();
    } catch {
      toast("error", "Chyba při rezervaci");
    } finally {
      setBookingInProgress(false);
    }
  }, [slotDetailModal, bookingClientId, bookingNote, toast, mutateSlots]);

  const cancelBooking = useCallback(async (slot: SlotRow) => {
    if (!slot.b_id) return;
    haptics.medium();
    setCancellingBooking(true);
    try {
      await api.delete(`/bookings-v2/${slot.b_id}`);
      haptics.success();
      toast("success", "Rezervace zrušena, slot je opět volný");
      setSlotDetailModal(null);
      mutateSlots();
    } catch {
      toast("error", "Chyba při rušení rezervace");
    } finally {
      setCancellingBooking(false);
    }
  }, [toast, mutateSlots]);

  // ── Smart Auto-fill ──
  interface SuggestionItem {
    dayOfWeek: number;
    dayName: string;
    time: string;
    count: number;
    label: string;
  }
  const [autofillWeeks, setAutofillWeeks] = useState(8);
  const [autofillKey, setAutofillKey] = useState(0);
  const autofillEmpId = typeof selectedEmpId === "number" ? selectedEmpId : null;
  const autofillSWRKey = autofillEmpId && activeTab === "autofill"
    ? `/slots/suggestions?employeeId=${autofillEmpId}&weeks=${autofillWeeks}&_k=${autofillKey}`
    : null;
  const { data: autofillData, isLoading: autofillLoading } = useSWR<{ lookbackWeeks: number; suggestions: SuggestionItem[] }>(
    autofillSWRKey,
    fetcher
  );
  const [acceptedSlots, setAcceptedSlots] = useState<Set<string>>(new Set());
  const [acceptingSlot, setAcceptingSlot] = useState<string | null>(null);

  const acceptSuggestion = useCallback(async (sug: SuggestionItem) => {
    if (!autofillEmpId) return;
    haptics.medium();
    const key = `${sug.dayOfWeek}:${sug.time}`;
    setAcceptingSlot(key);

    const now = new Date();
    const targetDow = sug.dayOfWeek;
    const currentDow = now.getDay();
    let daysUntil = targetDow - currentDow;
    if (daysUntil <= 0) daysUntil += 7;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysUntil);
    const dateStr = targetDate.toISOString().slice(0, 10);

    try {
      await api.post("/slots/open", {
        employeeId: autofillEmpId,
        from: dateStr,
        to: dateStr,
        forceTimes: [sug.time],
      });
      haptics.success();
      setAcceptedSlots((prev) => new Set([...prev, key]));
      toast("success", `Slot ${sug.dayName} ${sug.time} otevřen (${dateStr})`);
      mutateSlots();
    } catch {
      toast("error", "Nepodařilo se otevřít slot");
    } finally {
      setAcceptingSlot(null);
    }
  }, [autofillEmpId, toast, mutateSlots]);

  // ── Time Off ──
  const [timeOffForm, setTimeOffForm] = useState({ dateFrom: today, dateTo: today, type: "vacation", note: "" });
  const [savingTimeOff, setSavingTimeOff] = useState(false);

  const timeOffEmpId = typeof selectedEmpId === "number" ? selectedEmpId : null;
  const { data: timeOffData, mutate: mutateTimeOff } = useSWR<TimeOffRow[]>(
    timeOffEmpId ? `/time-off-v2/${timeOffEmpId}` : null,
    fetcher
  );

  const saveTimeOff = useCallback(async () => {
    if (!timeOffEmpId) return;
    haptics.medium();
    setSavingTimeOff(true);
    try {
      await api.post("/time-off-v2", {
        employeeId: timeOffEmpId,
        dateFrom: timeOffForm.dateFrom,
        dateTo: timeOffForm.dateTo,
        type: timeOffForm.type,
        note: timeOffForm.note || undefined,
      });
      haptics.success();
      toast("success", "Nepřítomnost zadána");
      setTimeOffForm({ dateFrom: today, dateTo: today, type: "vacation", note: "" });
      mutateTimeOff();
    } catch {
      toast("error", "Chyba");
    } finally {
      setSavingTimeOff(false);
    }
  }, [timeOffEmpId, timeOffForm, today, toast, mutateTimeOff]);

  const deleteTimeOff = useCallback(async (id: number) => {
    haptics.medium();
    try {
      await api.delete(`/time-off-v2/${id}`);
      haptics.success();
      toast("success", "Smazáno");
      mutateTimeOff();
    } catch {
      toast("error", "Chyba");
    }
  }, [toast, mutateTimeOff]);

  const TAB_LABELS: Record<string, React.ReactNode> = {
    slots: "Rezervace",
    schedule: "Pracovní doba",
    timeoff: "Nepřítomnost",
    autofill: <><Sparkles size={14} className="text-amber-500 inline mr-1" />Chytré doplnění</>,
  };

  const needsSpecificEmployee = activeTab === "schedule" || activeTab === "timeoff" || activeTab === "autofill";

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-6xl mx-auto p-4">
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Calendar className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Správa rezervací — Recepce</h1>
          </motion.div>

          {/* Therapist selector */}
          <motion.div
            className="card mb-4"
            initial={shouldReduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
          >
            <label className="label">Vyberte terapeuta</label>
            <select
              value={selectedEmpId}
              onChange={(e) => {
                haptics.light();
                const val = e.target.value;
                setSelectedEmpId(val === "all" ? "all" : parseInt(val));
              }}
              className="input max-w-xs"
            >
              <option value="all">Všichni</option>
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </motion.div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            {(["slots", "schedule", "timeoff", "autofill"] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => { haptics.light(); setActiveTab(tab); }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  activeTab === tab
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
                whileTap={shouldReduce ? undefined : { scale: 0.96 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                {TAB_LABELS[tab]}
              </motion.button>
            ))}
          </div>

          {/* Show info when a specific employee is needed but "Vsichni" is selected */}
          <AnimatePresence mode="wait">
            {needsSpecificEmployee && selectedEmpId === "all" ? (
              <motion.div
                key="need-emp"
                initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card text-center py-16 text-gray-500"
              >
                <User size={48} className="mx-auto mb-4 opacity-30" />
                <p>Pro tuto záložku vyberte konkrétního terapeuta.</p>
              </motion.div>
            ) : (
              <motion.div
                key="tab-content"
                initial={shouldReduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
              >
                <AnimatePresence mode="wait">
                  {/* ═══════ Tab: Rezervace (Calendar View) ═══════ */}
                  {activeTab === "slots" && (
                    <motion.div
                      key="tab-slots"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      {/* Week navigation + Open button */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => { haptics.light(); setWeekOffset((o) => o - 1); }}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            aria-label="Předchozí týden"
                          >
                            <ChevronLeft size={18} />
                          </motion.button>
                          <motion.button
                            onClick={() => { haptics.light(); setWeekOffset(0); }}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                            whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            Dnes
                          </motion.button>
                          <motion.button
                            onClick={() => { haptics.light(); setWeekOffset((o) => o + 1); }}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            aria-label="Další týden"
                          >
                            <ChevronRight size={18} />
                          </motion.button>
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 ml-1">
                            {formatWeekRange(weekMonday)}
                          </span>
                        </div>
                        {typeof selectedEmpId === "number" && (
                          <motion.button
                            onClick={() => { haptics.medium(); setOpenSlotsModal(true); }}
                            className="btn-primary flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <Plus size={16} /> Otevřít rezervace
                          </motion.button>
                        )}
                      </div>

                      {/* Therapist color legend */}
                      {visibleTherapists.length > 1 && (
                        <motion.div
                          initial={shouldReduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className="flex flex-wrap items-center gap-3 px-1"
                        >
                          {visibleTherapists.map((t) => {
                            const color = therapistColorMap.get(t.id);
                            return (
                              <div key={t.id} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-gray-400"}`} />
                                <span>{t.name}</span>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}

                      {/* Calendar grid */}
                      <div className="overflow-x-auto -mx-4 px-4 pb-2">
                        <div className="min-w-[700px]">
                          {/* Header row: day names */}
                          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200 dark:border-gray-700">
                            <div className="p-2 text-xs text-gray-400" />
                            {weekDates.map((dateStr) => {
                              const d = new Date(dateStr + "T12:00:00");
                              const dow = d.getDay();
                              const isToday = dateStr === today;
                              return (
                                <div
                                  key={dateStr}
                                  className={`p-2 text-center border-l border-gray-200 dark:border-gray-700 ${
                                    isToday ? "bg-primary-50 dark:bg-primary-900/20" : ""
                                  }`}
                                >
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{DAY_NAMES_SHORT[dow]}</div>
                                  <div className={`text-sm font-semibold ${
                                    isToday ? "text-primary-600" : "text-gray-800 dark:text-gray-200"
                                  }`}>
                                    {d.getDate()}.{d.getMonth() + 1}.
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Time rows */}
                          {TIME_GRID.map((time) => (
                            <div
                              key={time}
                              className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100 dark:border-gray-800"
                            >
                              {/* Time label */}
                              <div className="p-1 pr-2 text-right text-xs text-gray-400 dark:text-gray-500 font-mono leading-8">
                                {time}
                              </div>

                              {/* Day cells */}
                              {weekDates.map((dateStr) => {
                                const cellKey = `${dateStr}__${time}`;
                                const cellSlots = slotGrid.get(cellKey) ?? [];
                                const isToday = dateStr === today;
                                return (
                                  <div
                                    key={cellKey}
                                    className={`border-l border-gray-100 dark:border-gray-800 min-h-[32px] p-0.5 ${
                                      isToday ? "bg-primary-50/50 dark:bg-primary-900/10" : ""
                                    }`}
                                  >
                                    {cellSlots.map((slot) => {
                                      const color = therapistColorMap.get(slot.employee_id) ?? THERAPIST_COLORS[0];
                                      const isBooked = slot.status === "booked";
                                      return (
                                        <motion.button
                                          key={slot.id}
                                          onClick={() => {
                                            haptics.light();
                                            setSlotDetailModal(slot);
                                            setBookingClientId(null);
                                            setBookingNote("");
                                          }}
                                          className={`w-full text-left px-1.5 py-0.5 rounded text-xs font-medium border truncate mb-0.5 ${color.bg} ${color.border} ${color.text} ${
                                            isBooked ? "opacity-80" : ""
                                          }`}
                                          whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                          title={`${slot.employee_name ?? ""} ${time} — ${isBooked ? "Zarezervováno" : "Volný"}`}
                                        >
                                          <span className="flex items-center gap-1">
                                            {visibleTherapists.length > 1 && (
                                              <span className="font-bold">{getInitials(slot.employee_name ?? "")}</span>
                                            )}
                                            {isBooked ? (
                                              <span className="truncate">{slot.client_name ?? "Rez."}</span>
                                            ) : (
                                              <span className="truncate opacity-70">volný</span>
                                            )}
                                          </span>
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {(slotsData ?? []).filter((s) => s.status !== "cancelled").length === 0 && (
                        <div className="card text-center py-12 text-gray-500">Žádné sloty v tomto týdnu.</div>
                      )}
                    </motion.div>
                  )}

                  {/* ═══════ Tab: Pracovní doba (READ ONLY) ═══════ */}
                  {activeTab === "schedule" && (
                    <motion.div
                      key="tab-schedule"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="card"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Pracovní doba — {emp?.name ?? ""}
                        </h2>
                        <span className="text-xs text-gray-400 dark:text-gray-500">(pouze pro čtení)</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Den</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Začátek</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Konec</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Pauza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scheduleRows.map((row) => (
                              <tr
                                key={row.dayOfWeek}
                                className={`border-b border-gray-100 dark:border-gray-800 ${
                                  row.enabled ? "" : "opacity-40"
                                }`}
                              >
                                <td className="py-2.5 px-3 font-medium text-gray-700 dark:text-gray-300">
                                  {DAY_NAMES_FULL[row.dayOfWeek]}
                                </td>
                                {row.enabled ? (
                                  <>
                                    <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-mono">{row.startTime}</td>
                                    <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-mono">{row.endTime}</td>
                                    <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-mono">
                                      {row.breakStart} – {row.breakEnd}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-2.5 px-3 text-gray-400">—</td>
                                    <td className="py-2.5 px-3 text-gray-400">—</td>
                                    <td className="py-2.5 px-3 text-gray-400">—</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {/* ═══════ Tab: Chytré doplnění ═══════ */}
                  {activeTab === "autofill" && (
                    <motion.div
                      key="tab-autofill"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      <div className="card">
                        <div className="flex items-start gap-3 mb-4">
                          <Sparkles className="text-amber-500 mt-0.5 shrink-0" size={22} />
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chytré doplnění rozvrhu</h2>
                            <p className="text-sm text-gray-500 mt-1">
                              Analýza historické poptávky — navrhne rezervace, které klienti nejčastěji využívají
                              a zatím nejsou otevřeny v příštích dvou týdnech.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">Analyzovat posledních</label>
                            <select
                              value={autofillWeeks}
                              onChange={(e) => setAutofillWeeks(parseInt(e.target.value))}
                              className="input-sm"
                            >
                              <option value={4}>4 týdny</option>
                              <option value={8}>8 týdnů</option>
                              <option value={12}>12 týdnů</option>
                              <option value={24}>24 týdnů</option>
                            </select>
                          </div>
                          <motion.button
                            onClick={() => { haptics.medium(); setAcceptedSlots(new Set()); setAutofillKey((k) => k + 1); }}
                            className="btn-primary flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <Sparkles size={16} /> Analyzovat poptávku
                          </motion.button>
                        </div>
                      </div>

                      {autofillLoading && (
                        <div className="card text-center py-10 text-gray-500">
                          <div className="animate-spin w-8 h-8 border-4 border-primary-300 border-t-primary-600 rounded-full mx-auto mb-3" />
                          Analyzuji historii rezervací…
                        </div>
                      )}

                      {!autofillLoading && autofillData && autofillData.suggestions.length === 0 && (
                        <motion.div
                          initial={shouldReduce ? false : { opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 380, damping: 26 }}
                          className="card text-center py-10 text-gray-500"
                        >
                          <CheckCircle size={40} className="mx-auto mb-3 text-green-400" />
                          <p className="font-medium text-gray-700 dark:text-gray-300">Rozvrh je optimálně doplněn</p>
                          <p className="text-sm mt-1">Všechny oblíbené rezervace jsou v příštích 2 týdnech otevřeny.</p>
                        </motion.div>
                      )}

                      {!autofillLoading && autofillData && autofillData.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500 px-1">
                            Nalezeno <strong>{autofillData.suggestions.length}</strong> rezervací s vysokou poptávkou,
                            které ještě nejsou otevřeny v příštích 2 týdnech:
                          </p>
                          {autofillData.suggestions.map((sug, i) => {
                            const key = `${sug.dayOfWeek}:${sug.time}`;
                            const accepted = acceptedSlots.has(key);
                            return (
                              <motion.div
                                key={key}
                                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: accepted ? 0.5 : 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 380, damping: 26, delay: i * 0.04 }}
                                className="card flex items-center justify-between gap-3 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-xs font-semibold text-amber-700">{sug.dayName}</span>
                                    <span className="text-sm font-bold text-amber-800">{sug.time}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">
                                      {sug.dayName} {sug.time}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {sug.count}x rezervováno za posledních {autofillData.lookbackWeeks} týdnů
                                    </p>
                                  </div>
                                </div>
                                {accepted ? (
                                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                    <CheckCircle size={16} /> Otevřeno
                                  </span>
                                ) : (
                                  <motion.button
                                    onClick={() => acceptSuggestion(sug)}
                                    disabled={acceptingSlot === key}
                                    className="btn-primary text-sm py-1.5 px-3 shrink-0 disabled:opacity-50"
                                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                  >
                                    {acceptingSlot === key ? "Otvírám…" : "Otevřít slot"}
                                  </motion.button>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {!autofillLoading && !autofillData && (
                        <div className="card text-center py-12 text-gray-400">
                          <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
                          <p>Klikněte na &ldquo;Analyzovat poptávku&rdquo; pro zobrazení návrhů.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ═══════ Tab: Nepřítomnost ═══════ */}
                  {activeTab === "timeoff" && (
                    <motion.div
                      key="tab-timeoff"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      <div className="card">
                        <h2 className="text-lg font-semibold mb-4">Zadat nepřítomnost — {emp?.name}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Od</label>
                            <input type="date" value={timeOffForm.dateFrom} onChange={(e) => setTimeOffForm((f) => ({ ...f, dateFrom: e.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="label">Do</label>
                            <input type="date" value={timeOffForm.dateTo} onChange={(e) => setTimeOffForm((f) => ({ ...f, dateTo: e.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="label">Typ</label>
                            <select value={timeOffForm.type} onChange={(e) => setTimeOffForm((f) => ({ ...f, type: e.target.value }))} className="input">
                              <option value="vacation">Dovolená</option>
                              <option value="sick">Nemocenská</option>
                              <option value="other">Jiný důvod</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Poznámka</label>
                            <input type="text" value={timeOffForm.note} onChange={(e) => setTimeOffForm((f) => ({ ...f, note: e.target.value }))} className="input" />
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                          <motion.button
                            onClick={saveTimeOff}
                            disabled={savingTimeOff}
                            className="btn-primary disabled:opacity-50"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            {savingTimeOff ? "Ukládám…" : "Zadat"}
                          </motion.button>
                        </div>
                      </div>

                      <div className="card">
                        <h2 className="text-lg font-semibold mb-4">Plánované nepřítomnosti</h2>
                        {(timeOffData ?? []).length === 0 ? (
                          <p className="text-center py-8 text-gray-500">Žádné záznamy.</p>
                        ) : (
                          <div className="space-y-2">
                            {(timeOffData ?? []).map((toff) => (
                              <motion.div
                                key={toff.id}
                                layout
                                initial={shouldReduce ? false : { opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 6 }}
                                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div>
                                  <span className="font-medium">{toff.date_from === toff.date_to ? toff.date_from : `${toff.date_from} → ${toff.date_to}`}</span>
                                  <span className="ml-2 text-sm text-gray-500">{TIME_OFF_TYPES[toff.type] ?? toff.type}{toff.note && ` — ${toff.note}`}</span>
                                </div>
                                <motion.button
                                  onClick={() => deleteTimeOff(toff.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                >
                                  <Trash2 size={16} />
                                </motion.button>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══════ Modal: Otevřít rezervace ═══════ */}
        <AnimatePresence>
          {openSlotsModal && (
            <motion.div
              key="open-slots-backdrop"
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setOpenSlotsModal(false); }}
            >
              <motion.div
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Otevřít rezervace — {emp?.name}</h3>
                  <motion.button
                    onClick={() => { haptics.light(); setOpenSlotsModal(false); }}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Od</label>
                    <input type="date" value={openPeriodFrom} onChange={(e) => setOpenPeriodFrom(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="label">Do</label>
                    <input type="date" value={openPeriodTo} onChange={(e) => setOpenPeriodTo(e.target.value)} className="input" />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <motion.button
                    onClick={openSlots}
                    disabled={openingSlots}
                    className="btn-primary flex-1 disabled:opacity-50"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {openingSlots ? "Otvírám…" : "Otevřít rezervace"}
                  </motion.button>
                  <motion.button
                    onClick={() => { haptics.light(); setOpenSlotsModal(false); }}
                    className="btn-secondary flex-1"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    Zrušit
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ Modal: Slot Detail (click on calendar cell) ═══════ */}
        <AnimatePresence>
          {slotDetailModal && (
            <motion.div
              key="slot-detail-backdrop"
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setSlotDetailModal(null); }}
            >
              <motion.div
                className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Detail slotu</h3>
                  <motion.button
                    onClick={() => { haptics.light(); setSlotDetailModal(null); }}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Slot info */}
                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Calendar size={15} />
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {new Date(slotDetailModal.date + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Clock size={15} />
                    <span className="font-medium text-gray-800 dark:text-gray-200">{slotDetailModal.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <User size={15} />
                    <span className="font-medium text-gray-800 dark:text-gray-200">{slotDetailModal.employee_name ?? "Terapeut"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Info size={15} className="text-gray-400" />
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      slotDetailModal.status === "open"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : slotDetailModal.status === "booked"
                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {slotDetailModal.status === "open" ? "Volný" : slotDetailModal.status === "booked" ? "Zarezervováno" : "Zrušeno"}
                    </span>
                  </div>
                </div>

                {/* Open slot: book for client or cancel slot */}
                {slotDetailModal.status === "open" && (
                  <div className="space-y-4">
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Rezervovat pro klienta</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="label">Klient</label>
                          <select
                            value={bookingClientId ?? ""}
                            onChange={(e) => setBookingClientId(e.target.value ? parseInt(e.target.value) : null)}
                            className="input"
                          >
                            <option value="">— Vyberte klienta —</option>
                            {(clientsData ?? []).map((c) => (
                              <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Poznámka</label>
                          <input type="text" value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} className="input" placeholder="Volitelná poznámka…" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <motion.button
                        onClick={bookForClient}
                        disabled={bookingInProgress || !bookingClientId}
                        className="btn-primary flex-1 disabled:opacity-50"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        {bookingInProgress ? "Rezervuji…" : "Rezervovat"}
                      </motion.button>
                      <motion.button
                        onClick={() => closeSlot(slotDetailModal.id)}
                        className="btn-secondary flex-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        <Trash2 size={14} className="inline mr-1" />
                        Zrušit slot
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Booked slot: show client info + cancel booking */}
                {slotDetailModal.status === "booked" && (
                  <div className="space-y-4">
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Klient</h4>
                      <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{slotDetailModal.client_name ?? "Neznámý klient"}</p>
                        {slotDetailModal.client_phone && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{slotDetailModal.client_phone}</p>
                        )}
                      </div>
                    </div>
                    <motion.button
                      onClick={() => cancelBooking(slotDetailModal)}
                      disabled={cancellingBooking}
                      className="w-full btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      {cancellingBooking ? "Ruším…" : "Zrušit rezervaci"}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
