"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Users, CheckCircle, XCircle, Flag, Plus, Lock, Unlock } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<any>(url);

const CATEGORY_OPTIONS = [
  { value: "cmp", label: "Po CMP" },
  { value: "tbi", label: "TBI" },
  { value: "ms", label: "Roztroušená skleróza" },
  { value: "general", label: "Obecná podpora" },
  { value: "family", label: "Rodinní příslušníci" },
];

export default function EmployeeGroups() {
  const { data: groups, mutate: mutateGroups } = useSWR("/groups/moderated", fetcher);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [tab, setTab] = useState<"pending" | "reports" | "topics">("pending");
  const { data: pending, mutate: mutatePending } = useSWR(
    selectedGroup ? `/groups/${selectedGroup.id}/pending` : null,
    fetcher
  );
  const { data: reports, mutate: mutateReports } = useSWR(
    selectedGroup ? `/groups/${selectedGroup.id}/reports` : null,
    fetcher
  );
  const { data: topics, mutate: mutateTopics } = useSWR(
    selectedGroup ? `/groups/${selectedGroup.id}/topics` : null,
    fetcher
  );

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "general", maxMembers: 20, rules: "" });
  const { toast } = useToast();

  const handleMembership = async (membershipId: number, status: "approved" | "rejected") => {
    if (!selectedGroup) return;
    try {
      await api.patch(`/groups/${selectedGroup.id}/members/${membershipId}`, { status });
      toast("success", status === "approved" ? "Žádost schválena." : "Žádost zamítnuta.");
      mutatePending();
      mutateGroups();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleResolveReport = async (reportId: number) => {
    if (!selectedGroup) return;
    try {
      await api.patch(`/groups/${selectedGroup.id}/reports/${reportId}`, {});
      toast("success", "Nahlášení vyřešeno.");
      mutateReports();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleToggleLock = async (topic: any) => {
    if (!selectedGroup) return;
    try {
      await api.patch(`/groups/${selectedGroup.id}/topics/${topic.id}`, { isLocked: !topic.is_locked });
      toast("success", topic.is_locked ? "Téma odemčeno." : "Téma uzamčeno.");
      mutateTopics();
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  const handleCreateGroup = async () => {
    try {
      await api.post("/groups", form);
      toast("success", "Skupina byla vytvořena.");
      mutateGroups();
      setCreating(false);
      setForm({ name: "", description: "", category: "general", maxMembers: 20, rules: "" });
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Chyba");
    }
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={28} className="text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skupiny podpory</h1>
                <p className="text-sm text-gray-500">Moderátorský přehled</p>
              </div>
            </div>
            <button onClick={() => setCreating(true)} className="btn btn-primary">
              <Plus size={16} /> Nová skupina
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Groups sidebar */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Moje skupiny</h2>
              {(groups ?? []).map((g: any) => (
                <button
                  key={g.id}
                  onClick={() => { setSelectedGroup(g); setTab("pending"); }}
                  className={`w-full text-left card transition-all ${selectedGroup?.id === g.id ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20" : "hover:border-gray-300"}`}
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">{g.name}</div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    <span>{g.member_count} členů</span>
                    {g.pending_count > 0 && (
                      <span className="text-yellow-600 font-medium">{g.pending_count} čeká</span>
                    )}
                    {g.report_count > 0 && (
                      <span className="text-red-600 font-medium">{g.report_count} hlášení</span>
                    )}
                  </div>
                </button>
              ))}
              {(!groups || groups.length === 0) && (
                <div className="card text-sm text-gray-500 text-center py-4">Nemáte žádné skupiny</div>
              )}
            </div>

            {/* Detail panel */}
            <div className="lg:col-span-2 space-y-4">
              {!selectedGroup ? (
                <div className="card text-center py-12 text-gray-500">
                  Vyberte skupinu vlevo
                </div>
              ) : (
                <>
                  <div className="card">
                    <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1">{selectedGroup.name}</h2>
                    <p className="text-sm text-gray-500">{selectedGroup.description}</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                    {(["pending", "reports", "topics"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex-1 text-sm py-1.5 rounded-md transition-all ${tab === t ? "bg-white dark:bg-gray-800 font-semibold shadow" : "text-gray-500"}`}
                      >
                        {t === "pending" ? `Žádosti (${(pending ?? []).length})` : t === "reports" ? `Hlášení (${(reports ?? []).length})` : "Vlákna"}
                      </button>
                    ))}
                  </div>

                  {tab === "pending" && (
                    <div className="space-y-2">
                      {(pending ?? []).length === 0 && (
                        <div className="card text-sm text-gray-500 text-center py-4">Žádné čekající žádosti</div>
                      )}
                      {(pending ?? []).map((m: any) => (
                        <div key={m.id} className="card flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{m.name}</div>
                            <div className="text-xs text-gray-500">{m.email} · {new Date(m.created_at).toLocaleDateString("cs-CZ")}</div>
                            {m.is_anonymous ? <span className="text-xs badge badge-gray">Chce anonymně</span> : null}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleMembership(m.id, "approved")} className="btn btn-sm btn-success" title="Schválit">
                              <CheckCircle size={16} />
                            </button>
                            <button onClick={() => handleMembership(m.id, "rejected")} className="btn btn-sm btn-danger" title="Zamítnout">
                              <XCircle size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "reports" && (
                    <div className="space-y-2">
                      {(reports ?? []).length === 0 && (
                        <div className="card text-sm text-gray-500 text-center py-4">Žádná otevřená hlášení</div>
                      )}
                      {(reports ?? []).map((r: any) => (
                        <div key={r.id} className="card space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-medium text-red-600 flex items-center gap-1">
                                <Flag size={12} /> Hlášení od: {r.reporter_name}
                              </span>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{r.reason}</p>
                            </div>
                            <button onClick={() => handleResolveReport(r.id)} className="btn btn-sm btn-secondary">
                              Vyřešit
                            </button>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                            {r.post_content}
                          </div>
                          <div className="text-xs text-gray-500">Vlákno: {r.topic_title}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "topics" && (
                    <div className="space-y-2">
                      {(topics ?? []).length === 0 && (
                        <div className="card text-sm text-gray-500 text-center py-4">Žádná vlákna</div>
                      )}
                      {(topics ?? []).map((t: any) => (
                        <div key={t.id} className="card flex justify-between items-center">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{t.title}</div>
                            <div className="text-xs text-gray-500">{t.post_count} příspěvků · {t.author_name}</div>
                          </div>
                          <button
                            onClick={() => handleToggleLock(t)}
                            className={`btn btn-sm ${t.is_locked ? "btn-secondary" : "btn-warning"}`}
                            title={t.is_locked ? "Odemknout" : "Zamknout"}
                          >
                            {t.is_locked ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Create group modal */}
        {creating && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nová skupina podpory</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Název skupiny *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input w-full"
                    placeholder="Název skupiny"
                  />
                </div>
                <div>
                  <label className="label">Popis</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input w-full"
                    rows={2}
                    placeholder="Krátký popis skupiny"
                  />
                </div>
                <div>
                  <label className="label">Kategorie *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input w-full"
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Max. počet členů</label>
                  <input
                    type="number"
                    value={form.maxMembers}
                    onChange={(e) => setForm({ ...form, maxMembers: parseInt(e.target.value) || 20 })}
                    className="input w-full"
                    min={2}
                    max={100}
                  />
                </div>
                <div>
                  <label className="label">Pravidla skupiny (zobrazeny při vstupu)</label>
                  <textarea
                    value={form.rules}
                    onChange={(e) => setForm({ ...form, rules: e.target.value })}
                    className="input w-full"
                    rows={3}
                    placeholder="Zapište pravidla skupiny, se kterými musí klient souhlasit..."
                  />
                </div>

              </div>
              <div className="flex gap-3">
                <button onClick={handleCreateGroup} className="btn btn-primary flex-1" disabled={!form.name}>
                  Vytvořit skupinu
                </button>
                <button onClick={() => setCreating(false)} className="btn btn-secondary">
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
