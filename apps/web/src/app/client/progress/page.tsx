"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Activity, FileText, Calendar, Star } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
};

const SCORE_LABEL = (score: number) => {
  if (score >= 90) return "Výborný";
  if (score >= 75) return "Dobrý";
  if (score >= 60) return "Průměrný";
  if (score >= 40) return "Zhoršený";
  return "Kritický";
};

export default function ClientProgress() {
  const { user } = useAuth();

  const { data: appointments } = useSWR<any[]>(
    user ? `/appointments` : null,
    fetcher as any
  );
  const { data: credits } = useSWR<any[]>("/credits/history", fetcher as any);
  const { data: reports } = useSWR<any[]>("/medical-reports", fetcher as any);
  const { data: me } = useSWR<any>(user ? `/users/${user.id}` : null, fetcher);

  const completed = (appointments ?? []).filter((a: any) => a.status === "COMPLETED");
  const totalCompleted = completed.length;
  const totalCancelled = (appointments ?? []).filter((a: any) => a.status === "CANCELLED").length;
  const score = me?.behaviorScore ?? 100;

  // Sessions per month (last 6 months)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleDateString("cs-CZ", { month: "short" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  const sessionsPerMonth = months.map((m) => ({
    label: m.label,
    count: completed.filter((a: any) => a.startTime.startsWith(m.key)).length,
  }));
  const maxCount = Math.max(...sessionsPerMonth.map((m) => m.count), 1);

  // Credit usage
  const totalSpent = (credits ?? [])
    .filter((t: any) => t.type === "USE")
    .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  const totalPurchased = (credits ?? [])
    .filter((t: any) => t.type === "PURCHASE")
    .reduce((s: number, t: any) => s + t.amount, 0);
  const currentBalance = credits?.[0]?.balance ?? 0;

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Můj pokrok</h1>

          {/* Behavior score */}
          <div className="card mb-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star size={20} className="text-yellow-500" />
              <h2 className="font-semibold text-gray-900">Behavior skóre</h2>
            </div>
            <p className={`text-5xl font-bold ${SCORE_COLOR(score)} mb-1`}>{score}</p>
            <p className={`text-sm font-medium ${SCORE_COLOR(score)}`}>{SCORE_LABEL(score)}</p>
            <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-400" : "bg-red-400"
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Skóre se zvyšuje dochvilností a snižuje no-show nebo pozdním rušením
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="card text-center">
              <Calendar size={20} className="text-primary-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalCompleted}</p>
              <p className="text-xs text-gray-500 mt-1">Absolvovaných sezení</p>
            </div>
            <div className="card text-center">
              <FileText size={20} className="text-primary-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{reports?.length ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Terapeutických zpráv</p>
            </div>
            <div className="card text-center">
              <TrendingUp size={20} className="text-green-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{currentBalance.toFixed(0)}</p>
              <p className="text-xs text-gray-500 mt-1">Kredit zbývá</p>
            </div>
            <div className="card text-center">
              <Activity size={20} className="text-orange-500 mx-auto mb-2" />
              <p className="text-3xl font-bold text-gray-900">{totalCancelled}</p>
              <p className="text-xs text-gray-500 mt-1">Zrušených termínů</p>
            </div>
          </div>

          {/* Sessions chart */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Sezení za posledních 6 měsíců</h2>
            <div className="flex items-end gap-3 h-28">
              {sessionsPerMonth.map((m) => (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500 font-medium">{m.count}</span>
                  <div className="w-full bg-gray-100 rounded-t-md" style={{ height: "80px" }}>
                    <div
                      className="w-full bg-primary-500 rounded-t-md transition-all duration-500"
                      style={{ height: `${(m.count / maxCount) * 80}px`, marginTop: `${80 - (m.count / maxCount) * 80}px` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Credit summary */}
          <div className="card mb-6">
            <h2 className="font-semibold text-gray-900 mb-3">Přehled kreditů</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Celkem zakoupeno</span>
                <span className="font-medium text-green-600">+{totalPurchased.toFixed(0)} Kč</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Celkem využito</span>
                <span className="font-medium text-gray-700">−{totalSpent.toFixed(0)} Kč</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-700">Aktuální zůstatek</span>
                <span className="text-primary-600">{currentBalance.toFixed(0)} Kč</span>
              </div>
            </div>
          </div>

          {/* Recent reports */}
          {(reports?.length ?? 0) > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Poslední zprávy</h2>
              <div className="space-y-2">
                {(reports ?? []).slice(0, 3).map((r: any) => (
                  <div key={r.id} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                    <FileText size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{r.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
