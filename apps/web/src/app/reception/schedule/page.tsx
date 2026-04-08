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
  Check,
  Users,
  Pencil,
  Search,
  Download,
  Phone,
  Layers,
} from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const DAY_NAMES_FULL = ["Nedele", "Pondeli", "Utery", "Streda", "Ctvrtek", "Patek", "Sobota"];
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

interface IntensivePlanRow {
  id: number;
  title: string;
  client_id: number | null;
  client_name: string | null;
  notes: string | null;
  segments: Array<{
    id: number;
    employee_id: number;
    employee_name: string;
    service_id: number | null;
    service_name: string | null;
    date: string;
    start_time: string;
    end_time: string;
  }>;
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
  const [activeTab, setActiveTab] = useState<"schedule" | "slots" | "timeoff" | "autofill" | "intensive">("slots");
  const [selectedEmpId, setSelectedEmpId] = useState<number | "all">("all");

  // ── Filters ──
  const [slotFilter, setSlotFilter] = useState<"all" | "open" | "booked">("all");
  const [clientSearch, setClientSearch] = useState("");

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
  const { data: servicesData } = useSWR<Array<{ id: number; name: string }>>("/services", fetcher);

  const intensiveSegKey = useMemo(() => {
    const base = `/intensive-therapy/segments?from=${monthStart}&to=${monthEnd}`;
    if (typeof selectedEmpId === "number") return `${base}&employeeId=${selectedEmpId}`;
    return base;
  }, [monthStart, monthEnd, selectedEmpId]);

  const { data: intensiveSegData, mutate: mutateIntensiveSeg } = useSWR<{
    segments: Array<{ id: number; date: string }>;
  }>(intensiveSegKey, fetcher);

