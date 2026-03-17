"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  CANCELLED: "Zrušeno",
  COMPLETED: "Dokončeno",
  NO_SHOW: "Nedostavil se",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "badge-yellow",
  CONFIRMED: "badge-blue",
  CANCELLED: "badge-red",
  COMPLETED: "badge-green",
  NO_SHOW: "badge-gray",
};

const fetcher = (url: string) => api.get<any>(url);

export default function ClientAppointments() {
  const [historyPage, setHistoryPage] = useState(1);
  const { data: appointments, mutate } = useSWR<any[]>("/appointments/upcoming", fetcher as any);
  const { data: history } = useSWR<any>(`/appointments/history?page=${historyPage}&limit=10`, fetcher as any);
  const { data: employees } = useSWR<any[]>("/employees", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);

  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));

  const handleCancel = async (id: number) => {
    if (!confirm("Opravdu chcete zrušit tento termín?")) return;
    await api.delete(`/appointments/${id}`);
    mutate();
  };

  const upcoming = (appointments ?? []).filter(
    (a) => new Date(a.startTime) > new Date() && a.status !== "CANCELLED"
  );
  const past = history?.items ?? [];
  const histPagination = history?.pagination;

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje termíny</h1>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Nadcházející</h2>
            {upcoming?.length === 0 && (
              <EmptyState title="Žádné nadcházející termíny" />
            )}
            <div className="space-y-3">
              {upcoming?.map((a) => (
                <div key={a.id} className="card flex items-center justify-between">
                  <div>
                    <p className="font-medium">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500">
                      {serviceMap[a.serviceId] ?? "Termín"}
                      {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                      {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                    {a.status !== "CANCELLED" && new Date(a.startTime) > new Date() && (
                      <button
                        onClick={() => handleCancel(a.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Zrušit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Minulé</h2>
              {histPagination && histPagination.total > 0 && (
                <span className="text-xs text-gray-400">{histPagination.total} celkem</span>
              )}
            </div>
            {!history && <p className="text-gray-400 text-sm">Načítám…</p>}
            {history && past.length === 0 && (
              <EmptyState title="Žádné minulé termíny" />
            )}
            <div className="space-y-3">
              {past.map((a: any) => (
                <div key={a.id} className="card flex items-center justify-between opacity-70">
                  <div>
                    <p className="font-medium">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500">
                      {serviceMap[a.serviceId] ?? "Termín"}
                      {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                      {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                    </p>
                    {a.status === "CANCELLED" && a.cancellationReason && (
                      <p className="text-xs text-red-400 mt-0.5">
                        Důvod: {a.cancellationReason}
                      </p>
                    )}
                  </div>
                  <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                </div>
              ))}
            </div>
            {/* Pagination */}
            {histPagination && histPagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  disabled={historyPage === 1}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-gray-500">
                  {historyPage} / {histPagination.pages}
                </span>
                <button
                  onClick={() => setHistoryPage((p) => Math.min(histPagination.pages, p + 1))}
                  disabled={historyPage >= histPagination.pages}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </section>
        </div>
      </Layout>
    </RouteGuard>
  );
}
