"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
  Check,
  Users,
} from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const DAY_NAMES_FULL = ["Nedele", "Pondeli", "Utery", "Streda", "Ctvrtek", "Patek", "Sobota"];
const DAY_NAMES_SHORT = ["Ne", "Po", "Ut", "St", "Ct", "Pa", "So"];
const MONTH_NAMES = [
  "Leden", "Unor", "Brezen", "Duben", "Kveten", "Cerven",
  "Cervenec", "Srpen", "Zari", "Rijen", "Listopad", "Prosinec",
];

const TIME_OFF_TYPES: Record<string, string> = {
  vacation: "Dovolena",
  sick: "Nemoc",
  other: "Jiny duvod",
};

const THERAPIST_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-300", text: "text-blue-800 dark:text-blue-300", dot: "bg-blue-500" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-300", text: "text-purple-800 dark:text-purple-300", dot: "bg-purple-500" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", border: "border-teal-300", text: "text-teal-800 dark:text-teal-300", dot: "bg-teal-500" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", border: "border-rose-300", text: "text-rose-800 dark:text-rose-300", dot: "bg-rose-500" },
  { bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300", text: "text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  { bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300", text: "text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500" },
];

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

interface SuggestionItem {
  dayOfWeek: number;
  dayName: string;
  time: string;
  count: number;
  label: string;
}

// ── Wizard types ──
interface WizardScheduleRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  enabled: boolean;
}

interface WizardResult {
  employeeName: string;
  created: number;
  skipped: number;
}

// ── Helpers ──
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: string, n: number) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function getMonthEnd(year: number, month: number): string {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getCalendarDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  // Shift so Monday is 0
  const startOffset = startDow === 0 ? 6 : startDow - 1;
  const totalDays = lastDay.getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  // Pad to full weeks
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function defaultDaySchedule(): WizardScheduleRow[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    dayOfWeek: d,
    startTime: "08:00",
    endTime: "17:00",
    breakStart: "12:00",
    breakEnd: "13:00",
    enabled: d >= 1 && d <= 5,
  }));
}

