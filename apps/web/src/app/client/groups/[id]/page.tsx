"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MessageSquare, Plus, Lock, ArrowLeft } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function GroupDetail() {
  const params = useParams();
  const id = params?.id as string;

  const { data: group } = useSWR(`/groups/${id}`, fetcher);
  const { data: topics, mutate: mutateTopics } = useSWR(
    group?.myMembership?.status === "approved" || group?.moderator_id
      ? `/groups/${id}/topics`
      : null,
    fetcher
  );

  const [newTopic, setNewTopic] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const canPost =
    group?.myMembership?.status === "approved" ||
    (group && group.moderator_id);

  const handleCreateTopic = async () => {
    if (!newTopic.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api.post(`/groups/${id}/topics`, { title: newTopic });
      setNewTopic("");
      mutateTopics();
    } catch (e: any) {
      setError(e.message ?? "Chyba");
    } finally {
      setCreating(false);
    }
  };

  if (!group) {
    return (
      <RouteGuard allowedRoles={["CLIENT"]}>
        <Layout>
          <div className="max-w-3xl mx-auto animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
            <div className="h-4 bg-gray-100 rounded w-64" />
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/client/groups" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{group.name}</h1>
              <p className="text-sm text-gray-500">Moderátor: {group.moderator_name} · {group.member_count} členů</p>
            </div>
          </div>

          {group.description && (
            <div className="card text-sm text-gray-600 dark:text-gray-300">{group.description}</div>
          )}

          {!canPost && (
            <div className="card bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-sm text-yellow-800 dark:text-yellow-200">
              {group.myMembership?.status === "pending"
                ? "Vaše žádost o členství čeká na schválení moderátorem."
                : "Pro přístup k diskuzím se musíte přihlásit do skupiny."}
            </div>
          )}

          {canPost && (
            <>
              {/* New topic */}
              <div className="card space-y-3">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200">Nové vlákno</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Název vlákna..."
                    className="input flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleCreateTopic()}
                  />
                  <button
                    onClick={handleCreateTopic}
                    disabled={creating || !newTopic.trim()}
                    className="btn btn-primary"
                  >
                    <Plus size={16} /> Vytvořit
                  </button>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              {/* Topics list */}
              <div className="space-y-2">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200">Vlákna diskuze</h2>
                {(!topics || topics.length === 0) && (
                  <div className="card text-center py-8 text-gray-400">
                    <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
                    Zatím žádná vlákna. Buďte první!
                  </div>
                )}
                {(topics ?? []).map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/client/groups/${id}/${t.id}`}
                    className="card hover:border-primary-300 hover:shadow-sm transition-all flex justify-between items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{t.title}</span>
                        {t.is_locked ? (
                          <span title="Zamčeno"><Lock size={14} className="text-gray-400" /></span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Autor: {t.author_name} · {t.post_count ?? 0} příspěvků
                        {t.last_post_at && ` · Poslední: ${new Date(t.last_post_at).toLocaleDateString("cs-CZ")}`}
                      </p>
                    </div>
                    <MessageSquare size={18} className="text-gray-300" />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
