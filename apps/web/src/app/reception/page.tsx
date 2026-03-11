"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, Users, Clock, CreditCard } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ReceptionDashboard() {
  const { data: appointments, mutate } = useSWR("/appointments", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
  const { data: waitlist } = useSWR("/waitlist", fetcher);

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appointments?.filter((a) =>
    a.startTime.startsWith(today) && a.status !== "CANCELLED"
  );
  const pendingActivation = appointments?.filter((a) => !a.bookingActivated && a.status === "PENDING");

  const handleActivate = async (id: number) => {
    await api.post(`/appointments/${id}/activate`, {});
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Recepce</h1>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Dnešní termíny", value: todayAppts?.length ?? 0, icon: <Calendar size={18} />, href: "/reception/appointments" },
              { label: "Klientů", value: clients?.length ?? 0, icon: <Users size={18} />, href: "/reception/clients" },
              { label: "Čekající aktivaci", value: pendingActivation?.length ?? 0, icon: <Clock size={18} />, href: "/reception/appointments" },
              { label: "Waitlist", value: waitlist?.filter((w: any) => w.status === "WAITING").length ?? 0, icon: <CreditCard size={18} />, href: "/reception/waitlist" },
            ].map((stat) => (
              <Link key={stat.label} href={stat.href} className="card hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <span className="text-primary-500">{stat.icon}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
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
                      <p className="text-xs text-gray-500">Klient ID: {a.clientId}</p>
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
                        Klient: {a.clientId} · Terapeut: {a.employeeId}
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
        </div>
      </Layout>
    </RouteGuard>
  );
}