export default function ReceptionSchedule() {
  const shouldReduce = useReducedMotion();
  const { toast } = useToast();
  const today = toDateStr(new Date());
  const todayDate = new Date();
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

  // ── Work Schedule (read-only tab) ──
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

  // ── Monthly Calendar ──
  const [calMonth, setCalMonth] = useState(todayDate.getMonth());
  const [calYear, setCalYear] = useState(todayDate.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const hoverRef = useRef<HTMLDivElement | null>(null);

  const monthStart = getMonthStart(calYear, calMonth);
  const monthEnd = getMonthEnd(calYear, calMonth);

  const calendarDays = useMemo(() => getCalendarDays(calYear, calMonth), [calYear, calMonth]);

  const navigateMonth = useCallback((dir: -1 | 1) => {
    haptics.light();
    setCalMonth((m) => {
      const newM = m + dir;
      if (newM < 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      if (newM > 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return newM;
    });
  }, []);

  const goToToday = useCallback(() => {
    haptics.light();
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
    setSelectedDay(toDateStr(now));
  }, []);

  // ── Slots for entire month ──
  const monthSlotsKey = useMemo(() => {
    const base = `/slots?from=${monthStart}&to=${monthEnd}`;
    if (typeof selectedEmpId === "number") {
      return `${base}&employeeId=${selectedEmpId}`;
    }
    return base;
  }, [selectedEmpId, monthStart, monthEnd]);

  const { data: monthSlotsData, mutate: mutateSlots } = useSWR<SlotRow[]>(monthSlotsKey, fetcher);
  const { data: clientsData } = useSWR<ClientUser[]>("/users?role=CLIENT", fetcher);

  // Group slots by date for calendar counts
  const slotsByDate = useMemo(() => {
    const map = new Map<string, { open: number; booked: number; slots: SlotRow[] }>();
    for (const slot of monthSlotsData ?? []) {
      if (slot.status === "cancelled") continue;
      const existing = map.get(slot.date) ?? { open: 0, booked: 0, slots: [] };
      if (slot.status === "open") {
        map.set(slot.date, { ...existing, open: existing.open + 1, slots: [...existing.slots, slot] });
      } else if (slot.status === "booked") {
        map.set(slot.date, { ...existing, booked: existing.booked + 1, slots: [...existing.slots, slot] });
      }
    }
    return map;
  }, [monthSlotsData]);

  // Group by date+employee for hover popover
  const slotsByDateEmployee = useMemo(() => {
    const map = new Map<string, Map<number, { name: string; open: number; booked: number }>>();
    for (const slot of monthSlotsData ?? []) {
      if (slot.status === "cancelled") continue;
      if (!map.has(slot.date)) {
        map.set(slot.date, new Map());
      }
      const dateMap = map.get(slot.date)!;
      const empData = dateMap.get(slot.employee_id) ?? { name: slot.employee_name ?? "Terapeut", open: 0, booked: 0 };
      if (slot.status === "open") {
        dateMap.set(slot.employee_id, { ...empData, open: empData.open + 1 });
      } else if (slot.status === "booked") {
        dateMap.set(slot.employee_id, { ...empData, booked: empData.booked + 1 });
      }
    }
    return map;
  }, [monthSlotsData]);

  // Slots for selected day (detailed list below calendar)
  const selectedDaySlots = useMemo(() => {
    const dayData = slotsByDate.get(selectedDay);
    if (!dayData) return [];
    return dayData.slots.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      return a.employee_id - b.employee_id;
    });
  }, [selectedDay, slotsByDate]);

  // ── Slot detail modal ──
  const [slotDetailModal, setSlotDetailModal] = useState<SlotRow | null>(null);
  const [bookingClientId, setBookingClientId] = useState<number | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  const closeSlot = useCallback(async (slotId: number) => {
    haptics.medium();
    try {
      await api.delete(`/slots/${slotId}`);
      haptics.success();
      toast("success", "Slot zrusen");
      setSlotDetailModal(null);
      mutateSlots();
    } catch {
      toast("error", "Chyba pri ruseni slotu");
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
      toast("error", "Chyba pri rezervaci");
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
      toast("success", "Rezervace zrusena, slot je opet volny");
      setSlotDetailModal(null);
      mutateSlots();
    } catch {
      toast("error", "Chyba pri ruseni rezervace");
    } finally {
      setCancellingBooking(false);
    }
  }, [toast, mutateSlots]);

  // ── Wizard state ──
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardSelectedEmployees, setWizardSelectedEmployees] = useState<Set<number>>(new Set());
  const [wizardSchedules, setWizardSchedules] = useState<Map<number, WizardScheduleRow[]>>(new Map());
  const [wizardFrom, setWizardFrom] = useState(today);
  const [wizardTo, setWizardTo] = useState(addDays(today, 6));
  const [wizardProcessing, setWizardProcessing] = useState(false);
  const [wizardResults, setWizardResults] = useState<WizardResult[]>([]);

  // Fetch work schedules for all selected employees when entering step 2
  const selectedEmpIds = useMemo(() => Array.from(wizardSelectedEmployees), [wizardSelectedEmployees]);

  // Fetch individual work schedules for wizard
  const wizardScheduleKeys = useMemo(() => {
    if (wizardStep !== 2) return [];
    return selectedEmpIds.map((id) => `/work-schedule/${id}`);
  }, [wizardStep, selectedEmpIds]);

  // We fetch them one-by-one using individual SWR calls won't work in a loop.
  // Instead, fetch manually when entering step 2.
  const fetchWizardSchedules = useCallback(async () => {
    const newSchedules = new Map<number, WizardScheduleRow[]>();
    for (const empId of selectedEmpIds) {
      try {
        const data = await api.get<WorkScheduleRow[]>(`/work-schedule/${empId}`);
        const rows: WizardScheduleRow[] = [0, 1, 2, 3, 4, 5, 6].map((d) => {
          const found = data.find((r) => r.day_of_week === d);
          if (found) {
            return {
              dayOfWeek: d,
              startTime: found.start_time,
              endTime: found.end_time,
              breakStart: found.break_start ?? "12:00",
              breakEnd: found.break_end ?? "13:00",
              enabled: true,
            };
          }
          return {
            dayOfWeek: d,
            startTime: "08:00",
            endTime: "17:00",
            breakStart: "12:00",
            breakEnd: "13:00",
            enabled: d >= 1 && d <= 5,
          };
        });
        newSchedules.set(empId, rows);
      } catch {
        newSchedules.set(empId, defaultDaySchedule());
      }
    }
    setWizardSchedules(newSchedules);
  }, [selectedEmpIds]);

  const openWizard = useCallback(() => {
    haptics.medium();
    setWizardStep(1);
    setWizardSelectedEmployees(new Set());
    setWizardSchedules(new Map());
    setWizardFrom(today);
    setWizardTo(addDays(today, 6));
    setWizardResults([]);
    setWizardProcessing(false);
    setWizardOpen(true);
  }, [today]);

  const toggleWizardEmployee = useCallback((id: number) => {
    haptics.light();
    setWizardSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllEmployees = useCallback(() => {
    haptics.light();
    const all = (employees ?? []).map((e) => e.id);
    setWizardSelectedEmployees((prev) => {
      if (prev.size === all.length) {
        return new Set();
      }
      return new Set(all);
    });
  }, [employees]);

  const updateWizardSchedule = useCallback(
    (empId: number, dayOfWeek: number, field: keyof WizardScheduleRow, value: string | boolean) => {
      setWizardSchedules((prev) => {
        const next = new Map(prev);
        const rows = [...(next.get(empId) ?? defaultDaySchedule())];
        const idx = rows.findIndex((r) => r.dayOfWeek === dayOfWeek);
        if (idx >= 0) {
          rows[idx] = { ...rows[idx], [field]: value };
        }
        next.set(empId, rows);
        return next;
      });
    },
    []
  );

  const wizardGoToStep = useCallback(async (step: number) => {
    haptics.light();
    if (step === 2) {
      await fetchWizardSchedules();
    }
    setWizardStep(step);
  }, [fetchWizardSchedules]);

  const executeWizard = useCallback(async () => {
    haptics.medium();
    setWizardProcessing(true);
    const results: WizardResult[] = [];

    for (const empId of selectedEmpIds) {
      const empName = (employees ?? []).find((e) => e.id === empId)?.name ?? "Terapeut";
      try {
        const result = await api.post<{ preview: number; created: number; skipped: number }>("/slots/open", {
          employeeId: empId,
          from: wizardFrom,
          to: wizardTo,
        });
        results.push({ employeeName: empName, created: result.created, skipped: result.skipped });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Chyba";
        results.push({ employeeName: empName, created: 0, skipped: 0 });
        toast("error", `${empName}: ${msg}`);
      }
    }

    setWizardResults(results);
    setWizardProcessing(false);
    setWizardStep(4);
    mutateSlots();
  }, [selectedEmpIds, wizardFrom, wizardTo, employees, toast, mutateSlots]);

  // ── Smart Auto-fill ──
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
      toast("success", `Slot ${sug.dayName} ${sug.time} otevren (${dateStr})`);
      mutateSlots();
    } catch {
      toast("error", "Nepodarilo se otevrit slot");
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
      toast("success", "Nepritomnost zadana");
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
      toast("success", "Smazano");
      mutateTimeOff();
    } catch {
      toast("error", "Chyba");
    }
  }, [toast, mutateTimeOff]);

  const TAB_LABELS: Record<string, React.ReactNode> = {
    slots: "Rezervace",
    schedule: "Pracovni doba",
    timeoff: "Nepritomnost",
    autofill: <><Sparkles size={14} className="text-amber-500 inline mr-1" />Chytre doplneni</>,
  };

  const needsSpecificEmployee = activeTab === "schedule" || activeTab === "timeoff" || activeTab === "autofill";

  // ── Wizard step labels ──
  const WIZARD_STEPS = [
    { num: 1, label: "Terapeut" },
    { num: 2, label: "Pracovni doba" },
    { num: 3, label: "Obdobi" },
    { num: 4, label: "Vysledek" },
  ];

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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sprava rezervaci -- Recepce</h1>
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
              <option value="all">Vsichni</option>
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
                <p>Pro tuto zalozku vyberte konkretniho terapeuta.</p>
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
                  {/* ======= Tab: Rezervace (Monthly Calendar View) ======= */}
                  {activeTab === "slots" && (
                    <motion.div
                      key="tab-slots"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      {/* Month navigation + Open button */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            aria-label="Predchozi mesic"
                          >
                            <ChevronLeft size={18} />
                          </motion.button>
                          <motion.button
                            onClick={goToToday}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                            whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            Dnes
                          </motion.button>
                          <motion.button
                            onClick={() => navigateMonth(1)}
                            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            aria-label="Dalsi mesic"
                          >
                            <ChevronRight size={18} />
                          </motion.button>
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 ml-1">
                            {MONTH_NAMES[calMonth]} {calYear}
                          </span>
                        </div>
                        <motion.button
                          onClick={openWizard}
                          className="btn-primary flex items-center gap-2"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          <Plus size={16} /> Otevrit rezervace
                        </motion.button>
                      </div>

                      {/* Therapist color legend */}
                      {(employees ?? []).length > 1 && selectedEmpId === "all" && (
                        <motion.div
                          initial={shouldReduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className="flex flex-wrap items-center gap-3 px-1"
                        >
                          {(employees ?? []).map((t) => {
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

                      {/* Monthly Calendar Grid */}
                      <div className="card p-0 overflow-hidden">
                        {/* Day-of-week header */}
                        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                          {["Po", "Ut", "St", "Ct", "Pa", "So", "Ne"].map((d) => (
                            <div
                              key={d}
                              className="p-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              {d}
                            </div>
                          ))}
                        </div>

                        {/* Calendar cells */}
                        <div className="grid grid-cols-7">
                          {calendarDays.map((dateStr, idx) => {
                            if (dateStr === null) {
                              return (
                                <div
                                  key={`empty-${idx}`}
                                  className="min-h-[60px] sm:min-h-[80px] border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30"
                                />
                              );
                            }

                            const dayData = slotsByDate.get(dateStr);
                            const openCount = dayData?.open ?? 0;
                            const bookedCount = dayData?.booked ?? 0;
                            const totalSlots = openCount + bookedCount;
                            const hasSlots = totalSlots > 0;
                            const allBooked = hasSlots && openCount === 0;
                            const isToday = dateStr === today;
                            const isSelected = dateStr === selectedDay;
                            const isHovered = dateStr === hoveredDay;
                            const dayNum = new Date(dateStr + "T12:00:00").getDate();

                            return (
                              <div
                                key={dateStr}
                                className={`relative min-h-[60px] sm:min-h-[80px] border-b border-r border-gray-100 dark:border-gray-800 p-1 sm:p-1.5 cursor-pointer transition-colors select-none
                                  ${!hasSlots ? "bg-gray-50/80 dark:bg-gray-900/40" : "bg-white dark:bg-gray-900"}
                                  ${allBooked ? "ring-1 ring-inset ring-red-200 dark:ring-red-800/50" : ""}
                                  ${isSelected ? "bg-primary-50/80 dark:bg-primary-900/20 ring-2 ring-primary-400 ring-inset" : ""}
                                  ${isHovered && !isSelected ? "bg-gray-100 dark:bg-gray-800/60" : ""}
                                  hover:bg-gray-100 dark:hover:bg-gray-800/60
                                `}
                                onClick={() => {
                                  haptics.light();
                                  setSelectedDay(dateStr);
                                }}
                                onMouseEnter={() => setHoveredDay(dateStr)}
                                onMouseLeave={() => setHoveredDay(null)}
                              >
                                {/* Day number */}
                                <div className={`text-right text-sm font-medium leading-none mb-1
                                  ${isToday
                                    ? "flex justify-end"
                                    : !hasSlots
                                      ? "text-gray-400 dark:text-gray-600"
                                      : "text-gray-700 dark:text-gray-300"
                                  }
                                `}>
                                  {isToday ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold">
                                      {dayNum}
                                    </span>
                                  ) : (
                                    dayNum
                                  )}
                                </div>

                                {/* Slot counts */}
                                {hasSlots && (
                                  <div className="text-center mt-0.5 sm:mt-1">
                                    <span className="text-xs sm:text-sm font-semibold">
                                      <span className="text-green-600 dark:text-green-400">{openCount}</span>
                                      <span className="text-gray-400 dark:text-gray-500">/</span>
                                      <span className="text-orange-600 dark:text-orange-400">{bookedCount}</span>
                                    </span>
                                    <div className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
                                      volne/rez.
                                    </div>
                                  </div>
                                )}

                                {/* Hover popover with therapist details */}
                                <AnimatePresence>
                                  {isHovered && hasSlots && !isSelected && (
                                    <motion.div
                                      ref={hoverRef}
                                      initial={shouldReduce ? false : { opacity: 0, y: 4, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 28 }}
                                      className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2.5 min-w-[180px] pointer-events-none"
                                    >
                                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                        {new Date(dateStr + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
                                      </div>
                                      {(() => {
                                        const dateEmpMap = slotsByDateEmployee.get(dateStr);
                                        if (!dateEmpMap) return null;
                                        return Array.from(dateEmpMap.entries()).map(([empId, data]) => {
                                          const color = therapistColorMap.get(empId);
                                          return (
                                            <div key={empId} className="flex items-center gap-2 text-xs py-0.5">
                                              <span className={`w-2 h-2 rounded-full shrink-0 ${color?.dot ?? "bg-gray-400"}`} />
                                              <span className="text-gray-700 dark:text-gray-300 truncate">{data.name}:</span>
                                              <span className="font-medium ml-auto">
                                                <span className="text-green-600 dark:text-green-400">{data.open}</span>
                                                <span className="text-gray-400">/</span>
                                                <span className="text-orange-600 dark:text-orange-400">{data.booked}</span>
                                              </span>
                                            </div>
                                          );
                                        });
                                      })()}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Selected day detail */}
                      <motion.div
                        key={`day-detail-${selectedDay}`}
                        initial={shouldReduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="card"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {new Date(selectedDay + "T12:00:00").toLocaleDateString("cs-CZ", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </h2>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span className="text-green-600 dark:text-green-400 font-medium">{slotsByDate.get(selectedDay)?.open ?? 0} volnych</span>
                            <span>/</span>
                            <span className="text-orange-600 dark:text-orange-400 font-medium">{slotsByDate.get(selectedDay)?.booked ?? 0} rez.</span>
                          </div>
                        </div>

                        {selectedDaySlots.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                            <Calendar size={32} className="mx-auto mb-2 opacity-40" />
                            <p>Zadne sloty pro tento den.</p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedDaySlots.map((slot) => {
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
                                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${color.bg} ${color.border} hover:opacity-90`}
                                  whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                >
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} />
                                  <span className={`font-mono text-sm font-medium ${color.text}`}>{slot.time}</span>
                                  <span className={`text-sm font-medium ${color.text} truncate`}>
                                    {slot.employee_name ?? "Terapeut"}
                                  </span>
                                  <span className="ml-auto flex items-center gap-2">
                                    {isBooked ? (
                                      <>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 font-medium">
                                          {slot.client_name ?? "Rezervovano"}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">
                                        Volny
                                      </span>
                                    )}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  )}

                  {/* ======= Tab: Pracovni doba (READ ONLY) ======= */}
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
                          Pracovni doba -- {emp?.name ?? ""}
                        </h2>
                        <span className="text-xs text-gray-400 dark:text-gray-500">(pouze pro cteni)</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Den</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600 dark:text-gray-400">Zacatek</th>
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
                                      {row.breakStart} -- {row.breakEnd}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-2.5 px-3 text-gray-400">--</td>
                                    <td className="py-2.5 px-3 text-gray-400">--</td>
                                    <td className="py-2.5 px-3 text-gray-400">--</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {/* ======= Tab: Chytre doplneni ======= */}
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
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chytre doplneni rozvrhu</h2>
                            <p className="text-sm text-gray-500 mt-1">
                              Analyza historicke poptavky -- navrhne rezervace, ktere klienti nejcasteji vyuzivaji
                              a zatim nejsou otevreny v pristich dvou tydnech.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600 dark:text-gray-400">Analyzovat poslednich</label>
                            <select
                              value={autofillWeeks}
                              onChange={(e) => setAutofillWeeks(parseInt(e.target.value))}
                              className="input-sm"
                            >
                              <option value={4}>4 tydny</option>
                              <option value={8}>8 tydnu</option>
                              <option value={12}>12 tydnu</option>
                              <option value={24}>24 tydnu</option>
                            </select>
                          </div>
                          <motion.button
                            onClick={() => { haptics.medium(); setAcceptedSlots(new Set()); setAutofillKey((k) => k + 1); }}
                            className="btn-primary flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <Sparkles size={16} /> Analyzovat poptavku
                          </motion.button>
                        </div>
                      </div>

                      {autofillLoading && (
                        <div className="card text-center py-10 text-gray-500">
                          <div className="animate-spin w-8 h-8 border-4 border-primary-300 border-t-primary-600 rounded-full mx-auto mb-3" />
                          Analyzuji historii rezervaci...
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
                          <p className="font-medium text-gray-700 dark:text-gray-300">Rozvrh je optimalne doplnen</p>
                          <p className="text-sm mt-1">Vsechny oblibene rezervace jsou v pristich 2 tydnech otevreny.</p>
                        </motion.div>
                      )}

                      {!autofillLoading && autofillData && autofillData.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500 px-1">
                            Nalezeno <strong>{autofillData.suggestions.length}</strong> rezervaci s vysokou poptavkou,
                            ktere jeste nejsou otevreny v pristich 2 tydnech:
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
                                      {sug.count}x rezervovano za poslednich {autofillData.lookbackWeeks} tydnu
                                    </p>
                                  </div>
                                </div>
                                {accepted ? (
                                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                    <CheckCircle size={16} /> Otevreno
                                  </span>
                                ) : (
                                  <motion.button
                                    onClick={() => acceptSuggestion(sug)}
                                    disabled={acceptingSlot === key}
                                    className="btn-primary text-sm py-1.5 px-3 shrink-0 disabled:opacity-50"
                                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                  >
                                    {acceptingSlot === key ? "Otviram..." : "Otevrit slot"}
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
                          <p>Kliknete na &ldquo;Analyzovat poptavku&rdquo; pro zobrazeni navrhu.</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* ======= Tab: Nepritomnost ======= */}
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
                        <h2 className="text-lg font-semibold mb-4">Zadat nepritomnost -- {emp?.name}</h2>
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
                              <option value="vacation">Dovolena</option>
                              <option value="sick">Nemocenska</option>
                              <option value="other">Jiny duvod</option>
                            </select>
                          </div>
                          <div>
                            <label className="label">Poznamka</label>
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
                            {savingTimeOff ? "Ukladam..." : "Zadat"}
                          </motion.button>
                        </div>
                      </div>

                      <div className="card">
                        <h2 className="text-lg font-semibold mb-4">Planovane nepritomnosti</h2>
                        {(timeOffData ?? []).length === 0 ? (
                          <p className="text-center py-8 text-gray-500">Zadne zaznamy.</p>
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
                                  <span className="font-medium">{toff.date_from === toff.date_to ? toff.date_from : `${toff.date_from} -> ${toff.date_to}`}</span>
                                  <span className="ml-2 text-sm text-gray-500">{TIME_OFF_TYPES[toff.type] ?? toff.type}{toff.note && ` -- ${toff.note}`}</span>
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

        {/* ======= Modal: Slot Detail (click on reservation in day list) ======= */}
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
                      {slotDetailModal.status === "open" ? "Volny" : slotDetailModal.status === "booked" ? "Rezervovano" : "Zruseno"}
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
                            <option value="">-- Vyberte klienta --</option>
                            {(clientsData ?? []).map((c) => (
                              <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label">Poznamka</label>
                          <input type="text" value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} className="input" placeholder="Volitelna poznamka..." />
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
                        {bookingInProgress ? "Rezervuji..." : "Rezervovat"}
                      </motion.button>
                      <motion.button
                        onClick={() => closeSlot(slotDetailModal.id)}
                        className="btn-secondary flex-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      >
                        <Trash2 size={14} className="inline mr-1" />
                        Zrusit slot
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
                        <p className="font-medium text-gray-800 dark:text-gray-200">{slotDetailModal.client_name ?? "Neznamy klient"}</p>
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
                      {cancellingBooking ? "Rusim..." : "Zrusit rezervaci"}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======= Full-screen Wizard: Otevrit rezervace ======= */}
        <AnimatePresence>
          {wizardOpen && (
            <motion.div
              key="wizard-backdrop"
              className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="bg-white dark:bg-gray-900 w-full min-h-screen sm:min-h-0 sm:max-w-2xl sm:my-8 sm:rounded-2xl sm:shadow-2xl"
                initial={shouldReduce ? false : { opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Wizard header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 sm:rounded-t-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Otevrit rezervace</h2>
                    <motion.button
                      onClick={() => { haptics.light(); setWizardOpen(false); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                      whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    >
                      <X size={20} />
                    </motion.button>
                  </div>

                  {/* Step indicators */}
                  <div className="flex items-center gap-2">
                    {WIZARD_STEPS.map((step, i) => {
                      const isActive = wizardStep === step.num;
                      const isComplete = wizardStep > step.num;
                      return (
                        <div key={step.num} className="flex items-center gap-2 flex-1">
                          <div className={`flex items-center gap-1.5 flex-1 ${i > 0 ? "" : ""}`}>
                            {i > 0 && (
                              <div className={`h-0.5 flex-1 rounded-full transition-colors ${
                                isComplete || isActive ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"
                              }`} />
                            )}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              isActive
                                ? "bg-primary-600 text-white"
                                : isComplete
                                  ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                            }`}>
                              {isComplete ? <Check size={14} /> : step.num}
                            </div>
                          </div>
                          <span className={`text-xs font-medium hidden sm:inline ${
                            isActive ? "text-primary-600" : isComplete ? "text-primary-500" : "text-gray-400"
                          }`}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Wizard body */}
                <div className="px-6 py-6">
                  <AnimatePresence mode="wait">
                    {/* Step 1: Vyberte terapeuta */}
                    {wizardStep === 1 && (
                      <motion.div
                        key="wizard-step-1"
                        initial={shouldReduce ? false : { opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Vyberte terapeuta</h3>
                        <p className="text-sm text-gray-500 mb-4">Zvolte jednoho nebo vice terapeutu, pro ktere chcete otevrit rezervace.</p>

                        {/* Select all */}
                        <motion.button
                          onClick={selectAllEmployees}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border mb-3 transition-colors ${
                            wizardSelectedEmployees.size === (employees ?? []).length
                              ? "bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          }`}
                          whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            wizardSelectedEmployees.size === (employees ?? []).length
                              ? "bg-primary-600 border-primary-600"
                              : "border-gray-300 dark:border-gray-600"
                          }`}>
                            {wizardSelectedEmployees.size === (employees ?? []).length && <Check size={14} className="text-white" />}
                          </div>
                          <Users size={18} className="text-gray-500" />
                          <span className="font-medium text-gray-800 dark:text-gray-200">Vsichni terapeuti</span>
                          <span className="ml-auto text-xs text-gray-400">({(employees ?? []).length})</span>
                        </motion.button>

                        <div className="space-y-2">
                          {(employees ?? []).map((empItem) => {
                            const color = therapistColorMap.get(empItem.id);
                            const isSelected = wizardSelectedEmployees.has(empItem.id);
                            return (
                              <motion.button
                                key={empItem.id}
                                onClick={() => toggleWizardEmployee(empItem.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
                                  isSelected
                                    ? "bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700"
                                    : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                }`}
                                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              >
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? "bg-primary-600 border-primary-600"
                                    : "border-gray-300 dark:border-gray-600"
                                }`}>
                                  {isSelected && <Check size={14} className="text-white" />}
                                </div>
                                <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-gray-400"}`} />
                                <span className="font-medium text-gray-800 dark:text-gray-200">{empItem.name}</span>
                              </motion.button>
                            );
                          })}
                        </div>

                        <div className="mt-6 flex justify-end">
                          <motion.button
                            onClick={() => wizardGoToStep(2)}
                            disabled={wizardSelectedEmployees.size === 0}
                            className="btn-primary flex items-center gap-2 disabled:opacity-50"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            Dalsi <ChevronRight size={16} />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Pracovni doba */}
                    {wizardStep === 2 && (
                      <motion.div
                        key="wizard-step-2"
                        initial={shouldReduce ? false : { opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Pracovni doba</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          Zkontrolujte a upravte pracovni dobu pro vybrane terapeuty. Sloty se otevrou pouze v povolene dny a hodiny.
                        </p>

                        <div className="space-y-6">
                          {selectedEmpIds.map((empId) => {
                            const empItem = (employees ?? []).find((e) => e.id === empId);
                            const color = therapistColorMap.get(empId);
                            const schedule = wizardSchedules.get(empId) ?? defaultDaySchedule();

                            return (
                              <div key={empId} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                  <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-gray-400"}`} />
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{empItem?.name ?? "Terapeut"}</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-gray-100 dark:border-gray-800">
                                        <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs w-8"></th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Den</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Zacatek</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Konec</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Pauza od</th>
                                        <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs">Pauza do</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {schedule.map((row) => (
                                        <tr key={row.dayOfWeek} className={`border-b border-gray-50 dark:border-gray-800/50 ${row.enabled ? "" : "opacity-40"}`}>
                                          <td className="py-1.5 px-3">
                                            <input
                                              type="checkbox"
                                              checked={row.enabled}
                                              onChange={(e) => updateWizardSchedule(empId, row.dayOfWeek, "enabled", e.target.checked)}
                                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                          </td>
                                          <td className="py-1.5 px-3 font-medium text-gray-700 dark:text-gray-300 text-xs">
                                            {DAY_NAMES_FULL[row.dayOfWeek]}
                                          </td>
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="time"
                                              value={row.startTime}
                                              onChange={(e) => updateWizardSchedule(empId, row.dayOfWeek, "startTime", e.target.value)}
                                              disabled={!row.enabled}
                                              className="input text-xs py-1 px-1.5 w-[90px]"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="time"
                                              value={row.endTime}
                                              onChange={(e) => updateWizardSchedule(empId, row.dayOfWeek, "endTime", e.target.value)}
                                              disabled={!row.enabled}
                                              className="input text-xs py-1 px-1.5 w-[90px]"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="time"
                                              value={row.breakStart}
                                              onChange={(e) => updateWizardSchedule(empId, row.dayOfWeek, "breakStart", e.target.value)}
                                              disabled={!row.enabled}
                                              className="input text-xs py-1 px-1.5 w-[90px]"
                                            />
                                          </td>
                                          <td className="py-1.5 px-2">
                                            <input
                                              type="time"
                                              value={row.breakEnd}
                                              onChange={(e) => updateWizardSchedule(empId, row.dayOfWeek, "breakEnd", e.target.value)}
                                              disabled={!row.enabled}
                                              className="input text-xs py-1 px-1.5 w-[90px]"
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-6 flex justify-between">
                          <motion.button
                            onClick={() => wizardGoToStep(1)}
                            className="btn-secondary flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <ChevronLeft size={16} /> Zpet
                          </motion.button>
                          <motion.button
                            onClick={() => wizardGoToStep(3)}
                            className="btn-primary flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            Dalsi <ChevronRight size={16} />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Obdobi */}
                    {wizardStep === 3 && (
                      <motion.div
                        key="wizard-step-3"
                        initial={shouldReduce ? false : { opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      >
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Obdobi</h3>
                        <p className="text-sm text-gray-500 mb-4">Zvolte datovy rozsah, ve kterem se maji otevrit sloty.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                          <div>
                            <label className="label">Od</label>
                            <input
                              type="date"
                              value={wizardFrom}
                              onChange={(e) => setWizardFrom(e.target.value)}
                              className="input"
                            />
                          </div>
                          <div>
                            <label className="label">Do</label>
                            <input
                              type="date"
                              value={wizardTo}
                              onChange={(e) => setWizardTo(e.target.value)}
                              className="input"
                            />
                          </div>
                        </div>

                        {/* Summary preview */}
                        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Souhrn</h4>
                          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <Users size={15} className="text-gray-400" />
                              <span>
                                <strong>{wizardSelectedEmployees.size}</strong> {wizardSelectedEmployees.size === 1 ? "terapeut" : wizardSelectedEmployees.size < 5 ? "terapeuti" : "terapeutu"}:
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-6">
                              {selectedEmpIds.map((empId) => {
                                const empItem = (employees ?? []).find((e) => e.id === empId);
                                const color = therapistColorMap.get(empId);
                                return (
                                  <span key={empId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs">
                                    <span className={`w-2 h-2 rounded-full ${color?.dot ?? "bg-gray-400"}`} />
                                    {empItem?.name}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={15} className="text-gray-400" />
                              <span>
                                {new Date(wizardFrom + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
                                {" "}--{" "}
                                {new Date(wizardTo + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex justify-between">
                          <motion.button
                            onClick={() => wizardGoToStep(2)}
                            className="btn-secondary flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <ChevronLeft size={16} /> Zpet
                          </motion.button>
                          <motion.button
                            onClick={executeWizard}
                            disabled={wizardProcessing}
                            className="btn-primary flex items-center gap-2 disabled:opacity-50"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            {wizardProcessing ? (
                              <>
                                <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                Otviram...
                              </>
                            ) : (
                              "Otevrit rezervace"
                            )}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4: Vysledek */}
                    {wizardStep === 4 && (
                      <motion.div
                        key="wizard-step-4"
                        initial={shouldReduce ? false : { opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      >
                        <div className="text-center mb-6">
                          <motion.div
                            initial={shouldReduce ? false : { scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                          >
                            <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
                          </motion.div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Rezervace otevreny</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Obdobi: {new Date(wizardFrom + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long" })}
                            {" "}--{" "}
                            {new Date(wizardTo + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {wizardResults.map((result, i) => {
                            const empItem = (employees ?? []).find((e) => e.name === result.employeeName);
                            const color = empItem ? therapistColorMap.get(empItem.id) : undefined;
                            return (
                              <motion.div
                                key={i}
                                initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 26, delay: i * 0.06 }}
                                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-gray-400"}`} />
                                  <span className="font-medium text-gray-800 dark:text-gray-200">{result.employeeName}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    +{result.created} vytvoreno
                                  </span>
                                  {result.skipped > 0 && (
                                    <span className="text-gray-400">{result.skipped} preskoceno</span>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>

                        <div className="mt-6 flex justify-center">
                          <motion.button
                            onClick={() => {
                              haptics.success();
                              setWizardOpen(false);
                              mutateSlots();
                            }}
                            className="btn-primary flex items-center gap-2 px-8"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <CheckCircle size={16} /> Hotovo
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
