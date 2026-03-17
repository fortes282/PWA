"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, CreditCard, Clock, ArrowRight, Bell, FileText } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientDashboard() {
  const { user } = useAuth();
  const { data: appointments } = useSWR<any[]>("/appointments?status=CONFIRMED", fetcher);
  const { data: upcoming } = useSWR<any[]>("/appointments/upcoming", fetcher);
  const { data: balance } = useSWR<{ balance: number }>("/credits/balance", fetcher);
  const { data: notifications } = useSWR<any[]>("/notifications", fetcher);
  const { data: services } = useSWR<any[]>("/services", fetcher);
  const { data: employees } = useSWR<any[]>("/employees", fetcher);
  const { data: creditRequests } = useSWR<any[]>("/credit-requests", fetcher);

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const serviceMap = Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name]));
  const employeeMap = Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name]));

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Dobrý den, {user?.name?.split(" ")[0]}!</h1>
            <p className="text-gray-500 text-sm mt-1">Přehled vašeho účtu</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Kredit</p>
                <CreditCard size={18} className="text-primary-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {balance ? formatCurrency(balance.balance) : "—"}
              </p>
              <Link href="/client/credits" className="text-xs text-primary-600 hover:underline mt-1 block">
                Zobrazit transakce →
              </Link>
              {(creditRequests ?? []).filter((r: any) => r.status === "PENDING").length > 0 && (
                <Link href="/client/credit-request" className="text-xs text-yellow-600 hover:underline block">
                  Čeká {(creditRequests ?? []).filter((r: any) => r.status === "PENDING").length} žádost o kredit
                </Link>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Notifikace</p>
                <Bell size={18} className="text-primary-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              <Link href="/notifications" className="text-xs text-primary-600 hover:underline mt-1 block">
                Zobrazit vše →
              </Link>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Termínů</p>
                <Calendar size={18} className="text-primary-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{appointments?.length ?? 0}</p>
              <Link href="/client/appointments" className="text-xs text-primary-600 hover:underline mt-1 block">
                Zobrazit vše →
              </Link>
            </div>
          </div>

          {/* Upcoming appointments — next 7 days */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Clock size={18} className="text-primary-500" />
                Nadcházející termíny (7 dní)
              </h2>
              <Link href="/client/appointments" className="text-xs text-primary-600 hover:underline">
                Vše →
              </Link>
            </div>
            {(upcoming ?? []).length > 0 ? (
              <div className="space-y-3">
                {(upcoming ?? []).slice(0, 5).map((appt: any) => (
                  <div key={appt.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{formatDateTime(appt.startTime)}</p>
                      {appt.serviceId && serviceMap[appt.serviceId] && (
                        <p className="text-xs text-gray-600 mt-0.5">{serviceMap[appt.serviceId]}</p>
                      )}
                      {appt.employeeId && employeeMap[appt.employeeId] && (
                        <p className="text-xs text-gray-400 mt-0.5">Terapeut: {employeeMap[appt.employeeId]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {appt.price != null && (
                        <span className="text-xs text-gray-500">{formatCurrency(appt.price)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        appt.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                        appt.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {appt.status === "CONFIRMED" ? "Potvrzeno" : appt.status === "PENDING" ? "Čeká" : appt.status}
                      </span>
                    </div>
                  </div>
                ))}
                {(upcoming ?? []).length > 5 && (
                  <p className="text-xs text-gray-400 text-center pt-1">
                    + {(upcoming ?? []).length - 5} dalších termínů
                  </p>
                )}
              </div>
            ) : upcoming !== undefined ? (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm mb-3">Žádný nadcházející termín v příštích 7 dnech</p>
                <Link href="/client/booking" className="btn-primary text-sm inline-flex items-center gap-2">
                  Rezervovat <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="text-center py-4 text-gray-300 text-sm">Načítám…</div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/client/booking", label: "Rezervovat", icon: <Calendar size={20} /> },
              { href: "/client/appointments", label: "Termíny", icon: <Clock size={20} /> },
              { href: "/client/credits", label: "Kredity", icon: <CreditCard size={20} /> },
              { href: "/client/reports", label: "Zprávy", icon: <FileText size={20} /> },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="card flex flex-col items-center gap-2 py-4 hover:shadow-md transition-shadow text-center"
              >
                <span className="text-primary-600">{item.icon}</span>
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
