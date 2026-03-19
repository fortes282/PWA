"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Users, CheckCircle, Clock } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

const CATEGORY_LABELS: Record<string, string> = {
  cmp: "Po CMP",
  tbi: "TBI",
  ms: "Roztroušená skleróza",
  general: "Obecná podpora",
  family: "Rodinní příslušníci",
};

export default function ClientGroups() {
  const { data: allGroups, mutate: mutateAll } = useSWR("/groups", fetcher);
  const { data: myGroups, mutate: mutateMe } = useSWR("/groups/mine", fetcher);
  const [joining, setJoining] = useState<number | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [rulesGroupId, setRulesGroupId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const myGroupIds = new Set((myGroups ?? []).map((g: any) => g.id));

  const handleJoinRequest = async (group: any) => {
    if (group.rules) {
      setRulesGroupId(group.id);
      return;
    }
    await doJoin(group.id);
  };

  const doJoin = async (groupId: number) => {
    setJoining(groupId);
    setError("");
    try {
      await api.post(`/groups/${groupId}/join`, { isAnonymous: anonymous });
      mutateAll();
      mutateMe();
    } catch (e: any) {
      setError(e.message ?? "Chyba při přihlašování do skupiny");
    } finally {
      setJoining(null);
      setRulesGroupId(null);
    }
  };

  const rulesGroup = (allGroups ?? []).find((g: any) => g.id === rulesGroupId);

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-3">
            <Users size={28} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Skupiny podpory</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Moderované peer-support skupiny</p>
            </div>
          </div>

          {/* My groups */}
          {myGroups && myGroups.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Moje skupiny</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {myGroups.map((g: any) => (
                  <Link
                    key={g.id}
                    href={`/client/groups/${g.id}`}
                    className="card hover:border-primary-300 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{g.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{CATEGORY_LABELS[g.category] ?? g.category}</p>
                      </div>
                      <span className="badge badge-green text-xs">Člen</span>
                    </div>
                    {g.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{g.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users size={12} /> {g.member_count} členů</span>
                      <span>Moderátor: {g.moderator_name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Available groups */}
          <section>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Dostupné skupiny</h2>
            {error && (
              <div className="alert alert-error mb-4">{error}</div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {(allGroups ?? []).map((g: any) => {
                const isMine = myGroupIds.has(g.id);
                const isPending = g.my_status === "pending";
                const isFull = g.member_count >= g.max_members;

                return (
                  <div key={g.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{g.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{CATEGORY_LABELS[g.category] ?? g.category}</p>
                      </div>
                      {isMine && <span className="badge badge-green text-xs">Člen</span>}
                      {isPending && <span className="badge badge-yellow text-xs">Čeká na schválení</span>}
                      {isFull && !isMine && !isPending && <span className="badge badge-gray text-xs">Plná</span>}
                    </div>
                    {g.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{g.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Users size={12} /> {g.member_count}/{g.max_members}</span>
                      <span>Moderátor: {g.moderator_name}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      {isMine ? (
                        <Link href={`/client/groups/${g.id}`} className="btn btn-sm btn-primary">
                          Vstoupit
                        </Link>
                      ) : isPending ? (
                        <span className="flex items-center gap-1 text-sm text-yellow-600">
                          <Clock size={14} /> Žádost odeslána
                        </span>
                      ) : !isFull ? (
                        <>
                          <button
                            onClick={() => handleJoinRequest(g)}
                            disabled={joining === g.id}
                            className="btn btn-sm btn-primary"
                          >
                            {joining === g.id ? "..." : "Přihlásit se"}
                          </button>
                          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={anonymous}
                              onChange={(e) => setAnonymous(e.target.checked)}
                              className="rounded"
                            />
                            Anonymně
                          </label>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {(allGroups ?? []).length === 0 && (
              <div className="card text-center py-8 text-gray-400">
                Zatím nejsou žádné skupiny.
              </div>
            )}
          </section>
        </div>

        {/* Rules dialog */}
        {rulesGroup && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Pravidla skupiny: {rulesGroup.name}</h2>
              <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                {rulesGroup.rules}
              </div>
              <p className="text-sm text-gray-500">Pro vstup do skupiny musíte souhlasit s pravidly.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => doJoin(rulesGroup.id)}
                  className="btn btn-primary flex-1"
                >
                  <CheckCircle size={16} /> Souhlasím a přihlásím se
                </button>
                <button
                  onClick={() => setRulesGroupId(null)}
                  className="btn btn-secondary"
                >
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
