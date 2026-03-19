"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Calendar, ChevronDown, ChevronUp, User, FileText, Target, Plus, CheckCircle2, Circle, Star, Video } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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
  const { data: goals, mutate: mutateGoals } = useSWR<any[]>(`/clients/${clientId}/health-goals`, fetcher as any);
  const [goalActiveTab, setGoalActiveTab] = useState<"list" | "add">("list");
  const [newGoal, setNewGoal] = useState({ title: "", description: "", targetDate: "" });

  const clientReports = (reports ?? []).filter((r: any) => r.clientId === clientId);
  const completed = (appointments ?? []).filter((a: any) => a.status === "COMPLETED").length;
  const upcoming = (appointments ?? [])
    .filter((a: any) => new Date(a.startTime) > new Date() && a.status !== "CANCELLED")
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  if (!client) return <div className="text-xs text-gray-500">Načítám…</div>;

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900">{client.name}</p>
          <p className="text-xs text-gray-500">{client.email}</p>
          {client.phone && <p className="text-xs text-gray-500">{client.phone}</p>}
        </div>
        <div className="ml-auto text-right">
          <p className={`text-lg font-bold ${
            (client.behaviorScore ?? 100) >= 80 ? "text-green-600" :
            (client.behaviorScore ?? 100) >= 60 ? "text-yellow-600" : "text-red-600"
          }`}>{client.behaviorScore ?? 100}</p>
          <p className="text-xs text-gray-500">skóre</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{completed}</p>
          <p className="text-xs text-gray-500">sezení celkem</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-primary-600">{balance?.balance?.toFixed(0) ?? "—"}</p>
          <p className="text-xs text-gray-500">kreditů</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-gray-700">{clientReports.length}</p>
          <p className="text-xs text-gray-500">zpráv</p>
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
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Poslední zpráva</p>
          <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2">
            <FileText size={14} className="text-primary-500" />
            <span className="text-sm text-gray-700">{clientReports[clientReports.length - 1].title}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {formatDate(clientReports[clientReports.length - 1].createdAt)}
            </span>
          </div>
        </div>
      )}

      {/* Health Goals */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Target size={12} /> Cíle rehabilitace
          </p>
          <button
            onClick={() => setGoalActiveTab(goalActiveTab === "add" ? "list" : "add")}
            className="text-xs text-primary-600 flex items-center gap-0.5 hover:text-primary-800"
          >
            {goalActiveTab === "add" ? "Zavřít" : <><Plus size={12} /> Přidat</>}
          </button>
        </div>

        {goalActiveTab === "add" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await api.post(`/clients/${clientId}/health-goals`, {
                title: newGoal.title,
                description: newGoal.description || undefined,
                targetDate: newGoal.targetDate || undefined,
              });
              setNewGoal({ title: "", description: "", targetDate: "" });
              setGoalActiveTab("list");
              mutateGoals();
            }}
            className="bg-white rounded-lg p-3 mb-2 space-y-2"
          >
            <input required value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} className="input text-sm" placeholder="Název cíle…" />
            <input value={newGoal.description} onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })} className="input text-sm" placeholder="Popis (volitelný)…" />
            <input type="date" value={newGoal.targetDate} onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })} className="input text-sm" />
            <button type="submit" className="btn-primary w-full text-sm py-1.5">Uložit cíl</button>
          </form>
        )}

        {goalActiveTab === "list" && (
          <div className="space-y-1">
            {(goals?.length ?? 0) === 0 && <p className="text-xs text-gray-500">Žádné cíle.</p>}
            {(goals ?? []).map((g: any) => (
              <div key={g.id} className="bg-white rounded-lg px-3 py-2 flex items-start gap-2">
                {g.status === "achieved"
                  ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                  : <Circle size={14} className="text-gray-300 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{g.title}</p>
                  {g.targetDate && <p className="text-xs text-gray-500">Cíl: {g.targetDate}</p>}
                </div>
                <select
                  value={g.status}
                  onChange={async (e) => {
                    await api.patch(`/health-goals/${g.id}`, { status: e.target.value });
                    mutateGoals();
                  }}
                  className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600"
                >
                  <option value="active">Aktivní</option>
                  <option value="achieved">Dosaženo</option>
                  <option value="abandoned">Opuštěno</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmployeeAppointments() {
  const { user } = useAuth();
  const { data: appointments, mutate } = useSWR<any[]>(
    user ? `/appointments?employeeId=${user.id}` : null,
    fetcher as any
  );
  const { data: myRatings } = useSWR<any>(
    user ? `/employees/${user.id}/ratings` : null,
    fetcher as any,
  );
  const { data: clients } = useSWR<any[]>("/clients", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);
  const clientMap = useMemo(
    () => Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name])),
    [clients]
  );
  const serviceMap = useMemo(
    () => Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name])),
    [services]
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
              <p className="text-xs text-gray-500">dnes</p>
            </div>
            <div className="card text-center">
              <Calendar size={20} className="text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{upcoming.length}</p>
              <p className="text-xs text-gray-500">nadcházejících</p>
            </div>
          </div>

          {/* My Ratings Widget */}
          {myRatings && myRatings.totalRatings > 0 && (
            <div className="card mb-6 flex items-center gap-4">
              <div className="text-center flex-1">
                <div className="flex items-center justify-center gap-1 text-yellow-500 text-xl">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={18} fill={s <= Math.round(myRatings.averageRating ?? 0) ? "currentColor" : "none"} />
                  ))}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">{myRatings.averageRating}</p>
                <p className="text-xs text-gray-500">průměrné hodnocení</p>
              </div>
              <div className="text-center flex-1 border-l">
                <p className="text-2xl font-bold text-gray-900">{myRatings.totalRatings}</p>
                <p className="text-xs text-gray-500">celkem hodnocení</p>
              </div>
            </div>
          )}

          {/* Appointment list */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-500 py-10">
                {filterDate ? "Žádné termíny v tento den" : "Žádné termíny"}
              </div>
            )}
            {filtered.map((a: any) => (
              <div key={a.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`badge ${STATUS_COLORS[a.status] ?? "badge-yellow"}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                      {a.isOnline && (
                        <span className="badge bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                          <Video size={10} /> Online
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm font-medium text-gray-700">
                      {clientMap[a.clientId] ?? `Klient #${a.clientId}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {serviceMap[a.serviceId] ?? `Služba #${a.serviceId}`}
                    </p>
                    {a.clientNote && (
                      <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded mt-1">
                        <FileText size={10} className="inline mr-1" />
                        {a.clientNote}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {a.status === "CONFIRMED" && (
                      <>
                        {a.isOnline && (
                          <Link
                            href={`/video/${a.id}`}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center gap-1"
                          >
                            <Video size={12} /> Zahájit sezení
                          </Link>
                        )}
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
