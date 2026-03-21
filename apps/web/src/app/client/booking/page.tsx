"use client";

import { motion, AnimatePresence } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate as globalMutate } from "swr";
import { useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Clock, User, Calendar, AlertCircle, CheckCircle2, Sparkles, Heart, Activity, MessageCircle, Wallet } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any>(url);

// Months in Czech
const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];
const DAY_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

interface Service {
  id: number;
  name: string;
  description?: string | null;
  durationMin: number;
  price: number;
  category?: string | null;
  isActive: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  masaz: <Heart size={20} />,
  masáž: <Heart size={20} />,
  terapie: <Activity size={20} />,
  konzultace: <MessageCircle size={20} />,
  relaxace: <Sparkles size={20} />,
};

function getServiceIcon(category?: string | null) {
  if (!category) return <Sparkles size={20} />;
  const key = category.toLowerCase();
  return CATEGORY_ICONS[key] ?? <Sparkles size={20} />;
}

interface EmployeeUser {
  id: number;
  name: string;
  avatar_url?: string;
}

interface SlotRow {
  id: number;
  employee_id: number;
  date: string;
  time: string;
  status: "open" | "booked" | "cancelled";
  employee_name?: string;
}

interface MonthDayInfo {
  date: string;
  total: number;
  open_count: number;
  booked_count: number;
}

interface BookingV2 {
  id: number;
  date: string;
  time: string;
  employee_name: string;
  status: string;
  created_at: string;
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Get all calendar days for a month view (including padding from prev/next month)
function getMonthCalendarDays(year: number, month: number): Array<{ date: string; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Mon-based: (0=Mon ... 6=Sun)
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: Array<{ date: string; isCurrentMonth: boolean }> = [];

  // Pad from prev month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: toDateStr(d), isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    days.push({ date: toDateStr(dt), isCurrentMonth: true });
  }

  // Pad to complete last row (7 cols)
  while (days.length % 7 !== 0) {
    const last = new Date(days[days.length - 1].date + "T12:00:00");
    last.setDate(last.getDate() + 1);
    days.push({ date: toDateStr(last), isCurrentMonth: false });
  }

  return days;
}

