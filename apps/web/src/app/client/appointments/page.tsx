"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";

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
  const { data: appointments, mutate } = useSWR<any[]>("/appointments", fetcher as any);
  const { data: employees } = useSWR<any[]>("/users?role=EMPLOYEE", fetcher as any);
  const { data: services } = useSWR<any[]>("/services", fetcher as any);

  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));
  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));

  const handleCancel = async (id: number) => {
    if (!confirm("Opravdu chcete zrušit tento termín?")) return;
    await api.delete(`/appointments/${id}`);
    mutate();
  };

  const upcoming = appointments?.filter(
    (a) => new Date(a.startTime) > new Date() && a.status !== "CANCELLED"
  );
  const past = appointments?.filter(
    (a) => new Date(a.startTime) <= new Date() || a.status === "CANCELLED"
  );

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje termíny</h1>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Nadcházející</h2>
            {upcoming?.length === 0 && (
              <p className="text-gray-400 text-sm">Žádné nadcházející termíny</p>
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
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Minulé</h2>
            <div className="space-y-3">
              {past?.map((a) => (
                <div key={a.id} className="card flex items-center justify-between opacity-60">
                  <div>
                    <p className="font-medium">{formatDateTime(a.startTime)}</p>
                    <p className="text-sm text-gray-500">
                      {serviceMap[a.serviceId] ?? "Termín"}
                      {employeeMap[a.employeeId] ? ` · ${employeeMap[a.employeeId]}` : ""}
                    </p>
                  </div>
                  <span className={STATUS_CLASSES[a.status] ?? "badge-gray"}>{STATUS_LABELS[a.status]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </Layout>
    </RouteGuard>
  );
}
