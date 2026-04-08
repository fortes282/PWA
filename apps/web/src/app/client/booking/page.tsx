"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate as globalMutate } from "swr";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Heart,
  Activity,
  MessageCircle,
  Wallet,
} from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { haptics } from "@/lib/haptics";
import Link from "next/link";
import {
  parseClientSelfCancelFromPublicSettings,
  clientMayUseSelfCancelForBookingV2,
} from "@/lib/client-cancel-ui";

const fetcher = (url: string) => api.get<any>(url);

// Czech month names and day abbreviations
const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];
const DAY_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
const STEP_LABELS = ["Služba", "Datum", "Čas", "Potvrzení"];

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

function getMonthCalendarDays(year: number, month: number): Array<{ date: string; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: Array<{ date: string; isCurrentMonth: boolean }> = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: toDateStr(d), isCurrentMonth: false });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d);
    days.push({ date: toDateStr(dt), isCurrentMonth: true });
  }

  while (days.length % 7 !== 0) {
    const last = new Date(days[days.length - 1].date + "T12:00:00");
    last.setDate(last.getDate() + 1);
    days.push({ date: toDateStr(last), isCurrentMonth: false });
  }

  return days;
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function generateIcs(date: string, time: string, serviceName: string) {
  const start = new Date(date + "T" + time + ":00");
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1h default
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${serviceName} – Přístav Radosti`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
}

// Slide variants for step transitions
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

export default function ClientBooking() {
  const { toast } = useToast();
  const shouldReduce = useReducedMotion();
  const today = toDateStr(new Date());

  // Step state (0=service, 1=date, 2=time, 3=confirm)
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(null);

  // Booking state
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Offline
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    setIsOffline(!navigator.onLine);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // ── Data fetching ──
  const { data: services } = useSWR<Service[]>("/services", fetcher);
  const { data: creditData } = useSWR<{ balance: number }>("/credits/balance", fetcher);
  const { data: employees } = useSWR<EmployeeUser[]>("/users?role=EMPLOYEE", fetcher);

  const monthKey = selectedEmpId
    ? `/slots/months?employeeId=${selectedEmpId}&year=${viewYear}&month=${viewMonth + 1}`
    : `/slots/months?year=${viewYear}&month=${viewMonth + 1}`;
  const { data: monthData } = useSWR<MonthDayInfo[]>(
    currentStep >= 1 ? monthKey : null,
    fetcher
  );

  const availableKey = selectedDate
    ? `/slots/available?date=${selectedDate}${selectedEmpId ? `&employeeId=${selectedEmpId}` : ""}`
    : null;
  const { data: availableSlots } = useSWR<SlotRow[]>(availableKey, fetcher);

  const { data: myBookings } = useSWR<BookingV2[]>("/bookings-v2/my", fetcher);
  const { data: publicSettings } = useSWR<Record<string, string>>("/system-settings/public", fetcher);
  const cancelPolicy = parseClientSelfCancelFromPublicSettings(publicSettings);

  const monthDataMap = useMemo(() => {
    const m: Record<string, MonthDayInfo> = {};
    for (const d of monthData ?? []) m[d.date] = d;
    return m;
  }, [monthData]);

  const calendarDays = useMemo(
    () => getMonthCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const upcomingBookings = useMemo(
    () =>
      (myBookings ?? [])
        .filter((b) => b.status === "confirmed" && b.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [myBookings, today]
  );

  // ── Navigation helpers ──
  const goToStep = useCallback((next: number) => {
    setStepDirection(next > currentStep ? 1 : -1);
    setCurrentStep(next);
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

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

  // ── Booking submit ──
  const handleBook = useCallback(async () => {
    if (!selectedSlot) return;
    setBookingInProgress(true);
    haptics.medium();
    try {
      await api.post("/bookings-v2", {
        slotId: selectedSlot.id,
        serviceId: selectedService?.id,
      });
      haptics.success();
      globalMutate(availableKey);
      globalMutate(monthKey);
      globalMutate("/bookings-v2/my");
      globalMutate("/credits/balance");
      globalMutate("/appointments/upcoming");
      setIsSuccess(true);
    } catch (e: unknown) {
      haptics.error();
      const msg = e instanceof Error ? e.message : "Nepodařilo se rezervovat termín.";
      toast("error", msg);
    } finally {
      setBookingInProgress(false);
    }
  }, [selectedSlot, availableKey, monthKey, toast]);

  const resetFlow = useCallback(() => {
    setIsSuccess(false);
    setCurrentStep(0);
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedEmpId(null);
  }, []);

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

  // ── Success screen ──
  if (isSuccess && selectedSlot && selectedDate) {
    return (
      <RouteGuard allowedRoles={["CLIENT"]}>
        <Layout>
          <div className="max-w-lg mx-auto p-4">
            <motion.div
              className="text-center py-10"
              initial={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <img src="/brand/success-booking.svg" alt="" className="w-32 h-32 mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Termín rezervován!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {formatDateLong(selectedDate)} v {selectedSlot.time}
              </p>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-left space-y-2 mb-6">
                {selectedService && (
                  <p className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Služba: </span>
                    <strong className="text-gray-900 dark:text-gray-100">{selectedService.name}</strong>
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Datum: </span>
                  <strong className="text-gray-900 dark:text-gray-100">{formatDateLong(selectedDate)}</strong>
                </p>
                <p className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Čas: </span>
                  <strong className="text-gray-900 dark:text-gray-100">{selectedSlot.time}</strong>
                </p>
                {selectedSlot.employee_name && (
                  <p className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Terapeut: </span>
                    <strong className="text-gray-900 dark:text-gray-100">{selectedSlot.employee_name}</strong>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <a
                  href={generateIcs(
                    selectedDate,
                    selectedSlot.time,
                    selectedService?.name ?? "Termín"
                  )}
                  download="termin.ics"
                  className="block w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium text-sm text-center"
                >
                  📅 Přidat do kalendáře (.ics)
                </a>
                <Link
                  href="/client"
                  className="block w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm text-center transition-colors"
                >
                  Zpět na přehled
                </Link>
                <button
                  onClick={resetFlow}
                  className="block w-full py-2 text-sm text-primary dark:text-primary-400 hover:underline"
                >
                  Rezervovat další termín
                </button>
              </div>
            </motion.div>
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-lg mx-auto p-4">
          {/* Page title */}
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-primary" size={22} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Rezervace termínu</h1>
          </div>

          {/* Offline banner */}
          {isOffline && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle size={16} />
              <span>Jste offline. Rezervace bude odeslána po obnovení připojení.</span>
            </div>
          )}

          {/* ── Progress Stepper ── */}
          <div className="flex items-center justify-between mb-6 px-2">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                      ${currentStep > i
                        ? "bg-teal-600 text-white"
                        : currentStep === i
                          ? "bg-teal-600 text-white ring-4 ring-teal-100 dark:ring-teal-900"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                      }`}
                  >
                    {currentStep > i ? <Check size={14} /> : i + 1}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      currentStep >= i
                        ? "text-teal-600 dark:text-teal-400"
                        : "text-gray-400 dark:text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 mb-4 transition-colors rounded-full
                      ${currentStep > i
                        ? "bg-teal-600"
                        : "bg-gray-200 dark:bg-gray-700"
                      }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Back button (steps 1-3) */}
          {currentStep > 0 && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-sm text-primary dark:text-primary-400 hover:underline mb-4"
            >
              <ChevronLeft size={16} />
              {currentStep === 1 && "Zpět na výběr služby"}
              {currentStep === 2 && "Zpět na výběr data"}
              {currentStep === 3 && "Zpět na výběr času"}
            </button>
          )}

          {/* ── Step Content ── */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
              {/* ── STEP 0: Service selection ── */}
              {currentStep === 0 && (
                <motion.div
                  key="step-service"
                  custom={stepDirection}
                  variants={shouldReduce ? {} : slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 360, damping: 32 }}
                >
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Vyberte službu
                  </h2>

                  {!services ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 rounded-xl skeleton-shimmer" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(services ?? []).filter((s) => s.isActive).map((s) => (
                        <motion.button
                          key={s.id}
                          onClick={() => {
                            haptics.light();
                            setSelectedService(s);
                            setSelectedDate(null);
                            setSelectedSlot(null);
                            goToStep(1);
                          }}
                          whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-colors
                            ${selectedService?.id === s.id
                              ? "border-teal-500 bg-teal-50 dark:bg-teal-900/30"
                              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-teal-300 dark:hover:border-teal-700"
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 ${selectedService?.id === s.id ? "text-teal-600 dark:text-teal-400" : "text-gray-400"}`}>
                                {getServiceIcon(s.category)}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>
                                {s.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                    {s.description}
                                  </p>
                                )}
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                  <Clock size={12} className="inline mr-1" />
                                  {s.durationMin} min
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-teal-600 dark:text-teal-400 ml-3 whitespace-nowrap">
                              {s.price > 0 ? `${s.price.toLocaleString("cs-CZ")} Kč` : "Zdarma"}
                            </span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── STEP 1: Date selection (calendar) ── */}
              {currentStep === 1 && (
                <motion.div
                  key="step-date"
                  custom={stepDirection}
                  variants={shouldReduce ? {} : slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 360, damping: 32 }}
                >
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    Vyberte datum
                    {selectedService && (
                      <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                        — {selectedService.name}
                      </span>
                    )}
                  </h2>

                  {/* Therapist filter */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 py-2">
                    <User size={15} className="text-gray-400" />
                    <label className="text-sm text-gray-600 dark:text-gray-400">Terapeut:</label>
                    <select
                      value={selectedEmpId ?? ""}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value ? parseInt(e.target.value) : null);
                        setSelectedDate(null);
                      }}
                      className="input text-sm max-w-[200px]"
                    >
                      <option value="">Kdokoliv</option>
                      {(employees ?? []).map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Credit info */}
                  {selectedService && selectedService.price > 0 && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-sm">
                      <Wallet size={15} className="text-teal-600 flex-shrink-0" />
                      <span className="text-teal-800 dark:text-teal-300">
                        Zůstatek: <strong>{creditData ? `${creditData.balance.toLocaleString("cs-CZ")} Kč` : "…"}</strong>
                      </span>
                      <span className="text-gray-300 dark:text-gray-400">·</span>
                      <span className="text-teal-700 dark:text-teal-400">
                        Cena: <strong>{selectedService.price.toLocaleString("cs-CZ")} Kč</strong>
                      </span>
                      {creditData && creditData.balance < selectedService.price && (
                        <span className="ml-auto text-xs text-orange-600 dark:text-orange-400 font-medium">
                          Nedostatek kreditu
                        </span>
                      )}
                    </div>
                  )}

                  {/* Calendar */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-3">
                      <motion.button
                        onClick={prevMonth}
                        whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Předchozí měsíc"
                      >
                        <ChevronLeft size={22} />
                      </motion.button>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.h3
                          key={`${viewYear}-${viewMonth}`}
                          className="text-lg font-bold text-gray-900 dark:text-white select-none"
                          initial={shouldReduce ? undefined : { opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={shouldReduce ? undefined : { opacity: 0, x: -12 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        >
                          {MONTH_NAMES[viewMonth]} {viewYear}
                        </motion.h3>
                      </AnimatePresence>
                      <motion.button
                        onClick={nextMonth}
                        whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Další měsíc"
                      >
                        <ChevronRight size={22} />
                      </motion.button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 mb-1">
                      {DAY_SHORT.map((d) => (
                        <div key={d} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-1.5 uppercase tracking-wide">{d}</div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map(({ date, isCurrentMonth }) => {
                        const dayInfo = monthDataMap[date];
                        const hasOpen = dayInfo && dayInfo.open_count > 0;
                        const isPast = date < today;
                        const isSelected = date === selectedDate;
                        const isToday = date === today;

                        // Calculate occupancy percentage
                        const occupancyPct = dayInfo && dayInfo.total > 0
                          ? Math.round((dayInfo.booked_count / dayInfo.total) * 100)
                          : dayInfo && dayInfo.total === 0 ? -1 : -1; // -1 = no data
                        const hasData = dayInfo != null && dayInfo.total > 0;
                        const isFull = hasData && occupancyPct === 100;

                        // Color-code by occupancy
                        const getOccupancyStyles = () => {
                          if (!isCurrentMonth || isPast) return "";
                          if (!hasData) return "bg-gray-50 dark:bg-gray-800/50"; // no slots at all
                          if (isFull) return "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60"; // 100%
                          if (occupancyPct > 80) return "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800/60"; // 81-99%
                          if (occupancyPct > 50) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60"; // 51-80%
                          return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/60"; // 0-50%
                        };

                        const getOccupancyTextColor = () => {
                          if (!hasData || !isCurrentMonth || isPast) return "text-gray-400 dark:text-gray-600";
                          if (isFull) return "text-red-500 dark:text-red-400";
                          if (occupancyPct > 80) return "text-orange-500 dark:text-orange-400";
                          if (occupancyPct > 50) return "text-amber-600 dark:text-amber-400";
                          return "text-green-600 dark:text-green-400";
                        };

                        const isClickable = !isPast && isCurrentMonth && hasOpen && !isFull;

                        return (
                          <motion.button
                            key={date}
                            onClick={() => {
                              if (isClickable) {
                                haptics.light();
                                setSelectedDate(date);
                                setSelectedSlot(null);
                                goToStep(2);
                              }
                            }}
                            disabled={!isClickable}
                            whileTap={isClickable && !shouldReduce ? { scale: 0.92 } : undefined}
                            transition={{ type: "spring", stiffness: 500, damping: 22 }}
                            className={`
                              relative flex flex-col items-center justify-center rounded-lg border text-sm transition-all
                              min-h-[48px] min-w-[44px]
                              ${!isCurrentMonth ? "opacity-20 border-transparent" : ""}
                              ${isPast && isCurrentMonth ? "opacity-35 cursor-not-allowed border-transparent" : ""}
                              ${!isPast && isCurrentMonth && !isSelected ? getOccupancyStyles() : ""}
                              ${isSelected
                                ? "bg-teal-600 dark:bg-teal-500 text-white font-bold border-teal-600 dark:border-teal-500 shadow-md shadow-teal-600/25"
                                : ""
                              }
                              ${isToday && !isSelected
                                ? "ring-2 ring-teal-400 dark:ring-teal-500 ring-offset-1 dark:ring-offset-gray-900 font-semibold"
                                : ""
                              }
                              ${isClickable && !isSelected
                                ? "cursor-pointer hover:shadow-sm hover:scale-[1.04] active:scale-95"
                                : ""
                              }
                              ${isFull && isCurrentMonth && !isPast ? "cursor-not-allowed" : ""}
                              ${!isCurrentMonth || (isPast && isCurrentMonth) ? "border-transparent" : ""}
                            `}
                          >
                            <span className={`text-[13px] leading-tight font-medium ${isSelected ? "text-white" : ""}`}>
                              {new Date(date + "T12:00:00").getDate()}
                            </span>
                            {/* Occupancy percentage */}
                            {isCurrentMonth && !isPast && hasData && !isSelected && (
                              <span className={`text-[9px] leading-none font-semibold mt-0.5 ${getOccupancyTextColor()}`}>
                                {isFull ? "plno" : `${100 - occupancyPct}%`}
                              </span>
                            )}
                            {/* Selected state: show availability text */}
                            {isSelected && hasData && (
                              <span className="text-[9px] leading-none font-medium mt-0.5 text-teal-100">
                                {isFull ? "plno" : `${dayInfo!.open_count} vol.`}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30" />
                        <span>Volno</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30" />
                        <span>Plní se</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30" />
                        <span>Skoro plno</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40" />
                        <span>Obsazeno</span>
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[9px] text-green-600 dark:text-green-400 font-semibold">73%</span>
                        <span>= volných</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── STEP 2: Time selection ── */}
              {currentStep === 2 && (
                <motion.div
                  key="step-time"
                  custom={stepDirection}
                  variants={shouldReduce ? {} : slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 360, damping: 32 }}
                >
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                    Vyberte čas
                  </h2>
                  {selectedDate && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {formatDateLong(selectedDate)}
                    </p>
                  )}

                  {!availableSlots ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-12 rounded-xl skeleton-shimmer" />
                      ))}
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-gray-400">
                      <AlertCircle size={40} className="mb-2 opacity-40" />
                      <p className="text-sm">Pro tento den nejsou žádné volné termíny.</p>
                      <button
                        onClick={goBack}
                        className="mt-4 text-sm text-primary dark:text-primary-400 hover:underline"
                      >
                        Vybrat jiný den
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <motion.button
                          key={slot.id}
                          onClick={() => {
                            haptics.medium();
                            setSelectedSlot(slot);
                            goToStep(3);
                          }}
                          whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-colors flex flex-col items-center gap-0.5
                            ${selectedSlot?.id === slot.id
                              ? "border-teal-500 bg-teal-600 text-white"
                              : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30"
                            }`}
                        >
                          <span>{slot.time}</span>
                          {slot.employee_name && (
                            <span className="text-[10px] opacity-70 truncate max-w-full px-1">{slot.employee_name}</span>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── STEP 3: Confirmation ── */}
              {currentStep === 3 && (
                <motion.div
                  key="step-confirm"
                  custom={stepDirection}
                  variants={shouldReduce ? {} : slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 360, damping: 32 }}
                >
                  <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">
                    Potvrzení rezervace
                  </h2>

                  {/* Summary card */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2 mb-4">
                    {selectedService && (
                      <p className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Služba: </span>
                        <strong className="text-gray-900 dark:text-gray-100">{selectedService.name}</strong>
                      </p>
                    )}
                    {selectedDate && (
                      <p className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Datum: </span>
                        <strong className="text-gray-900 dark:text-gray-100">{formatDateLong(selectedDate)}</strong>
                      </p>
                    )}
                    {selectedSlot && (
                      <p className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Čas: </span>
                        <strong className="text-gray-900 dark:text-gray-100">{selectedSlot.time}</strong>
                      </p>
                    )}
                    {selectedSlot?.employee_name && (
                      <p className="text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Terapeut: </span>
                        <strong className="text-gray-900 dark:text-gray-100">{selectedSlot.employee_name}</strong>
                      </p>
                    )}

                    {selectedService && selectedService.price > 0 && (
                      <>
                        <hr className="border-gray-200 dark:border-gray-700" />
                        <p className="text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Zůstatek kreditu: </span>
                          <strong className="text-gray-900 dark:text-gray-100">
                            {creditData ? `${creditData.balance.toLocaleString("cs-CZ")} Kč` : "…"}
                          </strong>
                        </p>
                        <p className="text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Cena služby: </span>
                          <strong className="text-gray-900 dark:text-gray-100">
                            {selectedService.price.toLocaleString("cs-CZ")} Kč
                          </strong>
                        </p>
                        {creditData && creditData.balance < selectedService.price && (
                          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium flex items-center gap-1">
                            <AlertCircle size={14} />
                            Nedostatek kreditu pro tuto rezervaci.
                          </p>
                        )}
                        {creditData && creditData.balance >= selectedService.price && (
                          <p className="text-sm text-teal-600 dark:text-teal-400">
                            Po rezervaci:{" "}
                            <strong>
                              {(creditData.balance - selectedService.price).toLocaleString("cs-CZ")} Kč
                            </strong>
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <motion.button
                    onClick={handleBook}
                    disabled={bookingInProgress}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold transition-colors"
                  >
                    {bookingInProgress ? "Rezervuji…" : "Potvrdit rezervaci"}
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Upcoming bookings (visible on step 0) ── */}
          {currentStep === 0 && upcomingBookings.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Moje nadcházející rezervace
              </h2>
              <div className="space-y-2">
                {upcomingBookings.map((b) => {
                  const mayCancel = clientMayUseSelfCancelForBookingV2(cancelPolicy, b.date, b.time);
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center flex-shrink-0">
                          <Calendar size={16} className="text-green-700 dark:text-green-300" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(b.date + "T12:00:00").toLocaleDateString("cs-CZ", {
                              weekday: "short",
                              day: "numeric",
                              month: "long",
                            })}{" "}
                            v {b.time}
                          </p>
                          <p className="text-xs text-gray-500">{b.employee_name}</p>
                          {!mayCancel && cancelPolicy.allowed && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Online zrušení nedostupné — recepce.
                            </p>
                          )}
                          {!cancelPolicy.allowed && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Zrušení přes recepci.</p>
                          )}
                        </div>
                      </div>
                      {mayCancel && (
                        <button
                          type="button"
                          onClick={() => cancelBooking(b.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline ml-2 shrink-0"
                        >
                          Zrušit
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