export default function ClientBooking() {
  const { toast } = useToast();
  const today = toDateStr(new Date());

  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmSlot, setConfirmSlot] = useState<SlotRow | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<SlotRow | null>(null);

  // ── Services ──
  const { data: services } = useSWR<Service[]>("/services", fetcher);
  const selectedService = (services ?? []).find((s) => s.id === selectedServiceId) ?? null;

  // ── Credit balance ──
  const { data: creditData } = useSWR<{ balance: number }>("/credits/balance", fetcher);

  // ── Employees ──
  const { data: employees } = useSWR<EmployeeUser[]>("/users?role=EMPLOYEE", fetcher);

  // ── Month data (dots) ──
  const monthKey = selectedEmpId
    ? `/slots/months?employeeId=${selectedEmpId}&year=${viewYear}&month=${viewMonth + 1}`
    : `/slots/months?year=${viewYear}&month=${viewMonth + 1}`;
  const { data: monthData } = useSWR<MonthDayInfo[]>(monthKey, fetcher);

  const monthDataMap = useMemo(() => {
    const m: Record<string, MonthDayInfo> = {};
    for (const d of monthData ?? []) m[d.date] = d;
    return m;
  }, [monthData]);

  // ── Available slots for selected day ──
  const availableKey = selectedDate
    ? `/slots/available?date=${selectedDate}${selectedEmpId ? `&employeeId=${selectedEmpId}` : ""}`
    : null;
  const { data: availableSlots } = useSWR<SlotRow[]>(availableKey, fetcher);

  // ── My bookings ──
  const { data: myBookings } = useSWR<BookingV2[]>("/bookings-v2/my", fetcher);

  const calendarDays = useMemo(
    () => getMonthCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
    setSelectedDate(null);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
    setSelectedDate(null);
  }, [viewMonth]);

  const handleBook = useCallback(async () => {
    if (!confirmSlot) return;
    setBookingInProgress(true);
    haptics.medium();
    try {
      await api.post("/bookings-v2", { slotId: confirmSlot.id });
      haptics.success();
      setBookedSlot(confirmSlot);
      setConfirmSlot(null);
      // Refresh data
      globalMutate(availableKey);
      globalMutate(monthKey);
      globalMutate("/bookings-v2/my");
    } catch (e: unknown) {
      haptics.error();
      const msg = e instanceof Error ? e.message : "Nepodařilo se rezervovat termín.";
      toast("error", msg);
    } finally {
      setBookingInProgress(false);
    }
  }, [confirmSlot, availableKey, monthKey, toast]);

  const cancelBooking = useCallback(async (bookingId: number) => {
    try {
      await api.delete(`/bookings-v2/${bookingId}`);
      toast("success", "Termín zrušen.");
      globalMutate("/bookings-v2/my");
      globalMutate(availableKey);
      globalMutate(monthKey);
    } catch {
      toast("error", "Nepodařilo se zrušit termín.");
    }
  }, [availableKey, monthKey, toast]);

  const upcomingBookings = useMemo(
    () => (myBookings ?? []).filter((b) => b.status === "confirmed" && b.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [myBookings, today]
  );

  const activeStep = confirmSlot ? 3 : selectedDate ? 2 : selectedServiceId ? 1 : 0;

  const STEPS = [
    { label: "Služba", step: 0 },
    { label: "Datum", step: 1 },
    { label: "Čas", step: 2 },
    { label: "Potvrzení", step: 3 },
  ];

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rezervace termínu</h1>
          </div>

          {/* Progress stepper */}
          <div className="flex items-center mb-6">
            {STEPS.map((s, i) => {
              const done = activeStep > s.step;
              const active = activeStep === s.step;
              return (
                <div key={s.step} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done ? "bg-primary-600 text-white" : active ? "bg-primary-100 text-primary-700 ring-2 ring-primary-500" : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                    }`}>
                      {done ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${
                      active ? "text-primary-600" : done ? "text-primary-500" : "text-gray-400"
                    }`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 transition-colors ${done ? "bg-primary-400" : "bg-gray-200 dark:bg-gray-700"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Service selection cards */}
          <div className="card mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Vyberte službu</h2>
            </div>
            {!services ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-xl skeleton-shimmer" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(services ?? []).filter((s) => s.isActive).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { haptics.light(); setSelectedServiceId(s.id === selectedServiceId ? null : s.id); setSelectedDate(null); }}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-all text-left ${
                      selectedServiceId === s.id
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40"
                        : "border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className={`${selectedServiceId === s.id ? "text-primary-600" : "text-gray-400"}`}>
                      {getServiceIcon(s.category)}
                    </div>
                    <p className={`text-sm font-semibold leading-tight ${selectedServiceId === s.id ? "text-primary-700 dark:text-primary-300" : "text-gray-800 dark:text-gray-200"}`}>
                      {s.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">{s.durationMin} min</span>
                      <span className={`text-xs font-bold ${selectedServiceId === s.id ? "text-primary-600 dark:text-primary-400" : "text-gray-600 dark:text-gray-400"}`}>
                        {s.price > 0 ? `${s.price.toLocaleString("cs-CZ")} Kč` : "Zdarma"}
                      </span>
                    </div>
                    {s.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2">{s.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Therapist filter — shown only after service selected */}
          {selectedServiceId && (
            <div className="card mb-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <User size={16} className="text-gray-400" />
                <label className="text-sm text-gray-600 dark:text-gray-400">Preferovaný terapeut:</label>
                <select
                  value={selectedEmpId ?? ""}
                  onChange={(e) => { setSelectedEmpId(e.target.value ? parseInt(e.target.value) : null); setSelectedDate(null); }}
                  className="input max-w-xs text-sm"
                >
                  <option value="">Kdokoliv</option>
                  {(employees ?? []).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Credit balance bar — shown when a service with price is selected */}
          {selectedService && selectedService.price > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-sm">
              <Wallet size={16} className="text-teal-600 flex-shrink-0" />
              <span className="text-teal-800 dark:text-teal-300">
                Zůstatek: <strong>{creditData ? `${creditData.balance.toLocaleString("cs-CZ")} Kč` : "…"}</strong>
              </span>
              <span className="text-gray-400 dark:text-gray-600">·</span>
              <span className="text-teal-700 dark:text-teal-400">
                Tato služba: <strong>{selectedService.price.toLocaleString("cs-CZ")} Kč</strong>
              </span>
              {creditData && creditData.balance < selectedService.price && (
                <span className="ml-auto text-xs text-orange-600 dark:text-orange-400 font-medium">Nedostatek kreditu</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT: Mini calendar — gated on service selection */}
            <div className={`card ${!selectedServiceId ? "opacity-50 pointer-events-none select-none" : ""}`}>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </h2>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_SHORT.map((d) => (
                  <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map(({ date, isCurrentMonth }) => {
                  const dayInfo = monthDataMap[date];
                  const hasOpen = dayInfo && dayInfo.open_count > 0;
                  const hasFull = dayInfo && dayInfo.open_count === 0 && dayInfo.booked_count > 0;
                  const isPast = date < today;
                  const isSelected = date === selectedDate;
                  const isToday = date === today;

                  return (
                    <button
                      key={date}
                      onClick={() => { if (!isPast) { haptics.light(); setSelectedDate(date); } }}
                      disabled={isPast || !isCurrentMonth}
                      className={`
                        relative h-9 w-full flex flex-col items-center justify-center rounded text-sm transition-colors
                        ${!isCurrentMonth ? "opacity-30" : ""}
                        ${isPast ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                        ${isSelected ? "bg-primary-600 text-white font-bold" : ""}
                        ${isToday && !isSelected ? "ring-2 ring-primary-400 font-semibold" : ""}
                        ${!isSelected && !isPast && isCurrentMonth ? "hover:bg-gray-100 dark:hover:bg-gray-700" : ""}
                      `}
                    >
                      <span>{new Date(date + "T12:00:00").getDate()}</span>
                      {/* Dot indicator */}
                      {hasOpen && !isSelected && (
                        <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-green-500" />
                      )}
                      {hasFull && !isSelected && (
                        <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500" /> Volné sloty
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400" /> Obsazeno
                </div>
              </div>
            </div>

            {/* RIGHT: Time slots for selected day */}
            <div className="card">
              {!selectedServiceId ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Sparkles size={48} className="mb-3 opacity-30" />
                  <p className="text-sm">Nejprve vyberte službu</p>
                </div>
              ) : !selectedDate ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <Calendar size={48} className="mb-3 opacity-30" />
                  <p className="text-sm">Klikněte na den v kalendáři</p>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {new Date(selectedDate + "T12:00:00").toLocaleDateString("cs-CZ", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
                  </h3>

                  {(availableSlots ?? []).length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-gray-400">
                      <AlertCircle size={40} className="mb-2 opacity-40" />
                      <p className="text-sm">Pro tento den nejsou žádné volné termíny.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {(availableSlots ?? []).map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() => { haptics.medium(); setConfirmSlot(slot); }}
                          className="flex flex-col items-center p-3 rounded-lg border-2 border-green-300 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-700 dark:hover:bg-green-900/40 text-green-800 dark:text-green-300 transition-colors"
                        >
                          <Clock size={18} className="mb-1" />
                          <span className="font-bold text-lg">{slot.time}</span>
                          {slot.employee_name && (
                            <span className="text-xs opacity-70 mt-0.5">{slot.employee_name}</span>
                          )}
                          <span className="text-xs mt-1 bg-green-200 dark:bg-green-800 px-2 py-0.5 rounded-full">
                            Rezervovat
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* My upcoming bookings */}
          {upcomingBookings.length > 0 && (
            <div className="card mt-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Moje nadcházející termíny</h2>
              <div className="space-y-2">
                {upcomingBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center">
                        <Calendar size={18} className="text-green-700 dark:text-green-300" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {new Date(b.date + "T12:00:00").toLocaleDateString("cs-CZ", {
                            weekday: "short", day: "numeric", month: "long",
                          })} v {b.time}
                        </p>
                        <p className="text-sm text-gray-500">{b.employee_name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => cancelBooking(b.id)}
                      className="text-sm text-red-600 hover:text-red-800 hover:underline"
                    >
                      Zrušit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Booking success celebration ── */}
        <AnimatePresence>
          {bookedSlot && (
            <motion.div
              className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-white dark:bg-gray-950 p-8 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: { type: "spring", stiffness: 200, damping: 20 } }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            >
              <motion.div
                className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1, transition: { type: "spring", stiffness: 260, damping: 14, delay: 0.1 } }}
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 16, delay: 0.2 } }}
                >
                  <Check size={48} className="text-green-600" strokeWidth={3} />
                </motion.div>
              </motion.div>

              <motion.h2
                className="text-2xl font-bold text-gray-900 dark:text-white mb-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
              >
                Rezervace potvrzena!
              </motion.h2>

              <motion.div
                className="bg-gray-50 dark:bg-gray-900 rounded-2xl px-6 py-4 mt-2 mb-8 w-full max-w-xs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
              >
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{bookedSlot.time}</p>
                <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
                  {new Date(bookedSlot.date + "T12:00:00").toLocaleDateString("cs-CZ", {
                    weekday: "long", day: "numeric", month: "long",
                  })}
                </p>
                {bookedSlot.employee_name && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{bookedSlot.employee_name}</p>
                )}
              </motion.div>

              <motion.button
                className="btn-primary w-full max-w-xs py-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { haptics.light(); setBookedSlot(null); setSelectedDate(null); setConfirmSlot(null); }}
              >
                Hotovo
              </motion.button>
              <motion.button
                className="mt-3 text-sm text-primary-600 hover:underline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.6 } }}
                onClick={() => { haptics.light(); setBookedSlot(null); setSelectedDate(null); setConfirmSlot(null); }}
              >
                Rezervovat další termín
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Confirmation dialog ── */}
        {confirmSlot && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6">
              <div className="text-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-3">
                  <Check size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Potvrdit rezervaci</h3>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 text-center">
                {selectedService && (
                  <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">{selectedService.name}</p>
                )}
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{confirmSlot.time}</p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {new Date(confirmSlot.date + "T12:00:00").toLocaleDateString("cs-CZ", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
                {confirmSlot.employee_name && (
                  <p className="text-sm text-gray-500 mt-1">Terapeut: {confirmSlot.employee_name}</p>
                )}
              </div>

              {/* Credit summary */}
              {selectedService && selectedService.price > 0 && creditData && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-sm mb-4">
                  <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Wallet size={14} className="text-teal-600" /> Zůstatek
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">{creditData.balance.toLocaleString("cs-CZ")} Kč</span>
                  <span className="text-gray-400">→</span>
                  <span className={`font-semibold ${creditData.balance - selectedService.price < 0 ? "text-red-600" : "text-teal-600"}`}>
                    {(creditData.balance - selectedService.price).toLocaleString("cs-CZ")} Kč
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <motion.button
                  onClick={handleBook}
                  disabled={bookingInProgress}
                  className="btn-primary flex-1 py-3"
                  whileTap={{ scale: 0.97 }}
                >
                  {bookingInProgress ? "Rezervuji…" : "Potvrdit rezervaci"}
                </motion.button>
                <button
                  onClick={() => setConfirmSlot(null)}
                  className="btn-secondary flex-1 py-3"
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </RouteGuard>
  );
}
