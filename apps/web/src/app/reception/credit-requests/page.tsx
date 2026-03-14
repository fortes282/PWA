"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { CreditCard, CheckCircle, XCircle, Filter } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Čeká",
  APPROVED: "Schváleno",
  REJECTED: "Zamítnuto",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function CreditRequestsReception() {
  const { data: requests, mutate } = useSWR("/credit-requests", fetcher);

  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<number | null>(null);

  const filtered = (requests ?? []).filter(
    (r: any) => filterStatus === "ALL" || r.status === filterStatus
  );

  const handleAction = async (id: number, action: "APPROVED" | "REJECTED") => {
    setProcessing(id);
    try {
      await api.patch(`/credit-requests/${id}`, {
        action,
        reviewNote: reviewNote[id] || undefined,
      });
      setReviewNote((n) => { const c = { ...n }; delete c[id]; return c; });
      mutate();
    } catch {
      // ignore
    } finally {
      setProcessing(null);
    }
  };

  const pendingCount = (requests ?? []).filter((r: any) => r.status === "PENDING").length;

  return (
    <RouteGuard allowedRoles={["ADMIN", "RECEPTION"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Žádosti o kredit</h1>
              {pendingCount > 0 && (
                <p className="text-sm text-yellow-700 mt-0.5">
                  {pendingCount} žádost{pendingCount === 1 ? "" : pendingCount < 5 ? "y" : "í"} čeká na zpracování
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-400" />
              <select
                className="input text-sm py-1 w-36"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">Vše</option>
                <option value="PENDING">Čeká</option>
                <option value="APPROVED">Schváleno</option>
                <option value="REJECTED">Zamítnuto</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filtered.length === 0 && (
              <div className="card text-center text-gray-400 py-10">
                Žádné žádosti {filterStatus !== "ALL" ? `se stavem „${STATUS_LABEL[filterStatus]}"` : ""}.
              </div>
            )}

            {filtered.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-start gap-3">
                  <CreditCard size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">{r.amount} Kč</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{r.clientName}</p>
                    <p className="text-xs text-gray-400">{r.clientEmail} · {formatDate(r.createdAt)}</p>
                    {r.note && <p className="text-sm text-gray-600 mt-1">&bdquo;{r.note}&ldquo;</p>}
                    {r.reviewNote && (
                      <p className="text-xs text-gray-500 italic mt-1">Poznámka: {r.reviewNote}</p>
                    )}

                    {r.status === "PENDING" && (
                      <div className="mt-3 space-y-2">
                        <input
                          className="input text-sm py-1"
                          placeholder="Poznámka k rozhodnutí (volitelné)…"
                          value={reviewNote[r.id] ?? ""}
                          onChange={(e) =>
                            setReviewNote((n) => ({ ...n, [r.id]: e.target.value }))
                          }
                        />
                        <div className="flex gap-2">
                          <button
                            className="btn-primary text-sm py-1.5 flex items-center gap-1"
                            disabled={processing === r.id}
                            onClick={() => handleAction(r.id, "APPROVED")}
                          >
                            <CheckCircle size={14} />
                            Schválit
                          </button>
                          <button
                            className="btn-secondary text-sm py-1.5 flex items-center gap-1 text-red-600 hover:bg-red-50"
                            disabled={processing === r.id}
                            onClick={() => handleAction(r.id, "REJECTED")}
                          >
                            <XCircle size={14} />
                            Zamítnout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
