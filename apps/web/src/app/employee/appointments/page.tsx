"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Calendar, ChevronDown, ChevronUp, User, FileText } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

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
  NO_SHOW: "bg-gray-100 text-gray-600",
};

function ClientCard({ clientId }: { clientId: number }) {
  const { data: client } = useSWR<any>(`/users/${clientId}`, fetcher);
  const { data: appointments } = useSWR<any[]>(`/appointments?clientId=${clientId}`, fetcher as any);
  const { data: balance } = useSWR<any>(`/credits/balance/${clientId}`, fetcher);
  const { data: reports } = useSWR<any[]>("/medical-reports", fetcher as any);

  const clientReports = (reports ?? []).filter((r: any) => r.clientId === clientId);
  const completed = (appointments ?? []).filter((a: any) => a.status === "COMPLETED").length;
  const upcoming = (appointments ?? [])
    .filter((a: any) => new Date(a.startTime) > new Date() && a.status !== "CANCELLED")
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  if (!client) return <div className="text-xs text-gray-400">Načítám…</div>;

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{client.name}</p>
          <p className="text-xs text-gray-400">{client.email}</p>
          {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
        </div>
        <div className="ml-auto text-right">
          <p className={`text-lg font-bold ${
            (client.behaviorScore ?? 100) >= 80 ? "text-green-600" :
            (client.behaviorScore ?? 100) >= 60 ? "text-yellow-600" : "text-red-600"
          }`}>{client.behaviorScore ?? 100}</p>
          <p className="text-xs text-gray-400">skóre</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{completed}</p>
          <p className="text-xs text-gray-400">sezení celkem</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-primary-600">{balance?.balance?.toFixed(0) ?? "—"}</p>
          <p className="text-xs text-gray-400">kreditů</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-gray-700">{clientReports.length}</p>
          <p className="text-xs text-gray-400">zpráv</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Další termín</p>
          <div className="bg-white rounded-lg px-3 py-2">
            <p className="text-sm font-medium text-gray-900">{formatDateTime(upcoming[0].startTime)}</p>
          </div>
        </div>
      )}

      {clientReports.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Poslední zpráva</p>
          <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2">
            <FileText size={14} className="text-primary-500" />
            <span className="text-sm text-gray-700">{clientReports[clientReports.length - 1].title}</span>
            <span className="text-xs text-gray-400 ml-auto">
              {formatDate(clientReports[clientReports.length - 1].createdAt)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeAppointments() {
  const { user } = useAuth();
  const { data: appointments, mutate } = useSWR<any[]>(
    user ? `/appointments?employeeId=${user.id}` : null,
    fetcher as any
  );
  const [filterDate, setFilterDate] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = (appointments ?? [])
    .filter((a: any) => {
      if (filterDate && !a.startTime.startsWith(filterDate)) return false;
      return a.status !== "CANCELLED";
    })
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = filtered.filter((a: any) => a.startTime.startsWith(today));
  const upcoming = filtered.filter((a: any) => a.startTime > new Date().toISOString());

  const handleComplete = async (id: number) => {
    await api.patch(`/appointments/${id}`, { status: "COMPLETED" });
    mutate();
  };

  const handleNoShow = async (id: number) => {
    await api.patch(`/appointments/${id}`, { status: "NO_SHOW" });
    // Record no-show in behavior
    const appt = appointments?.find((a: any) => a.id === id);
    if (appt) {
      await api.post("/behavior/record", { userId: appt.clientId, type: "NO_SHOW", note: "Nedostavil se na termín" });
    }
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Moje termíny</h1>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card text-center">
              <Calendar size={20} className="text-primary-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{todayAppts.length}</p>
              <p className="text-xs text-gray-400">dnes</p>
            </div>
            <div className="card text-center">
              <Calendar size={20} className="text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{upcoming.length}</p>
              <p className="text-xs text-gray-400">nadcházejících</p>
            </div>
          </div>

          {/* Appointment list */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-400 py-10">
                {filterDate ? "Žádné termíny v tento den" : "Žádné termíny"}
              </div>
            )}
            {filtered.map((a: any) => (
              <div key={a.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${STATUS_COLORS[a.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </div>
                    <p className="font-medium text-gray-900">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500">Klient ID: {a.clientId}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {a.status === "CONFIRMED" && (
                      <>
                        <button
                          onClick={() => handleComplete(a.id)}
                          className="btn-primary text-xs py-1"
                        >
                          Dokončit
                        </button>
                        <button
                          onClick={() => handleNoShow(a.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                        >
                          No-show
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      className="btn-secondary text-xs py-1 flex items-center gap-1"
                    >
                      Klient {expandedId === a.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {expandedId === a.id && <ClientCard clientId={a.clientId} />}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
