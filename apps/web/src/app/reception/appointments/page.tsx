"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Filter, CheckCircle, XCircle, Clock, Search, CalendarClock, Video } from "lucide-react";
import Link from "next/link";
import MiniCalendar from "@/components/MiniCalendar";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  CANCELLED: "Zrušeno",
  COMPLETED: "Dokončeno",
  NO_SHOW: "No-show",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "badge-yellow",
  CONFIRMED: "badge-green",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  NO_SHOW: "bg-orange-100 text-orange-700",
};

export default function ReceptionAppointments() {
  const shouldReduce = useReducedMotion();
  const { data: appointments, mutate } = useSWR("/appointments", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);
  const { data: employees } = useSWR("/employees", fetcher);
  const { toast } = useToast();

  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterNotes, setFilterNotes] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  const [newForm, setNewForm] = useState({
    clientId: "", employeeId: "", serviceId: "", startTime: "", notes: "", clientNote: "", isOnline: false,
  });
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string>("");

  const [recurrenceApptId, setRecurrenceApptId] = useState<number | null>(null);
  const [recurrenceRule, setRecurrenceRule] = useState<string>("WEEKLY");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>("");
  const [recurrenceResult, setRecurrenceResult] = useState<string | null>(null);
  const [recurrenceLoading, setRecurrenceLoading] = useState(false);
  const { data: services } = useSWR("/services", fetcher);
  const { data: templates } = useSWR<any[]>("/appointment-templates", fetcher);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  const filtered = (appointments ?? []).filter((a: any) => {
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterDate && !a.startTime.startsWith(filterDate)) return false;
    if (filterClient) {
      const clientName = (clientMap[a.clientId] ?? "").toLowerCase();
      if (!clientName.includes(filterClient.toLowerCase())) return false;
    }
    if (filterNotes && !(a.notes ?? "").toLowerCase().includes(filterNotes.toLowerCase())) return false;
    if (filterEmployee) {
      const empName = (employeeMap[a.employeeId] ?? "").toLowerCase();
      if (!empName.includes(filterEmployee.toLowerCase())) return false;
    }
    return true;
  }).sort((a: any, b: any) => b.startTime.localeCompare(a.startTime));

  const handleStatusChange = async (id: number, status: string) => {
    haptics.medium();
    await api.patch(`/appointments/${id}`, { status });
    mutate();
  };

  const handleActivate = async (id: number) => {
    haptics.medium();
    await api.post(`/appointments/${id}/activate`, {});
    mutate();
  };

  const handleConfirm = async (id: number) => {
    haptics.medium();
    await api.post(`/appointments/${id}/confirm`, {});
    mutate();
  };

  const handleRecurrenceSubmit = async () => {
    if (!recurrenceApptId) return;
    haptics.medium();
    setRecurrenceLoading(true);
    setRecurrenceResult(null);
    try {
      const payload: Record<string, unknown> = { rule: recurrenceRule };
      if (recurrenceEndDate) payload.endDate = recurrenceEndDate;
      const result = await api.post<{ created: number; parentId: number; appointments: number[] }>(
        `/appointments/${recurrenceApptId}/recurrence`,
        payload
      );
      haptics.success();
      setRecurrenceResult(`Vytvořeno ${result.created} opakujících se termínů`);
      mutate();
    } catch {
      setRecurrenceResult("Chyba při vytváření opakování");
    } finally {
      setRecurrenceLoading(false);
    }
  };

  const handleReschedule = async (id: number, serviceId: number) => {
    if (!rescheduleTime) return;
    haptics.medium();
    const svc = (services ?? []).find((s: any) => s.id === serviceId);
    const start = new Date(rescheduleTime);
    const end = new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000);
    await api.patch(`/appointments/${id}`, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    haptics.success();
    setRescheduleId(null);
    setRescheduleTime("");
    mutate();
  };

  const handleNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newTime) {
      toast("error", "Vyberte datum a čas termínu.");
      return;
    }
    const svc = services?.find((s: any) => s.id === parseInt(newForm.serviceId));
    const start = new Date(`${newDate}T${newTime}`);
    const end = new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000);
    try {
      await api.post("/appointments", {
        clientId: parseInt(newForm.clientId),
        employeeId: parseInt(newForm.employeeId),
        serviceId: parseInt(newForm.serviceId),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: newForm.notes || undefined,
        clientNote: newForm.clientNote || undefined,
        price: svc?.price,
        isOnline: newForm.isOnline,
      });
      haptics.success();
      toast("success", "Termín byl úspěšně vytvořen.");
      setShowNewForm(false);
      setNewDate("");
      setNewTime("");
      setNewForm({ clientId: "", employeeId: "", serviceId: "", startTime: "", notes: "", clientNote: "", isOnline: false });
      mutate();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Chyba při vytváření termínu.");
    }
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        {/* Recurrence modal */}
        <AnimatePresence>
          {recurrenceApptId !== null && (
            <motion.div
              key="recurrence-backdrop"
              initial={shouldReduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
              onClick={(e) => { if (e.target === e.currentTarget) { setRecurrenceApptId(null); setRecurrenceResult(null); } }}
            >
              <motion.div
                initial={shouldReduce ? false : { opacity: 0, scale: 0.93, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 12 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-4"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Opakovat termín</h2>
                {recurrenceResult ? (
                  <div className="space-y-4">
                    <p className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">{recurrenceResult}</p>
                    <motion.button
                      onClick={() => { haptics.light(); setRecurrenceApptId(null); setRecurrenceResult(null); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary w-full"
                    >
                      Zavřít
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="label">Frekvence opakování</label>
                      <select
                        className="input"
                        value={recurrenceRule}
                        onChange={(e) => setRecurrenceRule(e.target.value)}
                      >
                        <option value="WEEKLY">Týdně</option>
                        <option value="BIWEEKLY">Každé 2 týdny</option>
                        <option value="MONTHLY">Měsíčně</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Konec opakování (volitelné)</label>
                      <input
                        type="date"
                        className="input"
                        value={recurrenceEndDate}
                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <motion.button
                        onClick={() => { haptics.light(); setRecurrenceApptId(null); setRecurrenceResult(null); }}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-secondary"
                      >
                        Zrušit
                      </motion.button>
                      <motion.button
                        onClick={handleRecurrenceSubmit}
                        disabled={recurrenceLoading}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-primary disabled:opacity-50"
                      >
                        {recurrenceLoading ? "Vytvářím…" : "Vytvořit opakování"}
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-5xl mx-auto w-full min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Termíny</h1>
            <div className="flex flex-wrap gap-2">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "/api"}/appointments/export/csv`}
                className="btn-secondary flex items-center gap-2 text-sm"
                download
              >
                ↓ CSV
              </a>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || "/api"}/appointments/export/ical`}
                className="btn-secondary flex items-center gap-2 text-sm"
                download="pristav-terminy.ics"
              >
                ↓ iCal
              </a>
              <motion.button
                onClick={() => { haptics.light(); setShowNewForm(true); }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} /> Nový termín
              </motion.button>
            </div>
          </div>

          {/* Filters */}
          <div className="card mb-4 flex flex-wrap gap-3 items-center">
            <Filter size={16} className="text-gray-500 flex-shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            >
              <option value="ALL">Všechny stavy</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            />
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Hledat klienta…"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="input text-sm py-1.5 pl-8 w-full sm:w-40"
              />
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Hledat terapeuta…"
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="input text-sm py-1.5 pl-8 w-full sm:w-40"
              />
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Hledat v poznámkách…"
                value={filterNotes}
                onChange={(e) => setFilterNotes(e.target.value)}
                className="input text-sm py-1.5 pl-8 w-full sm:w-44"
              />
            </div>
            <AnimatePresence>
              {(filterStatus !== "ALL" || filterDate || filterClient || filterEmployee || filterNotes) && (
                <motion.button
                  initial={shouldReduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  onClick={() => { haptics.light(); setFilterStatus("ALL"); setFilterDate(""); setFilterClient(""); setFilterEmployee(""); setFilterNotes(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Zrušit filtry
                </motion.button>
              )}
            </AnimatePresence>
            <span className="ml-auto text-sm text-gray-500">{filtered.length} termínů</span>
          </div>

          {/* New appointment form */}
          <AnimatePresence initial={false}>
            {showNewForm && (
              <motion.div
                key="new-form"
                initial={shouldReduce ? false : { opacity: 0, scale: 0.97, y: -14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 border-primary-200 border"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Nový termín</h2>
                <form onSubmit={handleNew} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(templates?.length ?? 0) > 0 && (
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Použít šablonu</label>
                      <select
                        className="input"
                        defaultValue=""
                        onChange={(e) => {
                          const tmpl = templates?.find((t: any) => t.id === parseInt(e.target.value));
                          if (tmpl) {
                            setNewForm((f) => ({
                              ...f,
                              serviceId: String(tmpl.serviceId ?? ""),
                              employeeId: tmpl.employeeId ? String(tmpl.employeeId) : f.employeeId,
                              notes: tmpl.notes ?? f.notes,
                            }));
                          }
                        }}
                      >
                        <option value="">-- bez šablony --</option>
                        {templates?.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name} · {t.serviceName ?? "?"} · {t.durationMinutes} min</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Klient</label>
                    <select
                      required
                      value={newForm.clientId}
                      onChange={(e) => setNewForm({ ...newForm, clientId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      {clients?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Terapeut</label>
                    <select
                      required
                      value={newForm.employeeId}
                      onChange={(e) => setNewForm({ ...newForm, employeeId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      {employees?.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Služba</label>
                    <select
                      required
                      value={newForm.serviceId}
                      onChange={(e) => setNewForm({ ...newForm, serviceId: e.target.value })}
                      className="input"
                    >
                      <option value="">-- vyberte --</option>
                      {services?.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Datum termínu</label>
                    <MiniCalendar
                      value={newDate}
                      onChange={setNewDate}
                      minDate={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Čas začátku</label>
                    <input
                      type="time"
                      required
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Poznámka (interní)</label>
                    <input
                      type="text"
                      value={newForm.notes}
                      onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                      className="input"
                      placeholder="Volitelná poznámka"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Poznámka klienta</label>
                    <textarea
                      value={newForm.clientNote}
                      onChange={(e) => setNewForm({ ...newForm, clientNote: e.target.value })}
                      className="input min-h-[60px]"
                      placeholder="Poznámka od klienta…"
                      maxLength={500}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="isOnline"
                      checked={newForm.isOnline}
                      onChange={(e) => setNewForm({ ...newForm, isOnline: e.target.checked })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <label htmlFor="isOnline" className="text-sm text-gray-700 flex items-center gap-1.5">
                      <Video size={14} className="text-blue-500" /> Online termín (video sezení)
                    </label>
                  </div>
                  <div className="col-span-2 flex gap-3 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => { haptics.light(); setShowNewForm(false); }}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-secondary"
                    >
                      Zrušit
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="btn-primary"
                    >
                      Uložit
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Appointments list */}
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.length === 0 && (
                <motion.div
                  key="empty"
                  initial={shouldReduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="card text-center text-gray-500 dark:text-gray-400 py-10"
                >
                  Žádné termíny
                </motion.div>
              )}
            </AnimatePresence>

            {filtered.map((a: any, i: number) => (
              <motion.div
                key={a.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                layout
                className="card hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`badge ${STATUS_COLORS[a.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                      {a.isOnline && (
                        <span className="badge bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                          <Video size={10} /> Online
                        </span>
                      )}
                      {!a.bookingActivated && a.status === "PENDING" && (
                        <span className="badge bg-orange-100 text-orange-700">Neaktivováno</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {clientMap[a.clientId] ?? `Klient #${a.clientId}`} →{" "}
                      {employeeMap[a.employeeId] ?? `Terapeut #${a.employeeId}`}
                      {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                    </p>
                    {a.notes && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{a.notes}</p>}
                    {a.clientNote && (
                      <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">
                        <span className="font-medium">Poznámka klienta:</span> {a.clientNote}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                    {!a.bookingActivated && a.status === "PENDING" && (
                      <motion.button
                        onClick={() => handleActivate(a.id)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-primary text-xs py-1"
                      >
                        Aktivovat
                      </motion.button>
                    )}
                    {a.status === "PENDING" && (
                      <motion.button
                        onClick={() => handleConfirm(a.id)}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-secondary text-xs py-1 flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Potvrdit
                      </motion.button>
                    )}
                    {a.status === "CONFIRMED" && (
                      <motion.button
                        onClick={() => handleStatusChange(a.id, "COMPLETED")}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="btn-secondary text-xs py-1"
                      >
                        Dokončit
                      </motion.button>
                    )}
                    {a.isOnline && a.status === "CONFIRMED" && (
                      <Link
                        href={`/video/${a.id}`}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center gap-1"
                      >
                        <Video size={12} /> Zahájit sezení
                      </Link>
                    )}
                    {["PENDING", "CONFIRMED"].includes(a.status) && (
                      <motion.button
                        onClick={() => {
                          haptics.light();
                          setRescheduleId(rescheduleId === a.id ? null : a.id);
                          setRescheduleTime("");
                        }}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                      >
                        <CalendarClock size={12} /> Přeplánovat
                      </motion.button>
                    )}
                    {["PENDING", "CONFIRMED"].includes(a.status) && (
                      <motion.button
                        onClick={() => {
                          haptics.light();
                          setRecurrenceApptId(a.id);
                          setRecurrenceRule("WEEKLY");
                          setRecurrenceEndDate("");
                          setRecurrenceResult(null);
                        }}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 rounded border border-purple-200 hover:bg-purple-50 flex items-center gap-1"
                      >
                        Opakovat
                      </motion.button>
                    )}
                    {["PENDING", "CONFIRMED"].includes(a.status) && (
                      <motion.button
                        onClick={() => {
                          if (confirm("Opravdu zrušit termín?")) handleStatusChange(a.id, "CANCELLED");
                        }}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      >
                        <XCircle size={12} className="inline mr-1" />Zrušit
                      </motion.button>
                    )}
                    {a.status === "CONFIRMED" && (
                      <motion.button
                        onClick={() => handleStatusChange(a.id, "NO_SHOW")}
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                      >
                        <Clock size={12} className="inline mr-1" />No-show
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Inline reschedule form */}
                <AnimatePresence>
                  {rescheduleId === a.id && (
                    <motion.div
                      key={`reschedule-${a.id}`}
                      initial={shouldReduce ? false : { opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-3 overflow-hidden"
                    >
                      <CalendarClock size={16} className="text-blue-500 flex-shrink-0" />
                      <input
                        type="datetime-local"
                        className="input text-sm py-1 flex-1"
                        value={rescheduleTime}
                        onChange={(e) => setRescheduleTime(e.target.value)}
                      />
                      <motion.button
                        className="btn-primary text-xs py-1.5 disabled:opacity-50"
                        disabled={!rescheduleTime}
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        onClick={() => handleReschedule(a.id, a.serviceId)}
                      >
                        Potvrdit
                      </motion.button>
                      <motion.button
                        className="btn-secondary text-xs py-1.5"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22 }}
                        onClick={() => { haptics.light(); setRescheduleId(null); setRescheduleTime(""); }}
                      >
                        Zrušit
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
