"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useMemo, useCallback } from "react";
import { Calendar, ChevronDown, User, FileText, Target, Plus, CheckCircle2, Circle, Star, Video, X, MessageSquare, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any>(url);

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  CANCELLED: "Zrušeno",
  COMPLETED: "Dokončeno",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "badge-yellow",
  CONFIRMED: "badge-green",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
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

  if (!client) return <div className="text-xs text-gray-500 py-4 text-center">Načítám klienta…</div>;

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-primary-600" />
        </div>
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{client.name}</p>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{completed}</p>
          <p className="text-xs text-gray-500">sezení</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-primary-600">{balance?.balance?.toFixed(0) ?? "—"}</p>
          <p className="text-xs text-gray-500">kreditů</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{clientReports.length}</p>
          <p className="text-xs text-gray-500">zpráv</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Další termín</p>
          <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDateTime(upcoming[0].startTime)}</p>
          </div>
        </div>
      )}

      {clientReports.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Poslední zpráva</p>
          <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
            <FileText size={14} className="text-primary-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{clientReports[clientReports.length - 1].title}</span>
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
            className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 space-y-2"
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
              <div key={g.id} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 flex items-start gap-2">
                {g.status === "achieved"
                  ? <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                  : <Circle size={14} className="text-gray-300 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{g.title}</p>
                  {g.targetDate && <p className="text-xs text-gray-500">Cíl: {g.targetDate}</p>}
                </div>
                <select
                  value={g.status}
                  onChange={async (e) => {
                    await api.patch(`/health-goals/${g.id}`, { status: e.target.value });
                    mutateGoals();
                  }}
                  className="text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700"
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

type ConfirmAction = { type: "complete"; apptId: number; clientId: number };

export default function EmployeeAppointments() {
  const { user } = useAuth();
  const shouldReduce = useReducedMotion();
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
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = (appointments ?? [])
    .filter((a: any) => {
      if (filterDate && !a.startTime.startsWith(filterDate)) return false;
      return a.status !== "CANCELLED";
    })
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = filtered.filter((a: any) => a.startTime.startsWith(today));
  const upcoming = filtered.filter((a: any) => a.startTime > new Date().toISOString());

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      await api.patch(`/appointments/${confirmAction.apptId}`, { status: "COMPLETED" });
      haptics.success();
      mutate();
      setConfirmAction(null);
      setSelectedAppt(null);
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, mutate]);

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moje termíny</h1>
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
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{todayAppts.length}</p>
              <p className="text-xs text-gray-500">dnes</p>
            </div>
            <div className="card text-center">
              <Calendar size={20} className="text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{upcoming.length}</p>
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
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{myRatings.averageRating}</p>
                <p className="text-xs text-gray-500">průměrné hodnocení</p>
              </div>
              <div className="text-center flex-1 border-l dark:border-gray-700">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{myRatings.totalRatings}</p>
                <p className="text-xs text-gray-500">celkem hodnocení</p>
              </div>
            </div>
          )}

          {/* Appointment list — klik otevře slide-over */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-500 py-10">
                {filterDate ? "Žádné termíny v tento den" : "Žádné termíny"}
              </div>
            )}
            {filtered.map((a: any) => (
              <motion.button
                key={a.id}
                whileTap={shouldReduce ? undefined : { scale: 0.98 }}
                onClick={() => { haptics.light(); setSelectedAppt(a); }}
                className="card w-full text-left hover:shadow-md transition-shadow cursor-pointer"
              >
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
                    <p className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {clientMap[a.clientId] ?? `Klient #${a.clientId}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {serviceMap[a.serviceId] ?? `Služba #${a.serviceId}`}
                    </p>
                    {a.clientNote && (
                      <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 px-2 py-1 rounded mt-1">
                        <FileText size={10} className="inline mr-1" />
                        {a.clientNote}
                      </p>
                    )}
                  </div>
                  <ChevronDown size={16} className="text-gray-400 mt-1 flex-shrink-0 -rotate-90" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* ═══ Slide-over panel ═══ */}
        <AnimatePresence>
          {selectedAppt && (
            <>
              {/* Backdrop */}
              <motion.div
                className="fixed inset-0 bg-black/40 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedAppt(null)}
              />

              {/* Panel */}
              <motion.div
                className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 340, damping: 30 }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{formatDateTime(selectedAppt.startTime)}</p>
                    <p className="text-sm text-gray-500">{clientMap[selectedAppt.clientId] ?? `Klient #${selectedAppt.clientId}`}</p>
                  </div>
                  <button
                    onClick={() => setSelectedAppt(null)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                    aria-label="Zavřít"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {/* Status + service */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className={`badge ${STATUS_COLORS[selectedAppt.status] ?? "badge-yellow"}`}>
                      {STATUS_LABELS[selectedAppt.status] ?? selectedAppt.status}
                    </span>
                    {selectedAppt.isOnline && (
                      <span className="badge bg-blue-100 text-blue-700 inline-flex items-center gap-1">
                        <Video size={10} /> Online
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {serviceMap[selectedAppt.serviceId] ?? `Služba #${selectedAppt.serviceId}`}
                    </span>
                  </div>

                  {/* Client note */}
                  {selectedAppt.clientNote && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                        <FileText size={12} /> Poznámka klienta
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200">{selectedAppt.clientNote}</p>
                    </div>
                  )}

                  {/* Online session link */}
                  {selectedAppt.isOnline && selectedAppt.status === "CONFIRMED" && (
                    <Link
                      href={`/video/${selectedAppt.id}`}
                      className="flex items-center gap-2 justify-center w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <Video size={16} /> Zahájit online sezení
                    </Link>
                  )}

                  {/* Client details */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Detail klienta</p>
                    <ClientCard clientId={selectedAppt.clientId} />
                  </div>
                </div>

                {/* Action footer */}
                {selectedAppt.status === "CONFIRMED" && (
                  <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                    <motion.button
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      onClick={() => setConfirmAction({ type: "complete", apptId: selectedAppt.id, clientId: selectedAppt.clientId })}
                      className="btn-primary flex-1 py-3 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} /> Hotovo
                    </motion.button>
                    <Link
                      href={`/messages?to=${selectedAppt.clientId}`}
                      onClick={() => setSelectedAppt(null)}
                      className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
                      title="Napsat zprávu"
                    >
                      <MessageSquare size={18} />
                    </Link>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ═══ Confirm dialog ═══ */}
        <AnimatePresence>
          {confirmAction && (
            <>
              <motion.div
                className="fixed inset-0 bg-black/50 z-[60]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setConfirmAction(null)}
              />
              <motion.div
                className="fixed inset-0 z-[70] flex items-center justify-center p-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/40">
                      <CheckCircle2 size={24} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">
                        Označit jako dokončeno?
                      </h3>
                      <p className="text-sm text-gray-500">
                        Termín bude uzavřen jako úspěšně dokončený.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <motion.button
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      onClick={handleConfirmAction}
                      disabled={actionLoading}
                      className="flex-1 py-3 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-60 bg-green-600 hover:bg-green-700"
                    >
                      {actionLoading ? "Ukládám…" : "Potvrdit"}
                    </motion.button>
                    <button
                      onClick={() => setConfirmAction(null)}
                      disabled={actionLoading}
                      className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </Layout>
    </RouteGuard>
  );
}
