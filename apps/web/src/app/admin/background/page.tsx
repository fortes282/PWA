"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Activity, AlertTriangle, Award, RefreshCw, Server, Database, Clock, Star, MessageSquare, FileText } from "lucide-react";
import ClientTimeline from "@/components/ClientTimeline";

const fetcher = (url: string) => api.get<any>(url);

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
};

const SCORE_BG = (score: number) => {
  if (score >= 80) return "bg-green-50 border-green-200";
  if (score >= 60) return "bg-yellow-50 border-yellow-200";
  if (score >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
};

const BEHAVIOR_TYPE_LABELS: Record<string, string> = {
  NO_SHOW: "No-show",
  LATE_CANCEL: "Pozdní zrušení",
  TIMELY_CANCEL: "Včasné zrušení",
  ON_TIME: "Dochvilnost",
  POSITIVE_FEEDBACK: "Pozitivní zpětná vazba",
};

const BEHAVIOR_TYPES = Object.keys(BEHAVIOR_TYPE_LABELS) as Array<keyof typeof BEHAVIOR_TYPE_LABELS>;

function AuditLogTab() {
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const loadAudit = async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 1 : page;
      const url = `/audit?limit=${LIMIT}&page=${p}${actionFilter ? `&action=${encodeURIComponent(actionFilter)}` : ""}`;
      const data = await api.get<{ items: any[]; pagination: any }>(url);
      if (reset) {
        setItems(data.items);
        setPage(1);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setPage((prev) => prev + 1);
      }
      setTotal(data.pagination?.total ?? 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAudit(true); }, [actionFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filtrovat podle akce…"
          className="input max-w-xs"
        />
        <button onClick={() => loadAudit(true)} className="btn-secondary text-sm flex items-center gap-1">
          <RefreshCw size={14} /> Obnovit
        </button>
      </div>
      <div className="text-xs text-gray-400 mb-2">Celkem záznamů: {total}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="py-2 pr-4">Čas</th>
              <th className="py-2 pr-4">Akce</th>
              <th className="py-2 pr-4">Uživatel</th>
              <th className="py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td colSpan={4} className="text-gray-400 text-center py-6">Žádné záznamy</td></tr>
            )}
            {items.map((item: any) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 pr-4 text-xs text-gray-400 whitespace-nowrap">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString("cs-CZ") : "—"}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-primary-700">{item.action}</td>
                <td className="py-2 pr-4 text-xs text-gray-600">{item.userId ?? "—"}</td>
                <td className="py-2 text-xs text-gray-500 max-w-xs truncate">
                  {item.details ? JSON.stringify(item.details) : ""}
                  {item.targetType && <span className="ml-1 text-gray-400">[{item.targetType}{item.targetId ? ` #${item.targetId}` : ""}]</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length < total && (
        <div className="text-center mt-4">
          <button onClick={() => loadAudit(false)} disabled={loading} className="btn-secondary text-sm">
            {loading ? "Načítám…" : `Načíst další (${total - items.length} zbývá)`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminBackground() {
  const [activeTab, setActiveTab] = useState<"behavior" | "audit">("behavior");
  const { data: clients } = useSWR<any[]>("/clients", fetcher as any);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const { data: healthDetail, mutate: mutateHealth } = useSWR<any>("/health/detailed", fetcher);
  const { data: ratingsSummary } = useSWR<any[]>("/ratings/summary", fetcher as any);
  const { data: processorStatus, mutate: mutateProcessor } = useSWR<any>("/auto-processor/status", fetcher);
  const [processorRunning, setProcessorRunning] = useState(false);
  const { data: behavior, mutate: mutateBehavior } = useSWR(
    selectedClient ? `/behavior/${selectedClient}` : null,
    fetcher
  );
  const [recordType, setRecordType] = useState("NO_SHOW");
  const [recordNote, setRecordNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleRunNoShows = async () => {
    setProcessorRunning(true);
    try {
      await api.post("/auto-processor/no-shows", {});
      await api.post("/auto-processor/invoice-overdue", {});
      mutateProcessor();
    } catch { /* ignore */ } finally {
      setProcessorRunning(false);
    }
  };

  const handleRecord = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      await api.post("/behavior/record", {
        userId: selectedClient,
        type: recordType,
        note: recordNote || undefined,
      });
      setRecordNote("");
      mutateBehavior();
    } finally {
      setSaving(false);
    }
  };

  // Sort clients by behavior score (lowest first — at risk)
  const sortedClients = [...(clients ?? [])].sort(
    (a, b) => (a.behaviorScore ?? 100) - (b.behaviorScore ?? 100)
  );

  const atRisk = sortedClients.filter((c) => (c.behaviorScore ?? 100) < 60);
  const excellent = sortedClients.filter((c) => (c.behaviorScore ?? 100) >= 90);

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Background — Správa</h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("behavior")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "behavior" ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              <span className="flex items-center gap-2"><Activity size={14} /> Behavior evaluace</span>
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "audit" ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              <span className="flex items-center gap-2"><FileText size={14} /> Audit Log</span>
            </button>
          </div>

          {/* Audit Log Tab */}
          {activeTab === "audit" && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Audit Log</h2>
              <AuditLogTab />
            </div>
          )}

          {/* Behavior Tab */}
          {activeTab === "behavior" && <>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="card border border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-500" />
                <span className="text-sm font-medium text-gray-700">Rizikové klienty</span>
              </div>
              <p className="text-3xl font-bold text-red-600">{atRisk.length}</p>
              <p className="text-xs text-gray-400 mt-1">skóre &lt; 60</p>
            </div>
            <div className="card border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <Award size={18} className="text-green-500" />
                <span className="text-sm font-medium text-gray-700">Výborní klienti</span>
              </div>
              <p className="text-3xl font-bold text-green-600">{excellent.length}</p>
              <p className="text-xs text-gray-400 mt-1">skóre ≥ 90</p>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={18} className="text-primary-500" />
                <span className="text-sm font-medium text-gray-700">Průměr</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {clients && clients.length > 0
                  ? Math.round(clients.reduce((s, c) => s + (c.behaviorScore ?? 100), 0) / clients.length)
                  : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-1">průměrné skóre</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Client list */}
            <div>
              <h2 className="font-semibold text-gray-900 mb-3">Všichni klienti</h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {sortedClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClient(c.id === selectedClient ? null : c.id)}
                    className={`w-full text-left card border transition-all ${
                      selectedClient === c.id
                        ? "border-primary-300 bg-primary-50"
                        : `${SCORE_BG(c.behaviorScore ?? 100)} hover:shadow-md`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xl font-bold ${SCORE_COLOR(c.behaviorScore ?? 100)}`}>
                          {c.behaviorScore ?? 100}
                        </p>
                        <p className="text-xs text-gray-400">skóre</p>
                      </div>
                    </div>
                  </button>
                ))}
                {sortedClients.length === 0 && (
                  <p className="text-gray-400 text-sm">Žádní klienti</p>
                )}
              </div>
            </div>

            {/* Behavior detail + record */}
            <div>
              {!selectedClient ? (
                <div className="card text-center text-gray-400 py-12">
                  <Activity size={32} className="mx-auto mb-3 opacity-30" />
                  <p>Vyberte klienta pro detail a záznam události</p>
                </div>
              ) : (
                <>
                  <div className="card mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="font-semibold text-gray-900">
                        {clients?.find((c) => c.id === selectedClient)?.name}
                      </h2>
                      <button onClick={() => mutateBehavior()} className="text-gray-400 hover:text-gray-700">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    <div className="text-center mb-4">
                      <p className={`text-4xl font-bold ${SCORE_COLOR(behavior?.score ?? 100)}`}>
                        {behavior?.score ?? 100}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">aktuální skóre</p>
                    </div>

                    {/* Event history */}
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Historie událostí
                    </h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {(behavior?.events ?? []).length === 0 && (
                        <p className="text-xs text-gray-400">Žádné události</p>
                      )}
                      {(behavior?.events ?? [])
                        .sort((a: any, b: any) => b.createdAt?.localeCompare(a.createdAt ?? "") ?? 0)
                        .map((ev: any) => (
                          <div key={ev.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                            <span className="text-gray-600">
                              {BEHAVIOR_TYPE_LABELS[ev.type] ?? ev.type}
                              {ev.note ? ` — ${ev.note}` : ""}
                            </span>
                            <span className={ev.points >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                              {ev.points >= 0 ? "+" : ""}{ev.points}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Record event */}
                  <div className="card border border-primary-100">
                    <h3 className="font-semibold text-gray-900 mb-3">Zaznamenat událost</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Typ události</label>
                        <select
                          value={recordType}
                          onChange={(e) => setRecordType(e.target.value)}
                          className="input"
                        >
                          {BEHAVIOR_TYPES.map((t) => (
                            <option key={t} value={t}>{BEHAVIOR_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Poznámka (volitelně)</label>
                        <input
                          type="text"
                          value={recordNote}
                          onChange={(e) => setRecordNote(e.target.value)}
                          className="input"
                          placeholder="Doplňující info…"
                        />
                      </div>
                      <button
                        onClick={handleRecord}
                        disabled={saving}
                        className="btn-primary w-full"
                      >
                        {saving ? "Ukládám…" : "Zaznamenat"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* System Health Panel */}
          <div className="card mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Server size={18} className="text-gray-500" />
                <h2 className="font-semibold text-gray-900">System Health</h2>
              </div>
              <button onClick={() => mutateHealth()} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600">
                <RefreshCw size={12} /> Obnovit
              </button>
            </div>
            {healthDetail && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Database size={16} className="text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{healthDetail.dbSize ?? 0} MB</p>
                  <p className="text-xs text-gray-400">Velikost DB</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Activity size={16} className="text-primary-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{healthDetail.tableStats?.users ?? 0}</p>
                  <p className="text-xs text-gray-400">Uživatelů</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <Clock size={16} className="text-blue-400 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{healthDetail.tableStats?.appointments ?? 0}</p>
                  <p className="text-xs text-gray-400">Termínů</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <AlertTriangle size={16} className={`mx-auto mb-1 ${(healthDetail.pendingReminders ?? 0) > 0 ? "text-yellow-500" : "text-gray-300"}`} />
                  <p className="text-lg font-bold text-gray-800">{healthDetail.pendingReminders ?? 0}</p>
                  <p className="text-xs text-gray-400">Připomínek 24h</p>
                </div>
              </div>
            )}
            {healthDetail && (
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-400 border-t border-gray-100 pt-3">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${healthDetail.status === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {healthDetail.status === "ok" ? "● OK" : "● Degraded"}
                </span>
                <span>DB latence: {healthDetail.db?.latencyMs ?? "?"}ms</span>
                <span>Uptime: {Math.floor((healthDetail.uptime ?? 0) / 60)} min</span>
                <span>Verze: {healthDetail.version}</span>
              </div>
            )}
            {!healthDetail && <p className="text-xs text-gray-400">Načítám health data…</p>}
          </div>

          {/* Auto-Processor Panel */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <RefreshCw className="text-blue-500" size={20} />
                <h2 className="text-lg font-semibold text-gray-800">Auto-Processor</h2>
              </div>
              <button
                onClick={handleRunNoShows}
                disabled={processorRunning}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw size={14} className={processorRunning ? "animate-spin" : ""} />
                {processorRunning ? "Zpracovávám…" : "Spustit nyní"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Označí přesunuté termíny jako No-Show (penalty −20 bodů) a faktury po splatnosti jako Overdue.
            </p>
            {processorStatus?.noShowProcessor && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p><span className="font-medium">Poslední spuštění:</span> {new Date(processorStatus.noShowProcessor.ranAt).toLocaleString("cs-CZ")}</p>
                <p><span className="font-medium">Nalezeno:</span> {processorStatus.noShowProcessor.found} termínů</p>
                <p><span className="font-medium">Zpracováno:</span> {processorStatus.noShowProcessor.processed}</p>
              </div>
            )}
            {!processorStatus?.noShowProcessor && (
              <p className="text-xs text-gray-400">Zatím nebylo spuštěno.</p>
            )}
          </div>

          {/* Employee Ratings Panel */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Star className="text-yellow-500" size={20} />
              <h2 className="text-lg font-semibold text-gray-800">Hodnocení terapeutů</h2>
            </div>
            {!ratingsSummary && <p className="text-sm text-gray-400">Načítám…</p>}
            {ratingsSummary && ratingsSummary.length === 0 && (
              <p className="text-sm text-gray-400">Žádná hodnocení zatím nebyla přidána.</p>
            )}
            {ratingsSummary && ratingsSummary.length > 0 && (
              <div className="space-y-2">
                {ratingsSummary.map((r: any, i: number) => (
                  <div key={r.employee_id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <span className="text-sm text-gray-400 w-5">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{r.employee_name}</p>
                      <p className="text-xs text-gray-400">{r.total_ratings} hodnocení</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={s <= Math.round(r.avg_rating) ? "text-yellow-400" : "text-gray-200"}>★</span>
                      ))}
                      <span className="text-sm font-semibold text-gray-700 ml-1">{r.avg_rating}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client timeline for selected client */}
          {selectedClient && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="text-blue-500" size={20} />
                <h2 className="text-lg font-semibold text-gray-800">Časová osa klienta</h2>
              </div>
              <ClientTimeline clientId={selectedClient} />
            </div>
          )}
          </>}
        </div>
      </Layout>
    </RouteGuard>
  );
}
