"use client";

/**
 * Admin: Schedule management — identical to Reception but with ADMIN role guard.
 * Full control over all therapists' work schedules, time off, and slots.
 */

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useCallback, useEffect } from "react";
import { Calendar, Clock, Plus, Trash2, X, User } from "lucide-react";
import { useToast } from "@/app/components/Toast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface EmployeeUser { id: number; name: string; }

interface WorkScheduleRow {
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
}

interface TimeOffRow {
  id: number;
  date_from: string;
  date_to: string;
  type: string;
  note: string | null;
}

interface ClientUser { id: number; name: string; email: string; }

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(base: string, n: number) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export default function AdminSchedule() {
  const { toast } = useToast();
  const today = toDateStr(new Date());
  const [activeTab, setActiveTab] = useState<"slots" | "schedule" | "timeoff">("slots");
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);

  const { data: employees } = useSWR<EmployeeUser[]>("/users?role=EMPLOYEE", fetcher);
  const emp = employees?.find((e) => e.id === selectedEmpId);

  // ── Schedule ──
  const [scheduleRows, setScheduleRows] = useState<DaySchedule[]>(
    [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d, startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakEnd: "13:00",
      enabled: d >= 1 && d <= 5,
    }))
  );
  const [savingSchedule, setSavingSchedule] = useState(false);

  const { data: workScheduleRaw } = useSWR<WorkScheduleRow[]>(
    selectedEmpId ? `/work-schedule/${selectedEmpId}` : null, fetcher
  );
  useEffect(() => {
    if (workScheduleRaw?.length) {
      setScheduleRows((prev) => prev.map((row) => {
        const f = workScheduleRaw.find((d) => d.day_of_week === row.dayOfWeek);
        return f ? { ...row, startTime: f.start_time, endTime: f.end_time, breakStart: f.break_start ?? "12:00", breakEnd: f.break_end ?? "13:00", enabled: true } : { ...row, enabled: false };
      }));
    }
  }, [workScheduleRaw]);

  const saveSchedule = useCallback(async () => {
    if (!selectedEmpId) return;
    setSavingSchedule(true);
    try {
      const days = scheduleRows.filter((r) => r.enabled).map((r) => ({
        dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime,
        breakStart: r.breakStart || undefined, breakEnd: r.breakEnd || undefined,
      }));
      await api.put(`/work-schedule/${selectedEmpId}`, days);
      toast("success", "Uloženo");
    } catch { toast("error", "Chyba"); }
    finally { setSavingSchedule(false); }
  }, [selectedEmpId, scheduleRows, toast]);

  // ── Slots ──
  const [slotsFrom, setSlotsFrom] = useState(today);
  const [slotsTo, setSlotsTo] = useState(addDays(today, 13));
  const [openSlotsModal, setOpenSlotsModal] = useState(false);
  const [openFrom, setOpenFrom] = useState(today);
  const [openTo, setOpenTo] = useState(addDays(today, 6));
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
    setOpeningSlots(true);
    try {
      const result = await api.post<{ created: number; preview: number }>("/slots/open", { employeeId: selectedEmpId, from: openFrom, to: openTo });
      toast("success", `Otevřeno ${result.created} termínů`);
      setOpenSlotsModal(false);
      mutateSlots();
    } catch { toast("error", "Chyba"); }
    finally { setOpeningSlots(false); }
  }, [selectedEmpId, openFrom, openTo, toast, mutateSlots]);

  const closeSlot = useCallback(async (id: number) => {
    try { await api.delete(`/slots/${id}`); toast("success", "Zrušeno"); mutateSlots(); }
    catch { toast("error", "Chyba"); }
  }, [toast, mutateSlots]);

  const bookForClient = useCallback(async () => {
    if (!bookSlotModal || !bookingClientId) return;
    setBookingInProgress(true);
    try {
      await api.post("/bookings-v2", { slotId: bookSlotModal.id, clientId: bookingClientId, note: bookingNote || undefined });
      toast("success", "Rezervováno");
      setBookSlotModal(null); setBookingClientId(null); setBookingNote("");
      mutateSlots();
    } catch { toast("error", "Chyba"); }
    finally { setBookingInProgress(false); }
  }, [bookSlotModal, bookingClientId, bookingNote, toast, mutateSlots]);

  // ── Time Off ──
  const [timeOffForm, setTimeOffForm] = useState({ dateFrom: today, dateTo: today, type: "vacation", note: "" });
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const { data: timeOffData, mutate: mutateTimeOff } = useSWR<TimeOffRow[]>(
    selectedEmpId ? `/time-off-v2/${selectedEmpId}` : null, fetcher
  );

  const saveTimeOff = useCallback(async () => {
    if (!selectedEmpId) return;
    setSavingTimeOff(true);
    try {
      await api.post("/time-off-v2", { employeeId: selectedEmpId, ...timeOffForm, note: timeOffForm.note || undefined });
      toast("success", "Zadáno");
      setTimeOffForm({ dateFrom: today, dateTo: today, type: "vacation", note: "" });
      mutateTimeOff();
    } catch { toast("error", "Chyba"); }
    finally { setSavingTimeOff(false); }
  }, [selectedEmpId, timeOffForm, today, toast, mutateTimeOff]);

  const deleteTimeOff = useCallback(async (id: number) => {
    try { await api.delete(`/time-off-v2/${id}`); toast("success", "Smazáno"); mutateTimeOff(); }
    catch { toast("error", "Chyba"); }
  }, [toast, mutateTimeOff]);

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="text-primary-600" size={24} />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Správa termínů — Admin</h1>
          </div>

          <div className="card mb-4">
            <label className="label">Vyberte terapeuta</label>
            <select
              value={selectedEmpId ?? ""}
              onChange={(e) => setSelectedEmpId(e.target.value ? parseInt(e.target.value) : null)}
              className="input max-w-xs"
            >
              <option value="">— Vyberte terapeuta —</option>
              {(employees ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {!selectedEmpId ? (
            <div className="card text-center py-16 text-gray-500">
              <User size={48} className="mx-auto mb-4 opacity-30" />
              <p>Vyberte terapeuta.</p>
            </div>
          ) : (
            <>
              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                {(["slots", "schedule", "timeoff"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    {tab === "slots" && "Termíny"}
                    {tab === "schedule" && "Pracovní doba"}
                    {tab === "timeoff" && "Nepřítomnost"}
                  </button>
                ))}
              </div>

              {activeTab === "slots" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <input type="date" value={slotsFrom} onChange={(e) => setSlotsFrom(e.target.value)} className="input-sm" />
                      <span className="text-gray-400">–</span>
                      <input type="date" value={slotsTo} onChange={(e) => setSlotsTo(e.target.value)} className="input-sm" />
                    </div>
                    <button onClick={() => setOpenSlotsModal(true)} className="btn-primary flex items-center gap-2">
                      <Plus size={16} /> Otevřít termíny
                    </button>
                  </div>

                  {Object.keys(slotsByDate).sort().map((date) => (
                    <div key={date} className="card">
                      <h3 className="font-semibold mb-3">
                        {new Date(date + "T12:00:00").toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {slotsByDate[date].map((slot) => (
                          <div key={slot.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${STATUS_COLORS[slot.status]}`}>
                            <Clock size={14} />
                            <span>{slot.time}</span>
                            {slot.client_name && <span className="text-xs opacity-75">— {slot.client_name}</span>}
                            {slot.status === "open" && (
                              <>
                                <button onClick={() => setBookSlotModal(slot)} className="text-blue-600 hover:text-blue-800 text-xs underline">Rezervovat</button>
                                <button onClick={() => closeSlot(slot.id)} className="text-red-500 hover:text-red-700"><X size={12} /></button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(slotsByDate).length === 0 && (
                    <div className="card text-center py-12 text-gray-500">Žádné termíny.</div>
                  )}
                </div>
              )}

              {activeTab === "schedule" && (
                <div className="card">
                  <h2 className="text-lg font-semibold mb-4">Pracovní doba — {emp?.name}</h2>
                  <div className="space-y-3">
                    {scheduleRows.map((row) => (
                      <div key={row.dayOfWeek} className={`p-3 rounded-lg border ${row.enabled ? "border-primary-200 bg-primary-50 dark:bg-primary-900/20" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2 w-28">
                            <input type="checkbox" checked={row.enabled}
                              onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, enabled: e.target.checked } : r))}
                              className="w-4 h-4 accent-primary-600" />
                            <span className="font-medium">{DAY_NAMES_FULL[row.dayOfWeek]}</span>
                          </div>
                          {row.enabled && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Práce:</span>
                                <input type="time" value={row.startTime} onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, startTime: e.target.value } : r))} className="input-sm" />
                                <span className="text-gray-400">–</span>
                                <input type="time" value={row.endTime} onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, endTime: e.target.value } : r))} className="input-sm" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Pauza:</span>
                                <input type="time" value={row.breakStart} onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, breakStart: e.target.value } : r))} className="input-sm" />
                                <span className="text-gray-400">–</span>
                                <input type="time" value={row.breakEnd} onChange={(e) => setScheduleRows((prev) => prev.map((r) => r.dayOfWeek === row.dayOfWeek ? { ...r, breakEnd: e.target.value } : r))} className="input-sm" />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={saveSchedule} disabled={savingSchedule} className="btn-primary">
                      {savingSchedule ? "Ukládám…" : "Uložit"}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "timeoff" && (
                <div className="space-y-4">
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Zadat nepřítomnost — {emp?.name}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div><label className="label">Od</label><input type="date" value={timeOffForm.dateFrom} onChange={(e) => setTimeOffForm((f) => ({ ...f, dateFrom: e.target.value }))} className="input" /></div>
                      <div><label className="label">Do</label><input type="date" value={timeOffForm.dateTo} onChange={(e) => setTimeOffForm((f) => ({ ...f, dateTo: e.target.value }))} className="input" /></div>
                      <div><label className="label">Typ</label>
                        <select value={timeOffForm.type} onChange={(e) => setTimeOffForm((f) => ({ ...f, type: e.target.value }))} className="input">
                          <option value="vacation">Dovolená</option><option value="sick">Nemocenská</option><option value="other">Jiný</option>
                        </select>
                      </div>
                      <div><label className="label">Poznámka</label><input type="text" value={timeOffForm.note} onChange={(e) => setTimeOffForm((f) => ({ ...f, note: e.target.value }))} className="input" /></div>
                    </div>
                    <div className="mt-4 flex justify-end"><button onClick={saveTimeOff} disabled={savingTimeOff} className="btn-primary">{savingTimeOff ? "…" : "Zadat"}</button></div>
                  </div>
                  <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Záznamy</h2>
                    {(timeOffData ?? []).length === 0 ? <p className="text-center py-8 text-gray-500">Žádné záznamy.</p> : (
                      <div className="space-y-2">
                        {(timeOffData ?? []).map((toff) => (
                          <div key={toff.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div>
                              <span className="font-medium">{toff.date_from === toff.date_to ? toff.date_from : `${toff.date_from} → ${toff.date_to}`}</span>
                              <span className="ml-2 text-sm text-gray-500">{TIME_OFF_TYPES[toff.type] ?? toff.type}{toff.note && ` — ${toff.note}`}</span>
                            </div>
                            <button onClick={() => deleteTimeOff(toff.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {openSlotsModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Otevřít termíny — {emp?.name}</h3>
                <button onClick={() => setOpenSlotsModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <div><label className="label">Od</label><input type="date" value={openFrom} onChange={(e) => setOpenFrom(e.target.value)} className="input" /></div>
                <div><label className="label">Do</label><input type="date" value={openTo} onChange={(e) => setOpenTo(e.target.value)} className="input" /></div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={openSlots} disabled={openingSlots} className="btn-primary flex-1">{openingSlots ? "Otvírám…" : "Otevřít"}</button>
                <button onClick={() => setOpenSlotsModal(false)} className="btn-secondary flex-1">Zrušit</button>
              </div>
            </div>
          </div>
        )}

        {bookSlotModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Rezervovat termín</h3>
                <button onClick={() => setBookSlotModal(null)}><X size={20} /></button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Slot: <strong>{bookSlotModal.date} v {bookSlotModal.time}</strong></p>
              <div className="space-y-3">
                <div>
                  <label className="label">Klient</label>
                  <select value={bookingClientId ?? ""} onChange={(e) => setBookingClientId(e.target.value ? parseInt(e.target.value) : null)} className="input">
                    <option value="">— Vyberte klienta —</option>
                    {(clientsData ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                  </select>
                </div>
                <div><label className="label">Poznámka</label><input type="text" value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} className="input" /></div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={bookForClient} disabled={bookingInProgress || !bookingClientId} className="btn-primary flex-1">{bookingInProgress ? "…" : "Rezervovat"}</button>
                <button onClick={() => setBookSlotModal(null)} className="btn-secondary flex-1">Zrušit</button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </RouteGuard>
  );
}
