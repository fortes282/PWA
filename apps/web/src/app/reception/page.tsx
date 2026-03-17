"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, Users, Clock, CreditCard, TrendingUp, AlertTriangle } from "lucide-react";
import { SkeletonStats, SkeletonList } from "@/components/Skeleton";

const fetcher = (url: string) => api.get<any>(url);

export default function ReceptionDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: appointments, mutate } = useSWR("/appointments", fetcher);
  const { data: todayApptsDirect } = useSWR<any[]>("/appointments/today", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);
  const { data: employees } = useSWR("/employees", fetcher);
  const { data: waitlist } = useSWR("/waitlist", fetcher);
  const { data: creditRequests } = useSWR("/credit-requests", fetcher);
  const { data: revSummary } = useSWR<any>("/stats/revenue-summary", fetcher);

  const clientMap = Object.fromEntries(((clients as any[]) ?? []).map((c: any) => [c.id, c.name]));
  const employeeMap = Object.fromEntries(((employees as any[]) ?? []).map((e: any) => [e.id, e.name]));

  // Prefer the dedicated /appointments/today endpoint; fall back to filtering all
  const todayAppts = todayApptsDirect ?? ((appointments as any[]) ?? []).filter((a: any) =>
    a.startTime.startsWith(today) && a.status !== "CANCELLED"
  );
  const pendingActivation = ((appointments as any[]) ?? []).filter((a: any) => !a.bookingActivated && a.status === "PENDING");

  const handleActivate = async (id: number) => {
    await api.post(`/appointments/${id}/activate`, {});
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Recepce</h1>

          {/* Loading state */}
          {!appointments && (
            <div className="space-y-6">
              <SkeletonStats count={4} />
              <SkeletonList count={3} />
            </div>
          )}

          {/* Stats */}
          {appointments && (<>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            {[
              { label: "Dnešní termíny", value: todayAppts?.length ?? 0, icon: <Calendar size={18} />, href: "/reception/appointments" },
              { label: "Klientů", value: (clients as any[])?.length ?? 0, icon: <Users size={18} />, href: "/reception/clients" },
              { label: "Čekající aktivaci", value: pendingActivation?.length ?? 0, icon: <Clock size={18} />, href: "/reception/appointments" },
              { label: "Waitlist", value: ((waitlist as any[]) ?? []).filter((w: any) => w.status === "WAITING").length, icon: <CreditCard size={18} />, href: "/reception/waitlist" },
              { label: "Týdenní výnosy", value: revSummary ? formatCurrency(revSummary.weekRevenue ?? 0) : "—", icon: <TrendingUp size={18} />, href: "/reception/billing" },
              { label: "Žádosti o kredit", value: ((creditRequests as any[]) ?? []).filter((r: any) => r.status === "PENDING").length, icon: <CreditCard size={18} />, href: "/reception/credit-requests" },
            ].map((stat) => (
              <Link key={stat.label} href={stat.href} className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <span className="text-primary-500">{stat.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </Link>
            ))}
          </div>

          {/* Pending activation */}
          {(pendingActivation?.length ?? 0) > 0 && (
            <div className="card mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">Čeká na aktivaci bookingu</h2>
              <div className="space-y-3">
                {pendingActivation?.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div>
                      <p className="text-sm font-medium">{formatDateTime(a.startTime)}</p>
                      <p className="text-xs text-gray-500">{clientMap[a.clientId] ?? `Klient #${a.clientId}`}</p>
                    </div>
                    <button
                      onClick={() => handleActivate(a.id)}
                      className="btn-primary text-xs"
                    >
                      Aktivovat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No-show risk: clients with low behavior score who have upcoming appointments today */}
          {(() => {
            const riskClients = ((clients as any[]) ?? []).filter((c: any) =>
              c.behaviorScore != null && c.behaviorScore < 60
            );
            const riskToday = todayAppts?.filter((a: any) =>
              riskClients.some((c: any) => c.id === a.clientId)
            ) ?? [];
            if (riskToday.length === 0) return null;
            return (
              <div className="card mb-6 border-l-4 border-orange-400">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-orange-500" />
                  Riziko no-show dnes ({riskToday.length})
                </h2>
                <div className="space-y-2">
                  {riskToday.map((a: any) => {
                    const client = riskClients.find((c: any) => c.id === a.clientId);
                    return (
                      <div key={a.id} className="flex items-center justify-between text-sm py-1">
                        <span className="text-gray-700">{formatDateTime(a.startTime)} — {clientMap[a.clientId] ?? `Klient #${a.clientId}`}</span>
                        <span className="text-orange-600 font-medium text-xs">Skóre: {client?.behaviorScore?.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-2">Klienti se skóre &lt; 60 mají vyšší pravděpodobnost no-show</p>
              </div>
            );
          })()}

          {/* Today's schedule */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Dnešní rozvrh</h2>
            {todayAppts?.length === 0 && (
              <p className="text-gray-400 text-sm">Dnes nejsou žádné termíny</p>
            )}
            <div className="space-y-2">
              {todayAppts
                ?.sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">{formatDateTime(a.startTime)}</p>
                      <p className="text-xs text-gray-400">
                        {clientMap[a.clientId] ?? `Klient #${a.clientId}`} → {employeeMap[a.employeeId] ?? `Terapeut #${a.employeeId}`}
                        {a.price ? ` · ${formatCurrency(a.price)}` : ""}
                      </p>
                    </div>
                    <span className={`badge ${a.status === "CONFIRMED" ? "badge-green" : "badge-yellow"}`}>
                      {a.status === "CONFIRMED" ? "Potvrzeno" : "Čeká"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
          </>)}
        </div>
      </Layout>
    </RouteGuard>
  );
}
