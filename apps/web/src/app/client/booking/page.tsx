"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate as globalMutate } from "swr";
import { useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Check, Clock, User, Calendar, AlertCircle } from "lucide-react";
// useAuth is available if needed for future personalization
// import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

// Months in Czech
const MONTH_NAMES = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];
const DAY_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

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

  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmSlot, setConfirmSlot] = useState<SlotRow | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

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
    try {
      await api.post("/bookings-v2", { slotId: confirmSlot.id });
      toast("success", "Termín byl úspěšně rezervován!");
      setConfirmSlot(null);
      // Refresh data
      globalMutate(availableKey);
      globalMutate(monthKey);
      globalMutate("/bookings-v2/my");
    } catch (e: unknown) {
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

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rezervace termínu</h1>
          </div>

          {/* Therapist selector */}
          <div className="card mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <User size={18} className="text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Terapeut:</label>
              <select
                value={selectedEmpId ?? ""}
                onChange={(e) => { setSelectedEmpId(e.target.value ? parseInt(e.target.value) : null); setSelectedDate(null); }}
                className="input max-w-xs"
              >
                <option value="">Všichni terapeuté</option>
                {(employees ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT: Mini calendar */}
            <div className="card">
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
                      onClick={() => !isPast && setSelectedDate(date)}
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
              {!selectedDate ? (
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
                          onClick={() => setConfirmSlot(slot)}
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

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-center">
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

              <div className="flex gap-3">
                <button
                  onClick={handleBook}
                  disabled={bookingInProgress}
                  className="btn-primary flex-1 py-3"
                >
                  {bookingInProgress ? "Rezervuji…" : "Potvrdit rezervaci"}
                </button>
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
