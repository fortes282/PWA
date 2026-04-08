"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useParams } from "next/navigation";
import {
  Calendar, CheckCircle2, XCircle, AlertCircle, Star, FileText,
  TrendingUp, ChevronLeft, Target, Award
} from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any>(url);

function BarChart({ data, valueKey, labelKey, color = "#6366f1" }: {
  data: any[];
  valueKey: string;
  labelKey: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d[valueKey] ?? 0), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs text-gray-500 font-medium">{d[valueKey] ?? 0}</span>
          <div className="w-full bg-gray-100 rounded-t" style={{ height: 64 }}>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: `${((d[valueKey] ?? 0) / max) * 64}px`,
                marginTop: `${64 - ((d[valueKey] ?? 0) / max) * 64}px`,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="text-[10px] text-gray-500 text-center leading-tight">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  );
}

export default function EmployeeClientDetail() {
  const params = useParams();
  const clientId = params?.id as string;

  const { data: progress, isLoading, error } = useSWR<any>(
    clientId ? `/reports/progress/${clientId}` : null,
    fetcher as any
  );

  const { data: goals } = useSWR<any[]>(
    clientId ? `/clients/${clientId}/health-goals` : null,
    fetcher as any
  );

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/employee/clients" className="text-gray-500 hover:text-gray-600">
              <ChevronLeft size={22} />
            </Link>
            <TrendingUp className="text-primary" size={22} />
            <h1 className="text-xl font-bold text-gray-900">
              {progress?.client?.name ?? "Klient"} — Progress
            </h1>
          </div>

          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="card text-center text-red-500 py-8">
              <AlertCircle size={32} className="mx-auto mb-2" />
              <p>Nepodařilo se načíst data klienta</p>
            </div>
          )}

          {progress && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="card text-center">
                  <Calendar size={18} className="text-primary mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">{progress.summary.completedAppointments}</p>
                  <p className="text-xs text-gray-500">absolvovaných sezení</p>
                </div>
                <div className="card text-center">
                  <Star size={18} className="text-yellow-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">
                    {progress.summary.avgRating ? `${progress.summary.avgRating}★` : "—"}
                  </p>
                  <p className="text-xs text-gray-500">průměrné hodnocení</p>
                </div>
                <div className="card text-center">
                  <CheckCircle2 size={18} className="text-green-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">
                    {progress.summary.totalAppointments > 0
                      ? `${Math.round((progress.summary.completedAppointments / progress.summary.totalAppointments) * 100)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-gray-500">docházka celkem</p>
                </div>
                <div className="card text-center">
                  <FileText size={18} className="text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">{progress.summary.totalReports}</p>
                  <p className="text-xs text-gray-500">terapeutických zpráv</p>
                </div>
              </div>

              {/* Attendance chart */}
              <div className="card mb-5">
                <h2 className="font-semibold text-gray-900 mb-4">Docházka — posledních 6 měsíců</h2>
                <BarChart data={progress.attendance} valueKey="attended" labelKey="label" color="#6366f1" />
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                    Absolvováno
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle size={12} className="text-red-400" />
                    Průměr: {
                      progress.attendance.filter((m: any) => m.planned > 0).length > 0
                        ? Math.round(
                            progress.attendance
                              .filter((m: any) => m.planned > 0)
                              .reduce((s: number, m: any) => s + (m.attendanceRate ?? 0), 0) /
                            progress.attendance.filter((m: any) => m.planned > 0).length
                          ) + "%"
                        : "—"
                    }
                  </span>
                </div>
              </div>

              {/* Ratings chart */}
              {progress.ratings.some((r: any) => r.avgRating !== null) && (
                <div className="card mb-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Hodnocení sezení (1–5 ★)</h2>
                  <BarChart
                    data={progress.ratings.map((r: any) => ({
                      ...r,
                      displayRating: r.avgRating ?? 0,
                    }))}
                    valueKey="displayRating"
                    labelKey="label"
                    color="#f59e0b"
                  />
                </div>
              )}

              {/* Milestones */}
              {progress.milestones.length > 0 && (
                <div className="card mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={16} className="text-yellow-500" />
                    <h2 className="font-semibold text-gray-900">Milníky terapie</h2>
                  </div>
                  <div className="space-y-2">
                    {progress.milestones.map((m: any, i: number) => (
                      <div key={m.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                        <span className="text-xs text-gray-500 w-6 text-center mt-0.5">{i + 1}.</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{m.title}</p>
                          <p className="text-xs text-gray-500">{m.date}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          m.status === "FINAL" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {m.status === "FINAL" ? "Finální" : "Návrh"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Latest recommendation */}
              {progress.latestRecommendation && (
                <div className="card mb-5 border-l-4 border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Target size={16} className="text-primary" />
                    <h2 className="font-semibold text-gray-900">Doporučení terapeuta</h2>
                  </div>
                  {progress.latestReportTitle && (
                    <p className="text-xs text-gray-500 mb-1">Ze zprávy: {progress.latestReportTitle}</p>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed">{progress.latestRecommendation}</p>
                </div>
              )}

              {/* Health goals */}
              {(goals?.length ?? 0) > 0 && (
                <div className="card mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={16} className="text-blue-500" />
                    <h2 className="font-semibold text-gray-900">Cíle klienta</h2>
                  </div>
                  <div className="space-y-2">
                    {(goals ?? []).map((g: any) => (
                      <div key={g.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        {g.status === "achieved"
                          ? <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                          : g.status === "abandoned"
                          ? <AlertCircle size={16} className="text-gray-500 flex-shrink-0" />
                          : <div className="w-4 h-4 border-2 border-blue-400 rounded-full flex-shrink-0" />}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{g.title}</p>
                          {g.targetDate && <p className="text-xs text-gray-500">Cíl do: {g.targetDate}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
