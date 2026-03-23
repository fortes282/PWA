"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState, useCallback, useEffect } from "react";
import { Calendar, Clock, Plus, Trash2, X, User, Sparkles, CheckCircle } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const DAY_NAMES_FULL = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

const TIME_OFF_TYPES: Record<string, string> = {
  vacation: "Dovolená",
  sick: "Nemoc",
  other: "Jiný důvod",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800 border-green-200",
  booked: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-gray-100 text-gray-400 border-gray-200",
};

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

export default function ReceptionSchedule() {
  const shouldReduce = useReducedMotion();
  const { toast } = useToast();
  const today = toDateStr(new Date());
  const [activeTab, setActiveTab] = useState<"schedule" | "slots" | "timeoff" | "autofill">("slots");
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);

  // ── Employees ──
  const { data: employees } = useSWR<EmployeeUser[]>("/users?role=EMPLOYEE", fetcher);

  const emp = employees?.find((e) => e.id === selectedEmpId);

  // ── Work Schedule ──
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
  const [savingSchedule, setSavingSchedule] = useState(false);

  const { data: workScheduleRaw } = useSWR<WorkScheduleRow[]>(
    selectedEmpId ? `/work-schedule/${selectedEmpId}` : null,
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

  const saveSchedule = useCallback(async () => {
    if (!selectedEmpId) return;
    haptics.medium();
    setSavingSchedule(true);
    try {
      const days = scheduleRows.filter((r) => r.enabled).map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        breakStart: r.breakStart || undefined,
        breakEnd: r.breakEnd || undefined,
      }));
      await api.put(`/work-schedule/${selectedEmpId}`, days);
      haptics.success();
      toast("success", "Pracovní doba uložena");
    } catch {
      toast("error", "Chyba při ukládání");
    } finally {
      setSavingSchedule(false);
    }
  }, [selectedEmpId, scheduleRows, toast]);

  // ── Slots ──
  const [slotsFrom, setSlotsFrom] = useState(today);
  const [slotsTo, setSlotsTo] = useState(addDays(today, 13));
  const [openSlotsModal, setOpenSlotsModal] = useState(false);
  const [openPeriodFrom, setOpenPeriodFrom] = useState(today);
  const [openPeriodTo, setOpenPeriodTo] = useState(addDays(today, 6));
  const [openingSlots, setOpeningSlots] = useState(false);
  const [bookSlotModal, setBookSlotModal] = useState<SlotRow | null>(null);
  const [bookingClientId, setBookingClientId] = useState<number | null>(null);
  const [bookingNote, setBookingNote] = useState("");
  const [bookingInProgress, setBookingInProgress] = useState(false);

  const slotsKey = selectedEmpId ? `/slots?employeeId=${selectedEmpId}&from=${slotsFrom}&to=${slotsTo}` : null;
  const { data: slotsData, mutate: mutateSlots } = useSWR<SlotRow[]>(slotsKey, fetcher);
  const { data: clientsData } = useSWR<ClientUser[]>("/users?role=CLIENT", fetcher);

  const slotsByDate = (slotsData ?? []).reduce<Record<string, SlotRow[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  const openSlots = useCallback(async () => {
    if (!selectedEmpId) return;
    haptics.medium();
    setOpeningSlots(true);
    try {
      const result = await api.post<{ preview: number; created: number; skipped: number }>("/slots/open", {
        employeeId: selectedEmpId,
        from: openPeriodFrom,
        to: openPeriodTo,
      });
      haptics.success();
      toast("success", `Otevřeno ${result.created} nových termínů`);
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
      toast("success", "Termín zrušen");
      mutateSlots();
    } catch {
      toast("error", "Chyba při rušení termínu");
    }
  }, [toast, mutateSlots]);

  const bookForClient = useCallback(async () => {
    if (!bookSlotModal || !bookingClientId) return;
    haptics.medium();
    setBookingInProgress(true);
    try {
      await api.post("/bookings-v2", {
        slotId: bookSlotModal.id,
        clientId: bookingClientId,
        note: bookingNote || undefined,
      });
      haptics.success();
      toast("success", "Termín rezervován");
      setBookSlotModal(null);
      setBookingClientId(null);
      setBookingNote("");
      mutateSlots();
    } catch {
      toast("error", "Chyba při rezervaci");
    } finally {
      setBookingInProgress(false);
    }
  }, [bookSlotModal, bookingClientId, bookingNote, toast, mutateSlots]);

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
  const autofillSWRKey = selectedEmpId && activeTab === "autofill"
    ? `/slots/suggestions?employeeId=${selectedEmpId}&weeks=${autofillWeeks}&_k=${autofillKey}`
    : null;
  const { data: autofillData, isLoading: autofillLoading } = useSWR<{ lookbackWeeks: number; suggestions: SuggestionItem[] }>(
    autofillSWRKey,
    fetcher
  );
  const [acceptedSlots, setAcceptedSlots] = useState<Set<string>>(new Set());
  const [acceptingSlot, setAcceptingSlot] = useState<string | null>(null);

  const acceptSuggestion = useCallback(async (sug: SuggestionItem) => {
    if (!selectedEmpId) return;
    haptics.medium();
    const key = `${sug.dayOfWeek}:${sug.time}`;
    setAcceptingSlot(key);

    // Find the next occurrence of this day of week
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
        employeeId: selectedEmpId,
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
  }, [selectedEmpId, toast, mutateSlots]);

  // ── Time Off ──
  const [timeOffForm, setTimeOffForm] = useState({ dateFrom: today, dateTo: today, type: "vacation", note: "" });
  const [savingTimeOff, setSavingTimeOff] = useState(false);

  const { data: timeOffData, mutate: mutateTimeOff } = useSWR<TimeOffRow[]>(
    selectedEmpId ? `/time-off-v2/${selectedEmpId}` : null,
    fetcher
  );

  const saveTimeOff = useCallback(async () => {
    if (!selectedEmpId) return;
    haptics.medium();
    setSavingTimeOff(true);
    try {
      await api.post("/time-off-v2", {
        employeeId: selectedEmpId,
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
  }, [selectedEmpId, timeOffForm, today, toast, mutateTimeOff]);

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
    slots: "Termíny",
    schedule: "Pracovní doba",
    timeoff: "Nepřítomnost",
    autofill: <><Sparkles size={14} className="text-amber-500 inline mr-1" />Chytré doplnění</>,
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto p-4">
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Calendar className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Správa termínů — Recepce</h1>
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
              value={selectedEmpId ?? ""}
              onChange={(e) => { haptics.light(); setSelectedEmpId(e.target.value ? parseInt(e.target.value) : null); }}
              className="input max-w-xs"
            >
              <option value="">— Vyberte terapeuta —</option>
              {(employees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </motion.div>

          <AnimatePresence mode="wait">
            {!selectedEmpId ? (
              <motion.div
                key="no-emp"
                initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card text-center py-16 text-gray-500"
              >
                <User size={48} className="mx-auto mb-4 opacity-30" />
                <p>Vyberte terapeuta pro správu termínů.</p>
                <p className="text-sm mt-2 opacity-60">Pracovní doba: 08:00 – 17:00</p>
              </motion.div>
            ) : (
              <motion.div
                key="emp-content"
                initial={shouldReduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
              >
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

                {/* Tab content with AnimatePresence */}
                <AnimatePresence mode="wait">
                  {/* Tab: Termíny */}
                  {activeTab === "slots" && (
                    <motion.div
                      key="tab-slots"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <input type="date" value={slotsFrom} onChange={(e) => setSlotsFrom(e.target.value)} className="input-sm" />
                          <span className="text-gray-400">–</span>
                          <input type="date" value={slotsTo} onChange={(e) => setSlotsTo(e.target.value)} className="input-sm" />
                        </div>
                        <motion.button
                          onClick={() => { haptics.medium(); setOpenSlotsModal(true); }}
                          className="btn-primary flex items-center gap-2"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          <Plus size={16} /> Otevřít termíny
                        </motion.button>
                      </div>

                      {Object.keys(slotsByDate).sort().map((date) => (
                        <motion.div
                          key={date}
                          initial={shouldReduce ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className="card"
                        >
                          <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
                            {new Date(date + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {slotsByDate[date].map((slot) => (
                              <div
                                key={slot.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${STATUS_COLORS[slot.status]}`}
                              >
                                <Clock size={14} />
                                <span>{slot.time}</span>
                                {slot.client_name && <span className="text-xs opacity-75">— {slot.client_name}</span>}
                                {slot.status === "open" && (
                                  <>
                                    <motion.button
                                      onClick={() => { haptics.light(); setBookSlotModal(slot); }}
                                      className="ml-1 text-blue-600 hover:text-blue-800 text-xs underline"
                                      whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                    >
                                      Rezervovat
                                    </motion.button>
                                    <motion.button
                                      onClick={() => closeSlot(slot.id)}
                                      className="text-red-500 hover:text-red-700"
                                      title="Zrušit slot"
                                      whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                    >
                                      <X size={12} />
                                    </motion.button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ))}
                      {Object.keys(slotsByDate).length === 0 && (
                        <div className="card text-center py-12 text-gray-500">Žádné termíny v tomto období.</div>
                      )}
                    </motion.div>
                  )}

                  {/* Tab: Pracovní doba */}
                  {activeTab === "schedule" && (
                    <motion.div
                      key="tab-schedule"
                      initial={shouldReduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="card"
                    >
                      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        Pracovní doba — {emp?.name}
                      </h2>
                      <div className="space-y-3">
                        {scheduleRows.map((row) => (
                          <div
                            key={row.dayOfWeek}
                            className={`p-3 rounded-lg border ${
                              row.enabled
                                ? "border-primary-200 bg-primary-50 dark:bg-primary-900/20"
                                : "border-gray-200 bg-gray-50 dark:bg-gray-800/50 opacity-60"
                            }`}
                          >
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2 w-28">
                                <input
                                  type="checkbox"
                                  checked={row.enabled}
                                  onChange={(e) => {
                                    haptics.light();
                                    setScheduleRows((prev) =>
                                      prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, enabled: e.target.checked } : r)
                                    );
                                  }}
                                  className="w-4 h-4 accent-primary-600"
                                />
                                <span className="font-medium text-gray-700 dark:text-gray-300">{DAY_NAMES_FULL[row.dayOfWeek]}</span>
                              </div>
                              {row.enabled && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Práce:</span>
                                    <input type="time" value={row.startTime}
                                      onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, startTime: e.target.value } : r))}
                                      className="input-sm" />
                                    <span className="text-gray-400">–</span>
                                    <input type="time" value={row.endTime}
                                      onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, endTime: e.target.value } : r))}
                                      className="input-sm" />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Pauza:</span>
                                    <input type="time" value={row.breakStart}
                                      onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, breakStart: e.target.value } : r))}
                                      className="input-sm" />
                                    <span className="text-gray-400">–</span>
                                    <input type="time" value={row.breakEnd}
                                      onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, breakEnd: e.target.value } : r))}
                                      className="input-sm" />
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <motion.button
                          onClick={saveSchedule}
                          disabled={savingSchedule}
                          className="btn-primary disabled:opacity-50"
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        >
                          {savingSchedule ? "Ukládám…" : "Uložit"}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* Tab: Chytré doplnění */}
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
                              Analýza historické poptávky — navrhne termíny, které klienti nejčastěji rezervují
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
                          <p className="text-sm mt-1">Všechny oblíbené termíny jsou v příštích 2 týdnech otevřeny.</p>
                        </motion.div>
                      )}

                      {!autofillLoading && autofillData && autofillData.suggestions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500 px-1">
                            Nalezeno <strong>{autofillData.suggestions.length}</strong> termínů s vysokou poptávkou,
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
                                      {sug.count}× rezervováno za posledních {autofillData.lookbackWeeks} týdnů
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

                  {/* Tab: Nepřítomnost */}
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

        {/* Modal: Otevřít termíny */}
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
                  <h3 className="text-lg font-semibold">Otevřít termíny — {emp?.name}</h3>
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
                    {openingSlots ? "Otvírám…" : "Otevřít termíny"}
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

        {/* Modal: Rezervovat za klienta */}
        <AnimatePresence>
          {bookSlotModal && (
            <motion.div
              key="book-slot-backdrop"
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => { haptics.light(); setBookSlotModal(null); }}
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
                  <h3 className="text-lg font-semibold">Rezervovat termín</h3>
                  <motion.button
                    onClick={() => { haptics.light(); setBookSlotModal(null); }}
                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
                    whileTap={shouldReduce ? undefined : { scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Slot: <strong>{bookSlotModal.date} v {bookSlotModal.time}</strong>
                </p>
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
                <div className="mt-6 flex gap-3">
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
                    onClick={() => { haptics.light(); setBookSlotModal(null); }}
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
      </Layout>
    </RouteGuard>
  );
}
