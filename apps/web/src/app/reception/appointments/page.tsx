"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, Filter, CheckCircle, XCircle, Clock, Search, CalendarClock } from "lucide-react";

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
  NO_SHOW: "bg-gray-100 text-gray-700",
};

export default function ReceptionAppointments() {
  const { data: appointments, mutate } = useSWR("/appointments", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
  const { data: employees } = useSWR("/users?role=EMPLOYEE", fetcher);

  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterClient, setFilterClient] = useState<string>("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({
    clientId: "", employeeId: "", serviceId: "", startTime: "", notes: "",
  });
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const { data: services } = useSWR("/services", fetcher);

  const clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  const filtered = (appointments ?? []).filter((a: any) => {
    if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
    if (filterDate && !a.startTime.startsWith(filterDate)) return false;
    if (filterClient) {
      const clientName = (clientMap[a.clientId] ?? "").toLowerCase();
      if (!clientName.includes(filterClient.toLowerCase())) return false;
    }
    return true;
  }).sort((a: any, b: any) => b.startTime.localeCompare(a.startTime));

  const handleStatusChange = async (id: number, status: string) => {
    await api.patch(`/appointments/${id}`, { status });
    mutate();
  };

  const handleActivate = async (id: number) => {
    await api.post(`/appointments/${id}/activate`, {});
    mutate();
  };

  const handleReschedule = async (id: number, serviceId: number) => {
    if (!rescheduleTime) return;
    const svc = (services ?? []).find((s: any) => s.id === serviceId);
    const start = new Date(rescheduleTime);
    const end = new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000);
    await api.patch(`/appointments/${id}`, {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    });
    setRescheduleId(null);
    setRescheduleTime("");
    mutate();
  };

  const handleNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const svc = services?.find((s: any) => s.id === parseInt(newForm.serviceId));
    const start = new Date(newForm.startTime);
    const end = new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000);
    await api.post("/appointments", {
      clientId: parseInt(newForm.clientId),
      employeeId: parseInt(newForm.employeeId),
      serviceId: parseInt(newForm.serviceId),
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      notes: newForm.notes || undefined,
      price: svc?.price,
    });
    setShowNewForm(false);
    setNewForm({ clientId: "", employeeId: "", serviceId: "", startTime: "", notes: "" });
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Termíny</h1>
            <button onClick={() => setShowNewForm(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Nový termín
            </button>
          </div>

          {/* Filters */}
          <div className="card mb-4 flex flex-wrap gap-3 items-center">
            <Filter size={16} className="text-gray-400 flex-shrink-0" />
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
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Hledat klienta…"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                className="input text-sm py-1.5 pl-8 w-40"
              />
            </div>
            {(filterStatus !== "ALL" || filterDate || filterClient) && (
              <button
                onClick={() => { setFilterStatus("ALL"); setFilterDate(""); setFilterClient(""); }}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                Zrušit filtry
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">{filtered.length} termínů</span>
          </div>

          {/* New appointment form */}
          {showNewForm && (
            <div className="card mb-6 border-primary-200 border">
              <h2 className="font-semibold text-gray-900 mb-4">Nový termín</h2>
              <form onSubmit={handleNew} className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Začátek</label>
                  <input
                    type="datetime-local"
                    required
                    value={newForm.startTime}
                    onChange={(e) => setNewForm({ ...newForm, startTime: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Poznámka</label>
                  <input
                    type="text"
                    value={newForm.notes}
                    onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
                    className="input"
                    placeholder="Volitelná poznámka"
                  />
                </div>
                <div className="col-span-2 flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowNewForm(false)} className="btn-secondary">Zrušit</button>
                  <button type="submit" className="btn-primary">Uložit</button>
                </div>
              </form>
            </div>
          )}

          {/* Appointments list */}
          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-400 py-10">Žádné termíny</div>
            )}
            {filtered.map((a: any) => (
              <div key={a.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[a.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                      {!a.bookingActivated && a.status === "PENDING" && (
                        <span className="badge bg-orange-100 text-orange-700">Neaktivováno</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500">
                      {clientMap[a.clientId] ?? `Klient #${a.clientId}`} →{" "}
                      {employeeMap[a.employeeId] ?? `Terapeut #${a.employeeId}`}
                      {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                    </p>
                    {a.notes && <p className="text-xs text-gray-400 mt-1">{a.notes}</p>}
                  </div>

                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    {!a.bookingActivated && a.status === "PENDING" && (
                      <button
                        onClick={() => handleActivate(a.id)}
                        className="btn-primary text-xs py-1"
                      >
                        Aktivovat
                      </button>
                    )}
                    {a.status === "PENDING" && (
                      <button
                        onClick={() => handleStatusChange(a.id, "CONFIRMED")}
                        className="btn-secondary text-xs py-1 flex items-center gap-1"
                      >
                        <CheckCircle size={12} /> Potvrdit
                      </button>
                    )}
                    {a.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleStatusChange(a.id, "COMPLETED")}
                        className="btn-secondary text-xs py-1"
                      >
                        Dokončit
                      </button>
                    )}
                    {["PENDING", "CONFIRMED"].includes(a.status) && (
                      <button
                        onClick={() => {
                          setRescheduleId(rescheduleId === a.id ? null : a.id);
                          setRescheduleTime("");
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 flex items-center gap-1"
                      >
                        <CalendarClock size={12} /> Přeplánovat
                      </button>
                    )}
                    {["PENDING", "CONFIRMED"].includes(a.status) && (
                      <button
                        onClick={() => {
                          if (confirm("Opravdu zrušit termín?")) handleStatusChange(a.id, "CANCELLED");
                        }}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                      >
                        <XCircle size={12} className="inline mr-1" />Zrušit
                      </button>
                    )}
                    {a.status === "CONFIRMED" && (
                      <button
                        onClick={() => handleStatusChange(a.id, "NO_SHOW")}
                        className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                      >
                        <Clock size={12} className="inline mr-1" />No-show
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline reschedule form */}
                {rescheduleId === a.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                    <CalendarClock size={16} className="text-blue-500 flex-shrink-0" />
                    <input
                      type="datetime-local"
                      className="input text-sm py-1 flex-1"
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                    />
                    <button
                      className="btn-primary text-xs py-1.5"
                      disabled={!rescheduleTime}
                      onClick={() => handleReschedule(a.id, a.serviceId)}
                    >
                      Potvrdit
                    </button>
                    <button
                      className="btn-secondary text-xs py-1.5"
                      onClick={() => { setRescheduleId(null); setRescheduleTime(""); }}
                    >
                      Zrušit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