  const intensiveCountByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of intensiveSegData?.segments ?? []) {
      m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [intensiveSegData]);

  const intensivePlansKey = `/intensive-therapy/plans?from=${monthStart}&to=${monthEnd}`;
  const { data: intensivePlansData, mutate: mutateIntensivePlans } = useSWR<{ plans: IntensivePlanRow[] }>(
    intensivePlansKey,
    fetcher
  );

  const [itTitle, setItTitle] = useState("");
  const [itClientId, setItClientId] = useState("");
  const [itNotes, setItNotes] = useState("");
  const [itRows, setItRows] = useState<
    Array<{ employeeId: number; date: string; startTime: string; endTime: string; serviceId: string }>
  >([]);
  const [itSaving, setItSaving] = useState(false);

  const addIntensiveRow = useCallback(() => {
    const empId = employees?.[0]?.id ?? 0;
    setItRows((r) => [
      ...r,
      { employeeId: empId, date: selectedDay, startTime: "09:00", endTime: "10:00", serviceId: "" },
    ]);
  }, [employees, selectedDay]);

  const saveIntensivePlan = useCallback(async () => {
    if (!itTitle.trim()) {
      toast("error", "Vyplnte nazev planu");
      return;
    }
    if (itRows.length === 0) {
      toast("error", "Pridejte alespon jeden segment");
      return;
    }
    haptics.medium();
    setItSaving(true);
    try {
      await api.post("/intensive-therapy/plans", {
        title: itTitle.trim(),
        clientId: itClientId ? parseInt(itClientId, 10) : null,
        notes: itNotes.trim() || undefined,
        segments: itRows.map((row) => ({
          employeeId: row.employeeId,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          serviceId: row.serviceId ? parseInt(row.serviceId, 10) : null,
        })),
      });
      haptics.success();
      toast("success", "Intenzivni plan ulozen");
      setItTitle("");
      setItClientId("");
      setItNotes("");
      setItRows([]);
      mutateIntensivePlans();
      mutateIntensiveSeg();
      mutateSlots();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Chyba";
      toast("error", msg);
    } finally {
      setItSaving(false);
    }
  }, [itTitle, itClientId, itNotes, itRows, toast, mutateIntensivePlans, mutateIntensiveSeg, mutateSlots]);

  const cancelIntensivePlan = useCallback(
    async (planId: number) => {
      haptics.medium();
      try {
        await api.delete(`/intensive-therapy/plans/${planId}`);
        haptics.success();
        toast("success", "Plan zrusen");
        mutateIntensivePlans();
        mutateIntensiveSeg();
        mutateSlots();
      } catch {
        toast("error", "Nepodarilo se zrusit plan");
      }
    },
    [toast, mutateIntensivePlans, mutateIntensiveSeg, mutateSlots]
  );

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

  // Slots for selected day with filters applied
  const selectedDaySlots = useMemo(() => {
    const dayData = slotsByDate.get(selectedDay);
    if (!dayData) return [];
    let slots = dayData.slots;

    // Filter by slot status
    if (slotFilter === "open") {
      slots = slots.filter((s) => s.status === "open");
    } else if (slotFilter === "booked") {
      slots = slots.filter((s) => s.status === "booked");
    }

    // Filter by client search
    if (clientSearch.trim()) {
      const q = clientSearch.trim().toLowerCase();
      slots = slots.filter((s) => {
        if (s.status === "open") return true; // open slots always visible
        const nameMatch = s.client_name?.toLowerCase().includes(q);
        const phoneMatch = s.client_phone?.includes(q);
        return nameMatch || phoneMatch;
      });
    }

    return slots.sort((a, b) => {
      if (a.time < b.time) return -1;
      if (a.time > b.time) return 1;
      return a.employee_id - b.employee_id;
    });
  }, [selectedDay, slotsByDate, slotFilter, clientSearch]);

  // ── Booking modal (for open slots) ──
  const [bookingModal, setBookingModal] = useState<SlotRow | null>(null);
  const [bookingClientId, setBookingClientId] = useState<number | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // ── Edit modal (for booked slots) ──
  const [editModal, setEditModal] = useState<SlotRow | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // ── Storno fee dialog ──
  const [stornoFeeModal, setStornoFeeModal] = useState<SlotRow | null>(null);
  const [stornoFee, setStornoFee] = useState("");
  const [stornoDescription, setStornoDescription] = useState("");
  const [stornoInProgress, setStornoInProgress] = useState(false);

  const closeSlot = useCallback(async (slotId: number) => {
    haptics.medium();
    try {
      await api.delete(`/slots/${slotId}`);
      haptics.success();
      toast("success", "Slot zrusen");
      setBookingModal(null);
      mutateSlots();
    } catch {
      toast("error", "Chyba pri ruseni slotu");
    }
  }, [toast, mutateSlots]);

  const bookForClient = useCallback(async () => {
    if (!bookingModal || !bookingClientId) return;
    haptics.medium();
    setBookingInProgress(true);
    try {
      await api.post("/bookings-v2", {
        slotId: bookingModal.id,
        clientId: bookingClientId,
        note: bookingNote || undefined,
      });
      haptics.success();
      toast("success", "Rezervace vytvorena");
      setBookingModal(null);
      setBookingClientId(null);
      setBookingNote("");
      mutateSlots();
    } catch {
      toast("error", "Chyba pri rezervaci");
    } finally {
      setBookingInProgress(false);
    }
  }, [bookingModal, bookingClientId, bookingNote, toast, mutateSlots]);

  // Storno zdarma
  const cancelBookingFree = useCallback(async (slot: SlotRow) => {
    if (!slot.b_id) return;
    haptics.medium();
    setCancellingBooking(true);
    try {
      await api.delete(`/bookings-v2/${slot.b_id}`);
      haptics.success();
      toast("success", "Rezervace zrusena, slot je opet volny");
      setEditModal(null);
      mutateSlots();
    } catch {
      toast("error", "Chyba pri ruseni rezervace");
    } finally {
      setCancellingBooking(false);
    }
  }, [toast, mutateSlots]);

  // Storno s poplatkem
  const cancelBookingWithFee = useCallback(async () => {
    if (!stornoFeeModal?.b_id) return;
    const fee = parseFloat(stornoFee);
    if (!fee || fee <= 0) {
      toast("error", "Zadejte platny poplatek");
      return;
    }
    haptics.medium();
    setStornoInProgress(true);
    try {
      const result = await api.post<{ invoiceNumber: string; fee: number }>(`/bookings-v2/${stornoFeeModal.b_id}/cancel-with-fee`, {
        fee,
        description: stornoDescription || undefined,
      });
      haptics.success();
      toast("success", `Storno s poplatkem ${fee} Kc -- faktura ${result.invoiceNumber}`);
      setStornoFeeModal(null);
      setEditModal(null);
      setStornoFee("");
      setStornoDescription("");
      mutateSlots();
    } catch {
      toast("error", "Chyba pri stornu s poplatkem");
    } finally {
      setStornoInProgress(false);
    }
  }, [stornoFeeModal, stornoFee, stornoDescription, toast, mutateSlots]);

  // ── CSV Export ──
  const exportCSV = useCallback(() => {
    haptics.medium();
    const dayData = slotsByDate.get(selectedDay);
    if (!dayData || dayData.slots.length === 0) {
      toast("error", "Zadna data k exportu");
      return;
    }

    // Export all slots (filtered) for entire month
    const allSlots = monthSlotsData ?? [];
    let exportSlots = allSlots.filter((s) => s.status !== "cancelled");

    if (slotFilter === "open") exportSlots = exportSlots.filter((s) => s.status === "open");
    if (slotFilter === "booked") exportSlots = exportSlots.filter((s) => s.status === "booked");
    if (clientSearch.trim()) {
      const q = clientSearch.trim().toLowerCase();
      exportSlots = exportSlots.filter((s) => {
        if (s.status === "open") return true;
        return s.client_name?.toLowerCase().includes(q) || s.client_phone?.includes(q);
      });
    }

    const rows = [
      ["Datum", "Cas", "Terapeut", "Stav", "Klient", "Telefon"].join(";"),
      ...exportSlots.map((s) =>
        [
          s.date,
          s.time,
          s.employee_name ?? "",
          s.status === "open" ? "Volny" : "Obsazeny",
          s.client_name ?? "",
          s.client_phone ?? "",
        ].join(";")
      ),
    ];

    const bom = "\uFEFF";
    const blob = new Blob([bom + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `harmonogram_${MONTH_NAMES[calMonth]}_${calYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", `Export ${exportSlots.length} zaznamu`);
  }, [monthSlotsData, slotsByDate, selectedDay, slotFilter, clientSearch, calMonth, calYear, toast]);

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
    mutateIntensivePlans();
    mutateIntensiveSeg();
  }, [selectedEmpIds, wizardFrom, wizardTo, employees, toast, mutateSlots, mutateIntensivePlans, mutateIntensiveSeg]);

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
    slots: "Harmonogram",
    intensive: <><Layers size={14} className="text-primary-400 inline mr-1" />Intenzivni</>,
    schedule: "Pracovni doba",
    timeoff: "Nepritomnost",
    autofill: <><Sparkles size={14} className="text-secondary inline mr-1" />Chytre doplneni</>,
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
        <div className="max-w-6xl mx-auto px-4 py-6 bg-surface min-h-screen">
          <motion.div
            className="flex items-center gap-3 mb-8"
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="text-primary" size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface tracking-tight">Therapist Schedule</h1>
              <p className="text-sm text-on-surface-variant">Harmonogram terapeutu</p>
            </div>
          </motion.div>

          {/* Therapist selector */}
          <motion.div
            className="card mb-5"
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

          {/* Day/Week style toggle tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-surface-container-high dark:bg-gray-800 mb-6 overflow-x-auto">
            {(["slots", "intensive", "schedule", "timeoff", "autofill"] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => { haptics.light(); setActiveTab(tab); }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1 whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-white dark:bg-gray-700 text-primary shadow-sm ring-1 ring-outline-variant/30"
                    : "text-on-surface-variant hover:text-on-surface"
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
                className="card text-center py-16 text-on-surface-variant"
              >
                <User size={48} className="mx-auto mb-4 text-outline-variant opacity-40" />
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
                  {/* ======= Tab: Harmonogram (Monthly Calendar + Slot List) ======= */}
                  {activeTab === "slots" && (
                    <motion.div
                      key="tab-slots"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      {/* Month navigation + Open button + Export */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant transition-colors"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            aria-label="Predchozi mesic"
                          >
                            <ChevronLeft size={18} />
                          </motion.button>
                          <motion.button
                            onClick={goToToday}
                            className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-sm font-medium text-on-surface transition-colors"
                            whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            Dnes
                          </motion.button>
                          <motion.button
                            onClick={() => navigateMonth(1)}
                            className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant transition-colors"
                            whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            aria-label="Dalsi mesic"
                          >
                            <ChevronRight size={18} />
                          </motion.button>
                          <span className="text-base font-semibold text-on-surface ml-1">
                            {MONTH_NAMES[calMonth]} {calYear}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={exportCSV}
                            className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <Download size={14} /> CSV
                          </motion.button>
                          <motion.button
                            onClick={openWizard}
                            className="btn-accent flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <Plus size={16} /> Otevrit terminy
                          </motion.button>
                        </div>
                      </div>

                      {/* Therapist color legend */}
                      {(employees ?? []).length > 1 && selectedEmpId === "all" && (
                        <motion.div
                          initial={shouldReduce ? false : { opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className="flex flex-wrap items-center gap-3 px-2 py-2 rounded-xl bg-surface-container-low"
                        >
                          {(employees ?? []).map((t) => {
                            const color = therapistColorMap.get(t.id);
                            return (
                              <div key={t.id} className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                                <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-outline-variant"}`} />
                                <span>{t.name}</span>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}

                      {/* Monthly Calendar Grid */}
                      <div className="card p-0 overflow-hidden rounded-2xl">
                        {/* Day-of-week header */}
                        <div className="grid grid-cols-7 bg-surface-container-low dark:bg-gray-800/50">
                          {["Po", "Ut", "St", "Ct", "Pa", "So", "Ne"].map((d) => (
                            <div
                              key={d}
                              className="p-2.5 text-center text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
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
                                  className="min-h-[60px] sm:min-h-[80px] bg-surface-container-high/30 dark:bg-gray-900/30"
                                />
                              );
                            }

                            const dayData = slotsByDate.get(dateStr);
                            const openCount = dayData?.open ?? 0;
                            const bookedCount = dayData?.booked ?? 0;
                            const intensiveCount = intensiveCountByDate.get(dateStr) ?? 0;
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
                                className={`relative min-h-[60px] sm:min-h-[80px] p-1 sm:p-1.5 cursor-pointer transition-all select-none
                                  ${!hasSlots ? "bg-surface-container-high/20 dark:bg-gray-900/40" : "bg-white dark:bg-gray-900"}
                                  ${allBooked ? "ring-1 ring-inset ring-error/20" : ""}
                                  ${isSelected ? "bg-primary text-white shadow-lg shadow-primary/20 rounded-xl" : ""}
                                  ${isHovered && !isSelected ? "bg-surface-container-low dark:bg-gray-800/60" : ""}
                                  ${!isSelected ? "hover:bg-surface-container-low dark:hover:bg-gray-800/60" : ""}
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
                                  ${isSelected
                                    ? "text-white"
                                    : isToday
                                      ? "flex justify-end"
                                      : !hasSlots
                                        ? "text-outline-variant"
                                        : "text-on-surface"
                                  }
                                `}>
                                  {isToday && !isSelected ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-white text-xs font-bold shadow-glow-secondary">
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
                                      <span className={isSelected ? "text-white/90" : "text-emerald-600 dark:text-emerald-400"}>{openCount}</span>
                                      <span className={isSelected ? "text-white/50" : "text-outline-variant"}>/</span>
                                      <span className={isSelected ? "text-white/90" : "text-primary dark:text-primary-300"}>{bookedCount}</span>
                                    </span>
                                    <div className={`text-[10px] hidden sm:block ${isSelected ? "text-white/60" : "text-outline-variant"}`}>
                                      volne/rez.
                                    </div>
                                  </div>
                                )}
                                {intensiveCount > 0 && (
                                  <div className="text-center mt-0.5">
                                    <span className={`text-[10px] sm:text-xs font-medium ${isSelected ? "text-white/80" : "text-violet-600 dark:text-violet-400"}`}>
                                      IT {intensiveCount}
                                    </span>
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
                                      className="absolute z-30 left-1/2 -translate-x-1/2 top-full mt-1 bg-white dark:bg-gray-800 rounded-xl shadow-atmospheric-lg p-3 min-w-[190px] pointer-events-none"
                                    >
                                      <div className="text-xs font-medium text-on-surface-variant mb-2">
                                        {new Date(dateStr + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
                                      </div>
                                      {(() => {
                                        const dateEmpMap = slotsByDateEmployee.get(dateStr);
                                        if (!dateEmpMap) return null;
                                        return Array.from(dateEmpMap.entries()).map(([empId, data]) => {
                                          const color = therapistColorMap.get(empId);
                                          return (
                                            <div key={empId} className="flex items-center gap-2 text-xs py-0.5">
                                              <span className={`w-2 h-2 rounded-full shrink-0 ${color?.dot ?? "bg-outline-variant"}`} />
                                              <span className="text-on-surface truncate">{data.name}:</span>
                                              <span className="font-medium ml-auto">
                                                <span className="text-emerald-600 dark:text-emerald-400">{data.open}</span>
                                                <span className="text-outline-variant">/</span>
                                                <span className="text-primary dark:text-primary-300">{data.booked}</span>
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

                      {/* ── Filters ── */}
                      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-surface-container-low dark:bg-gray-800/30">
                        <div className="flex items-center gap-2">
                          <select
                            value={slotFilter}
                            onChange={(e) => { haptics.light(); setSlotFilter(e.target.value as any); }}
                            className="input text-sm py-1.5 w-auto"
                          >
                            <option value="all">Vse</option>
                            <option value="open">Volne</option>
                            <option value="booked">Obsazene</option>
                          </select>
                        </div>
                        <div className="relative flex-1 max-w-xs">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                          <input
                            type="text"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Hledat klienta..."
                            className="input text-sm py-1.5 pl-9"
                          />
                        </div>
                      </div>

                      {/* ── Selected day slot list ── */}
                      <motion.div
                        key={`day-detail-${selectedDay}`}
                        initial={shouldReduce ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="card"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-base font-semibold text-on-surface">
                            {new Date(selectedDay + "T12:00:00").toLocaleDateString("cs-CZ", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </h2>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              {slotsByDate.get(selectedDay)?.open ?? 0} volnych
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-xs font-semibold text-primary dark:text-primary-300">
                              {slotsByDate.get(selectedDay)?.booked ?? 0} rez.
                            </span>
                          </div>
                        </div>

                        {/* Stats bento grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40">
                            <p className="text-xs text-on-surface-variant font-medium mb-0.5">Total Sessions</p>
                            <p className="text-xl font-bold text-on-surface">{(slotsByDate.get(selectedDay)?.open ?? 0) + (slotsByDate.get(selectedDay)?.booked ?? 0)}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40">
                            <p className="text-xs text-on-surface-variant font-medium mb-0.5">Clinical Hours</p>
                            <p className="text-xl font-bold text-on-surface">{(slotsByDate.get(selectedDay)?.booked ?? 0)}h</p>
                          </div>
                        </div>

                        {selectedDaySlots.length === 0 ? (
                          <div className="text-center py-8 text-on-surface-variant">
                            <Calendar size={32} className="mx-auto mb-2 text-outline-variant opacity-40" />
                            <p>Zadne sloty pro tento den.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {selectedDaySlots.map((slot) => {
                              const color = therapistColorMap.get(slot.employee_id) ?? THERAPIST_COLORS[0];
                              const isBooked = slot.status === "booked";
                              return (
                                <div
                                  key={slot.id}
                                  className={`flex items-center gap-3 py-3 px-3 rounded-xl group transition-all ${
                                    isBooked
                                      ? "bg-surface-container-low dark:bg-gray-800/40 shadow-atmospheric"
                                      : "bg-emerald-50/60 dark:bg-emerald-900/10"
                                  }`}
                                >
                                  {/* Time column */}
                                  <div className="font-mono text-sm font-semibold text-on-surface-variant w-12 shrink-0">
                                    {slot.time}
                                  </div>

                                  {/* Therapist dot + name */}
                                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color.dot}`} />
                                  <span className="text-sm text-on-surface-variant truncate w-28 shrink-0">
                                    {slot.employee_name ?? "Terapeut"}
                                  </span>

                                  {isBooked ? (
                                    <>
                                      {/* In Progress badge */}
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary-700 dark:text-secondary-300 text-[11px] font-semibold shrink-0">
                                        In Progress
                                      </span>
                                      {/* Client info */}
                                      <span className="text-sm font-medium text-on-surface truncate">
                                        {slot.client_name ?? "Klient"}
                                      </span>
                                      {slot.client_phone && (
                                        <span className="text-xs text-on-surface-variant shrink-0 hidden sm:inline">
                                          {slot.client_phone}
                                        </span>
                                      )}
                                      {/* Edit button */}
                                      <motion.button
                                        onClick={() => {
                                          haptics.light();
                                          setEditModal(slot);
                                        }}
                                        className="ml-auto p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors shrink-0"
                                        whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                        title="Upravit"
                                      >
                                        <Pencil size={14} />
                                      </motion.button>
                                    </>
                                  ) : (
                                    <>
                                      {/* Open slot label */}
                                      <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                        Volny
                                      </span>
                                      {/* Book button — accent CTA */}
                                      <motion.button
                                        onClick={() => {
                                          haptics.light();
                                          setBookingModal(slot);
                                          setBookingClientId(null);
                                          setBookingNote("");
                                        }}
                                        className="ml-auto flex items-center gap-1 text-xs font-semibold text-secondary hover:text-secondary-600 px-2.5 py-1 rounded-lg hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-colors shrink-0"
                                        whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                      >
                                        <Plus size={12} /> Rezervovat
                                      </motion.button>
                                    </>
                                  )}
                                </div>
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
                        <h2 className="text-lg font-semibold text-on-surface">
                          Pracovni doba -- {emp?.name ?? ""}
                        </h2>
                        <span className="text-xs text-on-surface-variant px-2 py-0.5 rounded-full bg-surface-container-low">(pouze pro cteni)</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-surface-container-low dark:bg-gray-800/40 rounded-xl">
                              <th className="text-left py-2.5 px-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Den</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Zacatek</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Konec</th>
                              <th className="text-left py-2.5 px-3 font-semibold text-on-surface-variant text-xs uppercase tracking-wider">Pauza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scheduleRows.map((row) => (
                              <tr
                                key={row.dayOfWeek}
                                className={`transition-colors ${
                                  row.enabled ? "hover:bg-surface-container-low/50" : "opacity-35"
                                }`}
                              >
                                <td className="py-3 px-3 font-medium text-on-surface">
                                  {DAY_NAMES_FULL[row.dayOfWeek]}
                                </td>
                                {row.enabled ? (
                                  <>
                                    <td className="py-3 px-3 text-on-surface font-mono">{row.startTime}</td>
                                    <td className="py-3 px-3 text-on-surface font-mono">{row.endTime}</td>
                                    <td className="py-3 px-3 text-on-surface font-mono">
                                      {row.breakStart} -- {row.breakEnd}
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 px-3 text-outline-variant">--</td>
                                    <td className="py-3 px-3 text-outline-variant">--</td>
                                    <td className="py-3 px-3 text-outline-variant">--</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {/* ======= Tab: Intenzivni terapie ======= */}
                  {activeTab === "intensive" && (
                    <motion.div
                      key="tab-intensive"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      <div className="card">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
                            <Layers className="text-violet-500" size={20} />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-on-surface">Intenzivni terapie</h2>
                            <p className="text-sm text-on-surface-variant mt-1">
                              Bloky pro vice hodin u jednoho ci vice terapeutu. Pri pozdejsim otevirani terminu se v tomto case
                              nevytvori volne hodiny (stejna data jako harmonogram a fakturace pres sluzby / klienta).
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="label">Nazev planu</label>
                            <input
                              className="input"
                              value={itTitle}
                              onChange={(e) => setItTitle(e.target.value)}
                              placeholder="napr. Intenzivni tyden — Novak"
                            />
                          </div>
                          <div>
                            <label className="label">Klient (volitelne)</label>
                            <select
                              className="input"
                              value={itClientId}
                              onChange={(e) => setItClientId(e.target.value)}
                            >
                              <option value="">-- bez klienta --</option>
                              {(clientsData ?? []).map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="label">Poznamka</label>
                          <input
                            className="input"
                            value={itNotes}
                            onChange={(e) => setItNotes(e.target.value)}
                            placeholder="Interni poznamka"
                          />
                        </div>

                        <div className="mt-6 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-on-surface">Segmenty (den, cas, terapeut)</h3>
                            <motion.button
                              type="button"
                              onClick={() => { haptics.light(); addIntensiveRow(); }}
                              className="btn-secondary text-sm flex items-center gap-1"
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            >
                              <Plus size={14} /> Pridat segment
                            </motion.button>
                          </div>

                          {itRows.length === 0 && (
                            <p className="text-sm text-on-surface-variant">Zatim zadne segmenty — kliknete na &quot;Pridat segment&quot;.</p>
                          )}

                          {itRows.map((row, idx) => (
                            <div
                              key={idx}
                              className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40"
                            >
                              <div className="min-w-[140px]">
                                <label className="text-xs text-on-surface-variant">Datum</label>
                                <input
                                  type="date"
                                  className="input text-sm"
                                  value={row.date}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setItRows((rows) => rows.map((r, i) => (i === idx ? { ...r, date: v } : r)));
                                  }}
                                />
                              </div>
                              <div className="min-w-[90px]">
                                <label className="text-xs text-on-surface-variant">Od</label>
                                <input
                                  type="time"
                                  className="input text-sm"
                                  value={row.startTime}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setItRows((rows) => rows.map((r, i) => (i === idx ? { ...r, startTime: v } : r)));
                                  }}
                                />
                              </div>
                              <div className="min-w-[90px]">
                                <label className="text-xs text-on-surface-variant">Do</label>
                                <input
                                  type="time"
                                  className="input text-sm"
                                  value={row.endTime}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setItRows((rows) => rows.map((r, i) => (i === idx ? { ...r, endTime: v } : r)));
                                  }}
                                />
                              </div>
                              <div className="min-w-[160px] flex-1">
                                <label className="text-xs text-on-surface-variant">Terapeut</label>
                                <select
                                  className="input text-sm"
                                  value={row.employeeId}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setItRows((rows) => rows.map((r, i) => (i === idx ? { ...r, employeeId: v } : r)));
                                  }}
                                >
                                  {(employees ?? []).map((e) => (
                                    <option key={e.id} value={e.id}>{e.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="min-w-[140px] flex-1">
                                <label className="text-xs text-on-surface-variant">Sluzba (volitelne)</label>
                                <select
                                  className="input text-sm"
                                  value={row.serviceId}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setItRows((rows) => rows.map((r, i) => (i === idx ? { ...r, serviceId: v } : r)));
                                  }}
                                >
                                  <option value="">--</option>
                                  {(servicesData ?? []).map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                              <motion.button
                                type="button"
                                onClick={() => {
                                  haptics.light();
                                  setItRows((rows) => rows.filter((_, i) => i !== idx));
                                }}
                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                                title="Odebrat radek"
                              >
                                <Trash2 size={18} />
                              </motion.button>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                          <motion.button
                            type="button"
                            onClick={saveIntensivePlan}
                            disabled={itSaving}
                            className="btn-primary flex items-center gap-2 disabled:opacity-50"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          >
                            {itSaving ? (
                              <>
                                <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                Ukladam...
                              </>
                            ) : (
                              "Ulozit plan"
                            )}
                          </motion.button>
                        </div>
                      </div>

                      <div className="card">
                        <h3 className="text-base font-semibold text-on-surface mb-3">
                          Plany v obdobi {MONTH_NAMES[calMonth]} {calYear}
                        </h3>
                        {(intensivePlansData?.plans ?? []).length === 0 ? (
                          <p className="text-sm text-on-surface-variant">Zadne aktivni plany v tomto mesici.</p>
                        ) : (
                          <div className="space-y-3">
                            {(intensivePlansData?.plans ?? []).map((plan) => (
                              <div
                                key={plan.id}
                                className="p-4 rounded-2xl bg-surface-container-low dark:bg-gray-800/40"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-on-surface">{plan.title}</div>
                                    {plan.client_name && (
                                      <div className="text-sm text-on-surface-variant">Klient: {plan.client_name}</div>
                                    )}
                                    {plan.notes && (
                                      <div className="text-sm text-on-surface-variant mt-1">{plan.notes}</div>
                                    )}
                                  </div>
                                  <motion.button
                                    type="button"
                                    onClick={() => { haptics.light(); cancelIntensivePlan(plan.id); }}
                                    className="btn-secondary text-sm flex items-center gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                                  >
                                    <Trash2 size={14} /> Zrusit plan
                                  </motion.button>
                                </div>
                                <ul className="mt-3 space-y-1 text-sm text-on-surface-variant">
                                  {plan.segments.map((seg) => (
                                    <li key={seg.id}>
                                      {new Date(seg.date + "T12:00:00").toLocaleDateString("cs-CZ")}{" "}
                                      {seg.start_time}–{seg.end_time} — {seg.employee_name}
                                      {seg.service_name ? ` (${seg.service_name})` : ""}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
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
                          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                            <Sparkles className="text-amber-500" size={20} />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-on-surface">Chytre doplneni rozvrhu</h2>
                            <p className="text-sm text-on-surface-variant mt-1">
                              Analyza historicke poptavky -- navrhne rezervace, ktere klienti nejcasteji vyuzivaji
                              a zatim nejsou otevreny v pristich dvou tydnech.
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-on-surface-variant">Analyzovat poslednich</label>
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
                            className="btn-accent flex items-center gap-2"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          >
                            <Sparkles size={16} /> Analyzovat poptavku
                          </motion.button>
                        </div>
                      </div>

                      {autofillLoading && (
                        <div className="card text-center py-10 text-on-surface-variant">
                          <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary rounded-full mx-auto mb-3" />
                          Analyzuji historii rezervaci...
                        </div>
                      )}

                      {!autofillLoading && autofillData && autofillData.suggestions.length === 0 && (
                        <motion.div
                          initial={shouldReduce ? false : { opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ type: "spring", stiffness: 380, damping: 26 }}
                          className="card text-center py-10 text-on-surface-variant"
                        >
                          <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
                          <p className="font-medium text-on-surface">Rozvrh je optimalne doplnen</p>
                          <p className="text-sm mt-1 text-on-surface-variant">Vsechny oblibene rezervace jsou v pristich 2 tydnech otevreny.</p>
                        </motion.div>
                      )}

                      {!autofillLoading && autofillData && autofillData.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-on-surface-variant px-1">
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
                                  <div className="w-12 h-12 rounded-xl bg-secondary-50 dark:bg-secondary-900/20 flex flex-col items-center justify-center shrink-0">
                                    <span className="text-xs font-semibold text-secondary-700">{sug.dayName}</span>
                                    <span className="text-sm font-bold text-secondary">{sug.time}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium text-on-surface">
                                      {sug.dayName} {sug.time}
                                    </p>
                                    <p className="text-xs text-on-surface-variant">
                                      {sug.count}x rezervovano za poslednich {autofillData.lookbackWeeks} tydnu
                                    </p>
                                  </div>
                                </div>
                                {accepted ? (
                                  <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                                    <CheckCircle size={16} /> Otevreno
                                  </span>
                                ) : (
                                  <motion.button
                                    onClick={() => acceptSuggestion(sug)}
                                    disabled={acceptingSlot === key}
                                    className="btn-accent text-sm py-1.5 px-3 shrink-0 disabled:opacity-50"
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
                        <div className="card text-center py-12 text-on-surface-variant">
                          <Sparkles size={40} className="mx-auto mb-3 text-outline-variant opacity-40" />
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
                        <h2 className="text-lg font-semibold text-on-surface mb-4">Zadat nepritomnost -- {emp?.name}</h2>
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
                        <h2 className="text-lg font-semibold text-on-surface mb-4">Planovane nepritomnosti</h2>
                        {(timeOffData ?? []).length === 0 ? (
                          <p className="text-center py-8 text-on-surface-variant">Zadne zaznamy.</p>
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
                                className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40"
                              >
                                <div>
                                  <span className="font-medium text-on-surface">{toff.date_from === toff.date_to ? toff.date_from : `${toff.date_from} -> ${toff.date_to}`}</span>
                                  <span className="ml-2 text-sm text-on-surface-variant">{TIME_OFF_TYPES[toff.type] ?? toff.type}{toff.note && ` -- ${toff.note}`}</span>
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

        {/* ======= Modal: Booking (open slot → reserve for client) ======= */}
        <AnimatePresence>
          {bookingModal && (
            <motion.div
              key="booking-backdrop"
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setBookingModal(null); }}
            >
              <motion.div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-atmospheric-lg max-w-md w-full p-6"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-on-surface">Nova rezervace</h3>
                  <motion.button
                    onClick={() => { haptics.light(); setBookingModal(null); }}
                    className="p-1.5 rounded-xl hover:bg-surface-container-low dark:hover:bg-gray-800 text-on-surface-variant"
                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Slot info */}
                <div className="space-y-1.5 mb-5 text-sm p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Calendar size={15} />
                    <span className="font-medium text-on-surface">
                      {new Date(bookingModal.date + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <Clock size={15} />
                    <span className="font-medium text-on-surface">{bookingModal.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <User size={15} />
                    <span className="font-medium text-on-surface">{bookingModal.employee_name ?? "Terapeut"}</span>
                  </div>
                </div>

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

                <div className="flex gap-3 mt-5">
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
                    onClick={() => closeSlot(bookingModal.id)}
                    className="btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <Trash2 size={14} className="inline mr-1" />
                    Zrusit slot
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======= Modal: Edit booked slot (storno zdarma / storno s poplatkem) ======= */}
        <AnimatePresence>
          {editModal && (
            <motion.div
              key="edit-backdrop"
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setEditModal(null); }}
            >
              <motion.div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-atmospheric-lg max-w-md w-full p-6"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-on-surface">Rezervace</h3>
                  <motion.button
                    onClick={() => { haptics.light(); setEditModal(null); }}
                    className="p-1.5 rounded-xl hover:bg-surface-container-low dark:hover:bg-gray-800 text-on-surface-variant"
                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                {/* Booking info */}
                <div className="space-y-2 mb-5">
                  <div className="p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40">
                    <p className="font-semibold text-on-surface">{editModal.client_name ?? "Klient"}</p>
                    {editModal.client_phone && (
                      <p className="text-sm text-on-surface-variant mt-0.5 flex items-center gap-1">
                        <Phone size={12} /> {editModal.client_phone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-on-surface-variant">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {new Date(editModal.date + "T12:00:00").toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {editModal.time}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                    <User size={14} />
                    {editModal.employee_name ?? "Terapeut"}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-2">
                  <motion.button
                    onClick={() => cancelBookingFree(editModal)}
                    disabled={cancellingBooking}
                    className="w-full py-2.5 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors text-sm font-medium disabled:opacity-50"
                    whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {cancellingBooking ? "Rusim..." : "Storno zdarma"}
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      haptics.light();
                      setStornoFeeModal(editModal);
                      setStornoFee("");
                      setStornoDescription(`Storno poplatek — ${editModal.client_name ?? "klient"} ${editModal.date} ${editModal.time}`);
                    }}
                    className="w-full py-2.5 px-4 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium"
                    whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    Storno s poplatkem
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======= Modal: Storno fee dialog ======= */}
        <AnimatePresence>
          {stornoFeeModal && (
            <motion.div
              key="storno-fee-backdrop"
              className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setStornoFeeModal(null); }}
            >
              <motion.div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-atmospheric-lg max-w-sm w-full p-6"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-on-surface mb-4">Storno s poplatkem</h3>

                <div className="space-y-3">
                  <div>
                    <label className="label">Poplatek (Kc)</label>
                    <input
                      type="number"
                      value={stornoFee}
                      onChange={(e) => setStornoFee(e.target.value)}
                      className="input"
                      placeholder="500"
                      min="1"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="label">Popis na fakture</label>
                    <input
                      type="text"
                      value={stornoDescription}
                      onChange={(e) => setStornoDescription(e.target.value)}
                      className="input"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <motion.button
                    onClick={cancelBookingWithFee}
                    disabled={stornoInProgress || !stornoFee}
                    className="btn-primary flex-1 disabled:opacity-50 bg-red-600 hover:bg-red-700"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {stornoInProgress ? "Zpracovavam..." : "Potvrdit storno"}
                  </motion.button>
                  <motion.button
                    onClick={() => { haptics.light(); setStornoFeeModal(null); }}
                    className="btn-secondary"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    Zrusit
                  </motion.button>
                </div>
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
                className="bg-white dark:bg-gray-900 w-full min-h-screen sm:min-h-0 sm:max-w-2xl sm:my-8 sm:rounded-2xl sm:shadow-atmospheric-lg"
                initial={shouldReduce ? false : { opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Wizard header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 px-6 py-4 sm:rounded-t-2xl" style={{ borderBottom: '1px solid rgba(199, 197, 209, 0.12)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-on-surface">Otevrit terminy</h2>
                    <motion.button
                      onClick={() => { haptics.light(); setWizardOpen(false); }}
                      className="p-1.5 rounded-xl hover:bg-surface-container-low dark:hover:bg-gray-800 text-on-surface-variant"
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
                                isComplete || isActive ? "bg-primary" : "bg-surface-container-high dark:bg-gray-700"
                              }`} />
                            )}
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              isActive
                                ? "bg-primary text-white shadow-lg shadow-primary/20"
                                : isComplete
                                  ? "bg-primary-100 dark:bg-primary-900/40 text-primary"
                                  : "bg-surface-container-high dark:bg-gray-800 text-outline-variant"
                            }`}>
                              {isComplete ? <Check size={14} /> : step.num}
                            </div>
                          </div>
                          <span className={`text-xs font-medium hidden sm:inline ${
                            isActive ? "text-primary" : isComplete ? "text-primary" : "text-outline-variant"
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
                        <h3 className="text-lg font-semibold text-on-surface mb-1">Vyberte terapeuta</h3>
                        <p className="text-sm text-on-surface-variant mb-4">Zvolte jednoho nebo vice terapeutu, pro ktere chcete otevrit terminy.</p>

                        {/* Select all */}
                        <motion.button
                          onClick={selectAllEmployees}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-3 transition-all ${
                            wizardSelectedEmployees.size === (employees ?? []).length
                              ? "bg-primary-50 dark:bg-primary-900/20 shadow-sm ring-1 ring-primary/20"
                              : "bg-surface-container-low hover:bg-surface-container-high"
                          }`}
                          whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                            wizardSelectedEmployees.size === (employees ?? []).length
                              ? "bg-primary text-white"
                              : "bg-surface-container-high dark:bg-gray-700"
                          }`}>
                            {wizardSelectedEmployees.size === (employees ?? []).length && <Check size={14} className="text-white" />}
                          </div>
                          <Users size={18} className="text-on-surface-variant" />
                          <span className="font-medium text-on-surface">Vsichni terapeuti</span>
                          <span className="ml-auto text-xs text-on-surface-variant">({(employees ?? []).length})</span>
                        </motion.button>

                        <div className="space-y-2">
                          {(employees ?? []).map((empItem) => {
                            const color = therapistColorMap.get(empItem.id);
                            const isSelected = wizardSelectedEmployees.has(empItem.id);
                            return (
                              <motion.button
                                key={empItem.id}
                                onClick={() => toggleWizardEmployee(empItem.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                  isSelected
                                    ? "bg-primary-50 dark:bg-primary-900/20 shadow-sm ring-1 ring-primary/20"
                                    : "bg-surface-container-low hover:bg-surface-container-high"
                                }`}
                                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              >
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? "bg-primary text-white"
                                    : "bg-surface-container-high dark:bg-gray-700"
                                }`}>
                                  {isSelected && <Check size={14} className="text-white" />}
                                </div>
                                <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-outline-variant"}`} />
                                <span className="font-medium text-on-surface">{empItem.name}</span>
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
                        <h3 className="text-lg font-semibold text-on-surface mb-1">Pracovni doba</h3>
                        <p className="text-sm text-on-surface-variant mb-4">
                          Zkontrolujte a upravte pracovni dobu pro vybrane terapeuty. Sloty se otevrou pouze v povolene dny a hodiny.
                        </p>

                        <div className="space-y-6">
                          {selectedEmpIds.map((empId) => {
                            const empItem = (employees ?? []).find((e) => e.id === empId);
                            const color = therapistColorMap.get(empId);
                            const schedule = wizardSchedules.get(empId) ?? defaultDaySchedule();

                            return (
                              <div key={empId} className="rounded-2xl overflow-hidden bg-surface-container-low dark:bg-gray-800/30">
                                <div className="flex items-center gap-2 px-4 py-3 bg-surface-container-high/50 dark:bg-gray-800/50">
                                  <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-outline-variant"}`} />
                                  <span className="font-medium text-on-surface">{empItem?.name ?? "Terapeut"}</span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr>
                                        <th className="text-left py-2 px-3 font-semibold text-on-surface-variant text-xs w-8"></th>
                                        <th className="text-left py-2 px-3 font-semibold text-on-surface-variant text-xs">Den</th>
                                        <th className="text-left py-2 px-3 font-semibold text-on-surface-variant text-xs">Zacatek</th>
                                        <th className="text-left py-2 px-3 font-semibold text-on-surface-variant text-xs">Konec</th>
                                        <th className="text-left py-2 px-3 font-semibold text-on-surface-variant text-xs">Pauza od</th>
                                        <th className="text-left py-2 px-3 font-semibold text-on-surface-variant text-xs">Pauza do</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {schedule.map((row) => (
                                        <tr key={row.dayOfWeek} className={`${row.enabled ? "" : "opacity-35"}`}>
                                          <td className="py-1.5 px-3">
                                            <input
                                              type="checkbox"
                                              checked={row.enabled}
                                              onChange={(e) => updateWizardSchedule(empId, row.dayOfWeek, "enabled", e.target.checked)}
                                              className="rounded-md border-outline-variant text-primary focus:ring-primary/30"
                                            />
                                          </td>
                                          <td className="py-1.5 px-3 font-medium text-on-surface text-xs">
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
                        <h3 className="text-lg font-semibold text-on-surface mb-1">Obdobi</h3>
                        <p className="text-sm text-on-surface-variant mb-4">Zvolte datovy rozsah, ve kterem se maji otevrit sloty.</p>

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
                        <div className="mt-6 p-4 bg-surface-container-low dark:bg-gray-800/40 rounded-2xl">
                          <h4 className="text-sm font-semibold text-on-surface mb-3">Souhrn</h4>
                          <div className="space-y-2 text-sm text-on-surface-variant">
                            <div className="flex items-center gap-2">
                              <Users size={15} className="text-on-surface-variant" />
                              <span>
                                <strong>{wizardSelectedEmployees.size}</strong> {wizardSelectedEmployees.size === 1 ? "terapeut" : wizardSelectedEmployees.size < 5 ? "terapeuti" : "terapeutu"}:
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 ml-6">
                              {selectedEmpIds.map((empId) => {
                                const empItem = (employees ?? []).find((e) => e.id === empId);
                                const color = therapistColorMap.get(empId);
                                return (
                                  <span key={empId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 text-xs shadow-sm">
                                    <span className={`w-2 h-2 rounded-full ${color?.dot ?? "bg-outline-variant"}`} />
                                    {empItem?.name}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={15} className="text-on-surface-variant" />
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
                              "Otevrit terminy"
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
                            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
                          </motion.div>
                          <h3 className="text-lg font-semibold text-on-surface">Terminy otevreny</h3>
                          <p className="text-sm text-on-surface-variant mt-1">
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
                                className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low dark:bg-gray-800/40"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-3 h-3 rounded-full ${color?.dot ?? "bg-outline-variant"}`} />
                                  <span className="font-medium text-on-surface">{result.employeeName}</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    +{result.created} vytvoreno
                                  </span>
                                  {result.skipped > 0 && (
                                    <span className="text-on-surface-variant">{result.skipped} preskoceno</span>
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
