"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const fetcher = (url: string) => api.get<any[]>(url);

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 border-yellow-300 text-yellow-800",
  CONFIRMED: "bg-blue-100 border-blue-300 text-blue-900",
  COMPLETED: "bg-green-100 border-green-300 text-green-800",
  CANCELLED: "bg-gray-100 border-gray-300 text-gray-400 line-through",
  NO_SHOW: "bg-red-100 border-red-300 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Čeká",
  CONFIRMED: "Potvrzeno",
  COMPLETED: "Hotovo",
  CANCELLED: "Zrušeno",
  NO_SHOW: "No-show",
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00–20:00

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(base: string, n: number) {
  const d = new Date(base + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function apptMinOffset(timeStr: string) {
  const t = new Date(timeStr);
  return t.getHours() * 60 + t.getMinutes() - 7 * 60; // minutes since 07:00
}

const SLOT_HEIGHT = 48; // px per 30 min

export default function ReceptionSchedule() {
  const [date, setDate] = useState(toDateStr(new Date()));

  const { data: appointments } = useSWR("/appointments", fetcher);
  const { data: employees } = useSWR("/users?role=EMPLOYEE", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
  const { data: services } = useSWR("/services", fetcher);

  const clientMap = useMemo(() => Object.fromEntries((clients ?? []).map((c: any) => [c.id, c.name])), [clients]);
  const employeeMap = useMemo(() => Object.fromEntries((employees ?? []).map((e: any) => [e.id, e.name])), [employees]);
  const serviceMap = useMemo(() => Object.fromEntries((services ?? []).map((s: any) => [s.id, s.name])), [services]);

  const dayAppts = useMemo(() => {
    return (appointments ?? [])
      .filter((a: any) => a.startTime.startsWith(date) && a.status !== "CANCELLED")
      .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  }, [appointments, date]);

  const todayRevenue = dayAppts
    .filter((a: any) => a.status === "COMPLETED" && a.price)
    .reduce((s: number, a: any) => s + (a.price ?? 0), 0);

  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const totalMinutes = 14 * 60; // 07:00–21:00
  const timelineH = (totalMinutes / 30) * SLOT_HEIGHT;

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Denní harmonogram</h1>
              <p className="text-sm text-gray-500 capitalize mt-0.5">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDate(addDays(date, -1))}
                className="btn-secondary p-1.5"
              >
                <ChevronLeft size={18} />
              </button>
              <input
                type="date"
                className="input text-sm py-1.5 w-40"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <button
                onClick={() => setDate(addDays(date, 1))}
                className="btn-secondary p-1.5"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setDate(toDateStr(new Date()))}
                className="btn-secondary text-xs py-1.5 flex items-center gap-1"
              >
                <Calendar size={14} /> Dnes
              </button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-gray-900">{dayAppts.length}</p>
              <p className="text-xs text-gray-500">Termínů</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-green-600">{dayAppts.filter((a: any) => a.status === "CONFIRMED").length}</p>
              <p className="text-xs text-gray-500">Potvrzeno</p>
            </div>
            <div className="card text-center py-3">
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(todayRevenue)}</p>
              <p className="text-xs text-gray-500">Výnosy dne</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-0 overflow-hidden">
            <div className="flex">
              {/* Time column */}
              <div className="w-14 flex-shrink-0 bg-gray-50 border-r border-gray-100" style={{ height: timelineH + 32 }}>
                <div className="h-8" /> {/* header spacer */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="border-t border-gray-100 text-xs text-gray-400 px-2 pt-0.5"
                    style={{ height: SLOT_HEIGHT * 2 }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-x-auto">
                <div className="relative" style={{ height: timelineH + 32, minWidth: 400 }}>
                  {/* Header */}
                  <div className="h-8 border-b border-gray-100 bg-gray-50 px-4 flex items-center">
                    <span className="text-xs text-gray-500 font-medium">Termíny</span>
                  </div>

                  {/* Hour lines */}
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-gray-100"
                      style={{ top: 32 + ((h - 7) * 60 / 30) * SLOT_HEIGHT }}
                    />
                  ))}

                  {/* Appointments */}
                  {dayAppts.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pt-12">
                      <p className="text-gray-400 text-sm">Žádné termíny na tento den.</p>
                    </div>
                  )}

                  {dayAppts.map((a: any, idx: number) => {
                    const startMin = apptMinOffset(a.startTime);
                    const endMin = apptMinOffset(a.endTime);
                    const durationMin = endMin - startMin;
                    const topPx = 32 + (startMin / 30) * SLOT_HEIGHT;
                    const heightPx = Math.max((durationMin / 30) * SLOT_HEIGHT, 28);
                    // Simple column offset to avoid overlap (naive: offset by index mod 3)
                    const colOffset = (idx % 3) * 4;

                    return (
                      <div
                        key={a.id}
                        className={`absolute rounded border text-xs px-2 py-0.5 shadow-sm overflow-hidden ${STATUS_COLORS[a.status] ?? "bg-gray-100"}`}
                        style={{
                          top: topPx,
                          height: heightPx,
                          left: `${4 + colOffset}%`,
                          right: "4%",
                        }}
                        title={`${clientMap[a.clientId] ?? "?"} — ${serviceMap[a.serviceId] ?? "?"}`}
                      >
                        <span className="font-medium truncate block">
                          {new Date(a.startTime).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}{clientMap[a.clientId] ?? `#${a.clientId}`}
                        </span>
                        {heightPx > 36 && (
                          <span className="text-gray-500 truncate block">
                            {serviceMap[a.serviceId] ?? "?"} · {employeeMap[a.employeeId] ?? "?"}
                          </span>
                        )}
                        {heightPx > 52 && (
                          <span className="font-medium">{STATUS_LABELS[a.status]}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
