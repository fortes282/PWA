"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";

const fetcher = (url: string) => api.get<any[]>(url);

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { data: appointments } = useSWR(
    user ? `/appointments?employeeId=${user.id}` : null,
    fetcher
  );

  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appointments
    ?.filter((a) => a.startTime.startsWith(today) && a.status !== "CANCELLED")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Build 07:00–20:00 timeline
  const hours = Array.from({ length: 14 }, (_, i) => i + 7);

  const getApptAtHour = (hour: number) =>
    todayAppts?.filter((a) => new Date(a.startTime).getHours() === hour) ?? [];

  const now = new Date();
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const timelineOffset = ((currentMinute - 7 * 60) / (13 * 60)) * 100;

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Dnešní rozvrh</h1>
          <p className="text-gray-400 text-sm mb-6">
            {new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" })}
          </p>

          {/* Day timeline */}
          <div className="card relative">
            {/* "Now" line */}
            {timelineOffset > 0 && timelineOffset < 100 && (
              <div
                className="absolute left-16 right-4 h-0.5 bg-red-400 z-10"
                style={{ top: `${(timelineOffset / 100) * 100}%` }}
              >
                <div className="absolute -left-2 -top-1.5 w-3 h-3 rounded-full bg-red-400" />
              </div>
            )}

            <div className="space-y-0">
              {hours.map((hour) => {
                const appts = getApptAtHour(hour);
                return (
                  <div key={hour} className="flex gap-4 min-h-[48px] border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-400 w-12 pt-2 flex-shrink-0">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                    <div className="flex-1 py-1 space-y-1">
                      {appts.map((a: any) => (
                        <div key={a.id} className="bg-primary-100 border border-primary-200 rounded px-2 py-1 text-xs">
                          <p className="font-medium text-primary-800">
                            {formatDateTime(a.startTime)}
                          </p>
                          <p className="text-primary-600">Klient ID: {a.clientId}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {todayAppts?.length === 0 && (
            <p className="text-gray-400 text-sm text-center mt-4">Dnes nemáte žádné termíny</p>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
