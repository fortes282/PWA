"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Activity, AlertTriangle, Award, RefreshCw } from "lucide-react";

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

export default function AdminBackground() {
  const { data: clients } = useSWR<any[]>("/users?role=CLIENT", fetcher as any);
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const { data: behavior, mutate: mutateBehavior } = useSWR(
    selectedClient ? `/behavior/${selectedClient}` : null,
    fetcher
  );
  const [recordType, setRecordType] = useState("NO_SHOW");
  const [recordNote, setRecordNote] = useState("");
  const [saving, setSaving] = useState(false);

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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Background — Behavior evaluace</h1>

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
        </div>
      </Layout>
    </RouteGuard>
  );
}
