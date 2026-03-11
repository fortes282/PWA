"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import Link from "next/link";
import { Calendar, CreditCard, Clock, ArrowRight, Bell } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientDashboard() {
  const { user } = useAuth();
  const { data: appointments } = useSWR<any[]>("/appointments?status=CONFIRMED", fetcher);
  const { data: balance } = useSWR<{ balance: number }>("/credits/balance", fetcher);
  const { data: notifications } = useSWR<any[]>("/notifications", fetcher);

  const nextAppt = appointments
    ?.filter((a) => new Date(a.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

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
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-500">Notifikace</p>
                <Bell size={18} className="text-primary-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
              <p className="text-xs text-gray-400 mt-1">nepřečtených</p>
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

          {/* Next appointment */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={18} className="text-primary-500" />
              Nejbližší termín
            </h2>
            {nextAppt ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{formatDateTime(nextAppt.startTime)}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {nextAppt.price ? formatCurrency(nextAppt.price) : ""}
                  </p>
                </div>
                <Link href="/client/appointments" className="btn-secondary text-sm">
                  Detail
                </Link>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 text-sm mb-3">Žádný nadcházející termín</p>
                <Link href="/client/booking" className="btn-primary text-sm inline-flex items-center gap-2">
                  Rezervovat <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/client/booking", label: "Rezervovat", icon: <Calendar size={20} /> },
              { href: "/client/appointments", label: "Termíny", icon: <Clock size={20} /> },
              { href: "/client/credits", label: "Kredity", icon: <CreditCard size={20} /> },
              { href: "/client/reports", label: "Zprávy", icon: <ArrowRight size={20} /> },
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
