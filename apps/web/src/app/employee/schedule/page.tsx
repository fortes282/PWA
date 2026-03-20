"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate } from "swr";
import { useState, useCallback, useEffect } from "react";
import { Calendar, Clock, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const DAY_NAMES_FULL = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

interface DaySchedule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
  enabled: boolean;
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

interface SlotRow {
  id: number;
  employee_id: number;
  date: string;
  time: string;
  status: "open" | "booked" | "cancelled";
  client_name?: string;
}

interface TimeOffRow {
  id: number;
  date_from: string;
  date_to: string;
  type: string;
  note: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-800 border-green-200",
  booked: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-gray-100 text-gray-500 border-gray-200 line-through",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Volný",
  booked: "Obsazený",
  cancelled: "Zrušený",
};

const TIME_OFF_TYPES: Record<string, string> = {
  vacation: "Dovolená",
  sick: "Nemoc",
  other: "Jiný důvod",
};

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: string, n: number) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export default function EmployeeSchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"schedule" | "slots" | "timeoff">("schedule");

  // ── Work Schedule state ──
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
    user ? `/work-schedule/${user.id}` : null,
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
    if (!user) return;
    setSavingSchedule(true);
    try {
      const days = scheduleRows.filter((r) => r.enabled).map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
        breakStart: r.breakStart || undefined,
        breakEnd: r.breakEnd || undefined,
      }));
      await api.put(`/work-schedule/${user.id}`, days);
      toast("success", "Pracovní doba uložena");
      mutate(`/work-schedule/${user.id}`);
    } catch {
      toast("error", "Chyba při ukládání");
    } finally {
      setSavingSchedule(false);
    }
  }, [user, scheduleRows, toast]);

  // ── Slots state ──
  const today = toDateStr(new Date());
  const [slotsFrom, setSlotsFrom] = useState(today);
  const [slotsTo, setSlotsTo] = useState(addDays(today, 13));
  const [openSlotsModal, setOpenSlotsModal] = useState(false);
  const [openPeriodFrom, setOpenPeriodFrom] = useState(today);
  const [openPeriodTo, setOpenPeriodTo] = useState(addDays(today, 6));
  const [openingSlots, setOpeningSlots] = useState(false);

  const { data: slotsData, mutate: mutateSlots } = useSWR<SlotRow[]>(
    user ? `/slots?employeeId=${user.id}&from=${slotsFrom}&to=${slotsTo}` : null,
    fetcher
  );

  const openSlots = useCallback(async () => {
    if (!user) return;
    setOpeningSlots(true);
    try {
      const result = await api.post<{ preview: number; created: number; skipped: number }>("/slots/open", {
        employeeId: user.id,
        from: openPeriodFrom,
        to: openPeriodTo,
      });
      toast("success", `Otevřeno ${result.created} nových termínů (celkem ${result.preview} v šabloně)`);
      setOpenSlotsModal(false);
      mutateSlots();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Chyba";
      toast("error", `Chyba: ${msg}`);
    } finally {
      setOpeningSlots(false);
    }
  }, [user, openPeriodFrom, openPeriodTo, toast, mutateSlots]);

  const closeSlot = useCallback(async (slotId: number) => {
    try {
      await api.delete(`/slots/${slotId}`);
      toast("success", "Termín zrušen");
      mutateSlots();
    } catch {
      toast("error", "Chyba při rušení termínu");
    }
  }, [toast, mutateSlots]);

  // ── Time Off state ──
  const [timeOffForm, setTimeOffForm] = useState({
    dateFrom: today,
    dateTo: today,
    type: "vacation",
    note: "",
  });
  const [savingTimeOff, setSavingTimeOff] = useState(false);

  const { data: timeOffData, mutate: mutateTimeOff } = useSWR<TimeOffRow[]>(
    user ? `/time-off-v2/${user.id}` : null,
    fetcher
  );

  const saveTimeOff = useCallback(async () => {
    if (!user) return;
    setSavingTimeOff(true);
    try {
      await api.post("/time-off-v2", {
        employeeId: user.id,
        dateFrom: timeOffForm.dateFrom,
        dateTo: timeOffForm.dateTo,
        type: timeOffForm.type,
        note: timeOffForm.note || undefined,
      });
      toast("success", "Dovolená zadána");
      setTimeOffForm({ dateFrom: today, dateTo: today, type: "vacation", note: "" });
      mutateTimeOff();
    } catch {
      toast("error", "Chyba při zadávání dovolené");
    } finally {
      setSavingTimeOff(false);
    }
  }, [user, timeOffForm, today, toast, mutateTimeOff]);

  const deleteTimeOff = useCallback(async (id: number) => {
    try {
      await api.delete(`/time-off-v2/${id}`);
      toast("success", "Dovolená smazána");
      mutateTimeOff();
    } catch {
      toast("error", "Chyba při mazání");
    }
  }, [toast, mutateTimeOff]);

  // Group slots by date
  const slotsByDate = (slotsData ?? []).reduce<Record<string, SlotRow[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  return (
    <RouteGuard allowedRoles={["EMPLOYEE"]}>
      <Layout>
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Správa termínů</h1>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            {(["schedule", "slots", "timeoff"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {tab === "schedule" && "Pracovní doba"}
                {tab === "slots" && "Termíny"}
                {tab === "timeoff" && "Dovolená"}
              </button>
            ))}
          </div>

          {/* ── Tab: Pracovní doba ── */}
          {activeTab === "schedule" && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Týdenní šablona pracovní doby</h2>
              <p className="text-sm text-gray-500 mb-4">
                Nastavte svůj typický pracovní čas pro každý den. Tato šablona se použije při otvírání termínů.
              </p>
              <div className="space-y-3">
                {scheduleRows.map((row) => (
                  <div
                    key={row.dayOfWeek}
                    className={`p-3 rounded-lg border transition-colors ${
                      row.enabled
                        ? "border-primary-200 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-800"
                        : "border-gray-200 bg-gray-50 dark:bg-gray-800/50 dark:border-gray-700 opacity-60"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 w-28">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) =>
                            setScheduleRows((prev) =>
                              prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, enabled: e.target.checked } : r)
                            )
                          }
                          className="w-4 h-4 accent-primary-600"
                        />
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {DAY_NAMES_FULL[row.dayOfWeek]}
                        </span>
                      </div>
                      {row.enabled && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Práce:</span>
                            <input
                              type="time"
                              value={row.startTime}
                              onChange={(e) =>
                                setScheduleRows((prev) =>
                                  prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, startTime: e.target.value } : r)
                                )
                              }
                              className="input-sm"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              value={row.endTime}
                              onChange={(e) =>
                                setScheduleRows((prev) =>
                                  prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, endTime: e.target.value } : r)
                                )
                              }
                              className="input-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Pauza:</span>
                            <input
                              type="time"
                              value={row.breakStart}
                              onChange={(e) =>
                                setScheduleRows((prev) =>
                                  prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, breakStart: e.target.value } : r)
                                )
                              }
                              className="input-sm"
                            />
                            <span className="text-gray-400">–</span>
                            <input
                              type="time"
                              value={row.breakEnd}
                              onChange={(e) =>
                                setScheduleRows((prev) =>
                                  prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, breakEnd: e.target.value } : r)
                                )
                              }
                              className="input-sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={saveSchedule} disabled={savingSchedule} className="btn-primary">
                  {savingSchedule ? "Ukládám…" : "Uložit pracovní dobu"}
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Termíny ── */}
          {activeTab === "slots" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">Od:</label>
                  <input type="date" value={slotsFrom} onChange={(e) => setSlotsFrom(e.target.value)} className="input-sm" />
                  <label className="text-sm text-gray-600 dark:text-gray-400">Do:</label>
                  <input type="date" value={slotsTo} onChange={(e) => setSlotsTo(e.target.value)} className="input-sm" />
                </div>
                <button onClick={() => setOpenSlotsModal(true)} className="btn-primary flex items-center gap-2">
                  <Plus size={16} />
                  Otevřít termíny
                </button>
              </div>

              {/* Slots by date */}
              {Object.keys(slotsByDate).sort().map((date) => (
                <div key={date} className="card">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
                    {new Date(date + "T12:00:00").toLocaleDateString("cs-CZ", {
                      weekday: "long", day: "numeric", month: "long",
                    })}
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
                        <span className="text-xs opacity-60">({STATUS_LABELS[slot.status]})</span>
                        {slot.status === "open" && (
                          <button
                            onClick={() => closeSlot(slot.id)}
                            className="ml-1 text-red-500 hover:text-red-700"
                            title="Zrušit slot"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(slotsByDate).length === 0 && (
                <div className="card text-center py-12 text-gray-500">
                  Žádné termíny v tomto období. Klikněte &ldquo;Otevřít termíny&rdquo; pro vytvoření.
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Dovolená ── */}
          {activeTab === "timeoff" && (
            <div className="space-y-4">
              <div className="card">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Zadat nepřítomnost</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Od</label>
                    <input
                      type="date"
                      value={timeOffForm.dateFrom}
                      onChange={(e) => setTimeOffForm((f) => ({ ...f, dateFrom: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Do</label>
                    <input
                      type="date"
                      value={timeOffForm.dateTo}
                      onChange={(e) => setTimeOffForm((f) => ({ ...f, dateTo: e.target.value }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Typ</label>
                    <select
                      value={timeOffForm.type}
                      onChange={(e) => setTimeOffForm((f) => ({ ...f, type: e.target.value }))}
                      className="input"
                    >
                      <option value="vacation">Dovolená</option>
                      <option value="sick">Nemocenská</option>
                      <option value="other">Jiný důvod</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Poznámka</label>
                    <input
                      type="text"
                      value={timeOffForm.note}
                      onChange={(e) => setTimeOffForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder="Volitelná poznámka…"
                      className="input"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button onClick={saveTimeOff} disabled={savingTimeOff} className="btn-primary">
                    {savingTimeOff ? "Ukládám…" : "Zadat nepřítomnost"}
                  </button>
                </div>
              </div>

              <div className="card">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Plánované nepřítomnosti</h2>
                {(timeOffData ?? []).length === 0 ? (
                  <p className="text-center py-8 text-gray-500">Žádné plánované nepřítomnosti.</p>
                ) : (
                  <div className="space-y-2">
                    {(timeOffData ?? []).map((toff) => (
                      <div
                        key={toff.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div>
                          <span className="font-medium text-gray-800 dark:text-white">
                            {toff.date_from === toff.date_to ? toff.date_from : `${toff.date_from} → ${toff.date_to}`}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            {TIME_OFF_TYPES[toff.type] ?? toff.type}
                            {toff.note && ` — ${toff.note}`}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteTimeOff(toff.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Smazat"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Modal: Otevřít termíny ── */}
        {openSlotsModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Otevřít termíny</h3>
                <button onClick={() => setOpenSlotsModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Termíny se vytvoří podle vaší pracovní doby. Obědová pauza a dovolená jsou automaticky vynechány.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="label">Od</label>
                  <input
                    type="date"
                    value={openPeriodFrom}
                    onChange={(e) => { setOpenPeriodFrom(e.target.value); }}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Do</label>
                  <input
                    type="date"
                    value={openPeriodTo}
                    onChange={(e) => { setOpenPeriodTo(e.target.value); }}
                    className="input"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={openSlots}
                  disabled={openingSlots}
                  className="btn-primary flex-1"
                >
                  {openingSlots ? "Otvírám…" : "Otevřít termíny"}
                </button>
                <button onClick={() => setOpenSlotsModal(false)} className="btn-secondary flex-1">
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
