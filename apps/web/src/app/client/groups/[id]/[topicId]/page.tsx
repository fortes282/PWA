"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Send, Flag, AlertTriangle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

const CRISIS_CONTACTS = [
  { name: "Linka bezpečí", phone: "116 111" },
  { name: "Krizová linka SOS", phone: "241 484 149" },
  { name: "Linka důvěry Riaps", phone: "257 212 323" },
];

const CRISIS_WORDS = [
  "sebevražda", "sebevražd", "nechci žít", "chci umřít", "ublížit si",
  "zabít se", "konec života",
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_WORDS.some((w) => lower.includes(w));
}

export default function TopicPage() {
  const params = useParams();
  const id = params?.id as string;
  const topicId = params?.topicId as string;

  const { data: group } = useSWR(`/groups/${id}`, fetcher);
  const { data: posts, mutate: mutatePosts } = useSWR(
    `/groups/${id}/topics/${topicId}/posts`,
    fetcher
  );

  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [reportPostId, setReportPostId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!content.trim()) return;

    const hasCrisis = detectCrisis(content);
    if (hasCrisis) {
      setCrisisDetected(true);
      // Still allow sending
    }

    setSending(true);
    setError("");
    try {
      await api.post(`/groups/${id}/topics/${topicId}/posts`, {
        content,
        isAnonymous,
      });
      setContent("");
      mutatePosts();
    } catch (e: any) {
      setError(e.message ?? "Chyba při odesílání");
    } finally {
      setSending(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim() || !reportPostId) return;
    try {
      await api.post(`/groups/${id}/posts/${reportPostId}/report`, { reason: reportReason });
      setReportPostId(null);
      setReportReason("");
    } catch (e: any) {
      setError(e.message ?? "Chyba při nahlašování");
    }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Link href={`/client/groups/${id}`} className="text-gray-500 hover:text-gray-600">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {(posts as any)?.topicTitle ?? "Vlákno diskuze"}
              </h1>
              <p className="text-sm text-gray-500">{group?.name}</p>
            </div>
          </div>

          {/* Crisis banner */}
          {crisisDetected && (
            <div className="card bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800 dark:text-red-200">Detekujeme krizový obsah</p>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Zdá se, že procházíte těžkým obdobím. Pokud potřebujete pomoc, obraťte se na krizovou linku:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {CRISIS_CONTACTS.map((c) => (
                      <li key={c.phone} className="text-sm font-medium text-red-800 dark:text-red-200">
                        {c.name}: <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="underline">{c.phone}</a>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setCrisisDetected(false)}
                    className="text-xs text-red-500 mt-2 underline"
                  >
                    Zavřít
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3">
            {(!posts || (posts as any[]).length === 0) && (
              <div className="card text-center py-8 text-gray-500">
                Zatím žádné příspěvky. Napište první!
              </div>
            )}
            {((posts as any[]) ?? []).map((p: any) => (
              <div key={p.id} className="card relative">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                      {p.author_name ?? "Neznámý"}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Date(p.created_at).toLocaleString("cs-CZ")}
                    </span>
                  </div>
                  <button
                    onClick={() => setReportPostId(p.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors ml-2"
                    title="Nahlásit příspěvek"
                  >
                    <Flag size={14} />
                  </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">{p.content}</p>
              </div>
            ))}
          </div>

          {/* Reply box */}
          <div className="card space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Napište odpověď..."
              rows={3}
              className="input w-full resize-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded"
                />
                Přispět anonymně
              </label>
              <button
                onClick={handleSend}
                disabled={sending || !content.trim()}
                className="btn btn-primary"
              >
                <Send size={16} /> {sending ? "Odesílám..." : "Odeslat"}
              </button>
            </div>
          </div>
        </div>

        {/* Report modal */}
        {reportPostId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Nahlásit příspěvek</h2>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Důvod nahlášení..."
                rows={3}
                className="input w-full"
              />
              <div className="flex gap-3">
                <button onClick={handleReport} className="btn btn-primary flex-1" disabled={!reportReason.trim()}>
                  Odeslat hlášení
                </button>
                <button onClick={() => { setReportPostId(null); setReportReason(""); }} className="btn btn-secondary">
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
