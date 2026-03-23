"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState, useMemo } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RevenueData {
  byTherapistMonth: Array<{ month: string; therapist_id: number; therapist_name: string; count: number; revenue: number }>;
  byServiceMonth: Array<{ month: string; service_id: number; service_name: string; count: number; revenue: number }>;
  totals: Array<{ month: string; count: number; revenue: number }>;
}

interface OccupancyData {
  rooms: Array<{ room_id: number; room_name: string; appointment_count: number; booked_hours: number; available_hours: number; occupancy_rate: number }>;
  period: { from: string; to: string; workdays: number; availableHoursPerRoom: number };
}

interface RetentionData {
  cohortSize: number;
  retained1month: { count: number; rate: number };
  retained3months: { count: number; rate: number };
  retained6months: { count: number; rate: number };
  avgRelationshipDays: number;
  avgRelationshipWeeks: number;
}

interface TrendsData {
  monthly: Array<{ month: string; no_shows: number; cancellations: number; completed: number; total: number; revenue: number }>;
  newClients: Array<{ month: string; new_clients: number }>;
  forecast: Array<{ month: string; revenue: number; isForecast: boolean }>;
}

// ─── Period presets ──────────────────────────────────────────────────────────

type PeriodPreset = "month" | "3months" | "6months" | "year";

function getPeriodDates(preset: PeriodPreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now);

  switch (preset) {
    case "month":
      from.setMonth(from.getMonth() - 1);
      break;
    case "3months":
      from.setMonth(from.getMonth() - 3);
      break;
    case "6months":
      from.setMonth(from.getMonth() - 6);
      break;
    case "year":
      from.setFullYear(from.getFullYear() - 1);
      break;
  }

  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to };
}

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  month: "Tento měsíc",
  "3months": "3 měsíce",
  "6months": "6 měsíců",
  year: "Rok",
};

// ─── SVG Bar Chart ───────────────────────────────────────────────────────────

function BarChart({
  data,
  valueKey,
  labelKey,
  color = "#6366f1",
  formatValue,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <p className="text-sm text-gray-500 py-4 text-center">Žádná data</p>;

  const values = data.map((d) => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const barW = Math.max(18, Math.min(48, Math.floor(560 / data.length) - 8));
  const chartH = 160;
  const chartW = Math.max(560, data.length * (barW + 8));
  const fmt = formatValue ?? ((v: number) => String(v));

  return (
    <div className="overflow-x-auto">
      <svg width={chartW} height={chartH + 40} aria-label="Bar chart">
        {values.map((v, i) => {
          const barH = Math.max(2, Math.round((v / maxVal) * chartH));
          const x = i * (barW + 8) + 4;
          const y = chartH - barH;
          const label = String(data[i]?.[labelKey] ?? "");
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
              <title>{label}: {fmt(v)}</title>
              {barH > 18 && (
                <text
                  x={x + barW / 2}
                  y={y + 12}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#fff"
                  fontWeight="600"
                >
                  {fmt(v).length > 8 ? "" : fmt(v)}
                </text>
              )}
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                fontSize="9"
                fill="#6b7280"
                transform={`rotate(-35 ${x + barW / 2} ${chartH + 14})`}
              >
                {label.length > 10 ? label.slice(0, 9) + "…" : label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── SVG Line Chart ──────────────────────────────────────────────────────────

function LineChart({
  data,
  lines,
  labelKey,
}: {
  data: Record<string, unknown>[];
  lines: Array<{ key: string; label: string; color: string }>;
  labelKey: string;
}) {
  if (!data.length) return <p className="text-sm text-gray-500 py-4 text-center">Žádná data</p>;

  const chartH = 160;
  const chartW = Math.max(560, data.length * 48);
  const allValues = lines.flatMap((l) => data.map((d) => Number(d[l.key]) || 0));
  const maxVal = Math.max(...allValues, 1);

  const getY = (v: number) => chartH - Math.round((v / maxVal) * chartH);
  const getX = (i: number) => Math.round((i / (data.length - 1)) * (chartW - 40)) + 20;

  return (
    <div className="overflow-x-auto">
      <svg width={chartW} height={chartH + 44} aria-label="Line chart">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={20} y1={Math.round(chartH * (1 - frac))}
            x2={chartW - 20} y2={Math.round(chartH * (1 - frac))}
            stroke="#f3f4f6"
            strokeWidth="1"
          />
        ))}

        {lines.map((line) => {
          const points = data.map((d, i) => `${getX(i)},${getY(Number(d[line.key]) || 0)}`).join(" ");
          return (
            <g key={line.key}>
              <polyline
                points={points}
                fill="none"
                stroke={line.color}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {data.map((d, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(Number(d[line.key]) || 0)}
                  r={3}
                  fill={line.color}
                >
                  <title>{String(d[labelKey])}: {Number(d[line.key]) || 0}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={chartH + 14}
            textAnchor="middle"
            fontSize="9"
            fill="#6b7280"
            transform={`rotate(-35 ${getX(i)} ${chartH + 14})`}
          >
            {String(d[labelKey] ?? "").slice(0, 10)}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2">
        {lines.map((l) => (
          <div key={l.key} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Filters Panel ───────────────────────────────────────────────────────────

function FiltersPanel({
  period,
  onPeriod,
  therapistId,
  onTherapistId,
  serviceId,
  onServiceId,
}: {
  period: PeriodPreset;
  onPeriod: (p: PeriodPreset) => void;
  therapistId: string;
  onTherapistId: (v: string) => void;
  serviceId: string;
  onServiceId: (v: string) => void;
}) {
  const shouldReduce = useReducedMotion();
  const { data: therapists } = useSWR<any[]>("/users?role=EMPLOYEE&limit=100", (url: string) => api.get<any[]>(url));
  const { data: services } = useSWR<any[]>("/services", (url: string) => api.get<any[]>(url));

  return (
    <div className="card flex flex-wrap gap-4 items-end mb-6">
      <div>
        <label className="label">Období</label>
        <div className="flex gap-1">
          {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
            <motion.button
              key={p}
              onClick={() => onPeriod(p)}
              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                period === p
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {PERIOD_LABELS[p]}
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Terapeut</label>
        <select className="input w-44" value={therapistId} onChange={(e) => onTherapistId(e.target.value)}>
          <option value="">Všichni</option>
          {therapists?.map((t: any) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Služba</label>
        <select className="input w-44" value={serviceId} onChange={(e) => onServiceId(e.target.value)}>
          <option value="">Všechny</option>
          {(Array.isArray(services) ? services : (services as any)?.data ?? [])?.map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ─── Revenue Section ─────────────────────────────────────────────────────────

function RevenueSection({ params }: { params: string }) {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<RevenueData>(`/analytics/revenue?${params}`, (url: string) => api.get<RevenueData>(url));

  // Aggregate revenue by therapist (sum across months)
  const byTherapist = useMemo(() => {
    if (!data?.byTherapistMonth) return [];
    const map: Record<string, { therapist_name: string; revenue: number; count: number }> = {};
    for (const r of data.byTherapistMonth) {
      if (!map[r.therapist_name]) map[r.therapist_name] = { therapist_name: r.therapist_name, revenue: 0, count: 0 };
      map[r.therapist_name]!.revenue += Number(r.revenue) || 0;
      map[r.therapist_name]!.count += Number(r.count) || 0;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const byService = useMemo(() => {
    if (!data?.byServiceMonth) return [];
    const map: Record<string, { service_name: string; revenue: number; count: number }> = {};
    for (const r of data.byServiceMonth) {
      if (!map[r.service_name]) map[r.service_name] = { service_name: r.service_name, revenue: 0, count: 0 };
      map[r.service_name]!.revenue += Number(r.revenue) || 0;
      map[r.service_name]!.count += Number(r.count) || 0;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const totalRevenue = useMemo(() =>
    (data?.totals ?? []).reduce((s, r) => s + (Number(r.revenue) || 0), 0),
    [data]
  );

  if (isLoading) return <p className="text-sm text-gray-500">Načítám revenue data…</p>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { border: "border-green-400", label: "Celkové výnosy", value: formatCurrency(totalRevenue), color: "text-green-600 dark:text-green-400" },
          { border: "border-blue-400", label: "Počet termínů", value: (data?.totals ?? []).reduce((s, r) => s + (Number(r.count) || 0), 0), color: "text-blue-600 dark:text-blue-400" },
          { border: "border-purple-400", label: "Průměr/termín", value: (() => { const cnt = (data?.totals ?? []).reduce((s, r) => s + (Number(r.count) || 0), 0); return formatCurrency(cnt > 0 ? totalRevenue / cnt : 0); })(), color: "text-purple-600 dark:text-purple-400" },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
            className={`card border-l-4 ${card.border}`}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue by Month */}
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Výnosy po měsících</h3>
          <motion.button
            onClick={() => exportCsv(data?.totals ?? [], "revenue-monthly.csv")}
            className="btn-secondary text-xs px-3 py-1"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            ↓ Export CSV
          </motion.button>
        </div>
        <BarChart
          data={data?.totals ?? []}
          valueKey="revenue"
          labelKey="month"
          color="#22c55e"
          formatValue={(v) => formatCurrency(v)}
        />
      </motion.div>

      {/* Revenue by Therapist */}
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Výnosy per terapeut</h3>
          <motion.button
            onClick={() => exportCsv(byTherapist, "revenue-by-therapist.csv")}
            className="btn-secondary text-xs px-3 py-1"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            ↓ Export CSV
          </motion.button>
        </div>
        <BarChart
          data={byTherapist}
          valueKey="revenue"
          labelKey="therapist_name"
          color="#6366f1"
          formatValue={(v) => formatCurrency(v)}
        />
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              <th className="pb-2 pr-4">Terapeut</th>
              <th className="pb-2 pr-4 text-right">Termíny</th>
              <th className="pb-2 text-right">Výnosy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {byTherapist.map((r, i) => (
              <motion.tr
                key={r.therapist_name}
                initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.18 + i * 0.03 }}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="py-1.5 pr-4 font-medium text-gray-800 dark:text-gray-200">{r.therapist_name}</td>
                <td className="py-1.5 pr-4 text-right text-gray-600 dark:text-gray-400">{r.count}</td>
                <td className="py-1.5 text-right font-semibold text-green-700 dark:text-green-400">{formatCurrency(r.revenue)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Revenue by Service */}
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Výnosy per služba</h3>
          <motion.button
            onClick={() => exportCsv(byService, "revenue-by-service.csv")}
            className="btn-secondary text-xs px-3 py-1"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            ↓ Export CSV
          </motion.button>
        </div>
        <BarChart
          data={byService}
          valueKey="revenue"
          labelKey="service_name"
          color="#f59e0b"
          formatValue={(v) => formatCurrency(v)}
        />
      </motion.div>
    </div>
  );
}

// ─── Occupancy Section ───────────────────────────────────────────────────────

function OccupancySection({ params }: { params: string }) {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<OccupancyData>(`/analytics/occupancy?${params}`, (url: string) => api.get<OccupancyData>(url));

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Načítám obsazenost místností…</p>;

  return (
    <motion.div
      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="card"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200">Obsazenost místností</h3>
        <motion.button
          onClick={() => exportCsv(data?.rooms ?? [], "occupancy.csv")}
          className="btn-secondary text-xs px-3 py-1"
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
        >
          ↓ Export CSV
        </motion.button>
      </div>
      {(!data?.rooms?.length) && <p className="text-sm text-gray-500 dark:text-gray-400">Žádná data</p>}
      <div className="space-y-4">
        {(data?.rooms ?? []).map((room, i) => (
          <motion.div
            key={room.room_id}
            initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.06 }}
          >
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700 dark:text-gray-300">{room.room_name}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {Math.round(room.booked_hours ?? 0)}h / {room.available_hours}h
                <span className="ml-2 font-semibold text-primary-600 dark:text-primary-400">{room.occupancy_rate}%</span>
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(room.occupancy_rate, 100)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20, delay: 0.1 + i * 0.06 }}
                style={{
                  background: room.occupancy_rate > 80 ? "#ef4444" : room.occupancy_rate > 50 ? "#f59e0b" : "#22c55e",
                }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{room.appointment_count} termínů</p>
          </motion.div>
        ))}
      </div>
      {data?.period && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          Období: {data.period.from} – {data.period.to} · {data.period.workdays} pracovních dní · dostupných {data.period.availableHoursPerRoom}h/místnost
        </p>
      )}
    </motion.div>
  );
}

// ─── Retention Section ───────────────────────────────────────────────────────

function RetentionSection({ params }: { params: string }) {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<RetentionData>(`/analytics/retention?${params}`, (url: string) => api.get<RetentionData>(url));

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Načítám retenci klientů…</p>;

  if (!data) return null;

  const retentionBars = [
    { label: "Po 1 měsíci", rate: data.retained1month.rate, count: data.retained1month.count, color: "#6366f1" },
    { label: "Po 3 měsících", rate: data.retained3months.rate, count: data.retained3months.count, color: "#8b5cf6" },
    { label: "Po 6 měsících", rate: data.retained6months.rate, count: data.retained6months.count, color: "#a855f7" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { border: "border-indigo-400", label: "Kohorta klientů", value: data.cohortSize, color: "text-indigo-600 dark:text-indigo-400", sub: null },
          { border: "border-violet-400", label: "Retence 1 měsíc", value: `${data.retained1month.rate}%`, color: "text-violet-600 dark:text-violet-400", sub: null },
          { border: "border-purple-400", label: "Retence 3 měsíce", value: `${data.retained3months.rate}%`, color: "text-purple-600 dark:text-purple-400", sub: null },
          { border: "border-fuchsia-400", label: "Průměrný vztah", value: `${data.avgRelationshipWeeks} týdnů`, color: "text-fuchsia-600 dark:text-fuchsia-400", sub: `${data.avgRelationshipDays} dní` },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
            className={`card border-l-4 ${card.border}`}
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            {card.sub && <p className="text-xs text-gray-500 dark:text-gray-400">{card.sub}</p>}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
        className="card"
      >
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Míra retence klientů</h3>
        <div className="space-y-4">
          {retentionBars.map((bar, i) => (
            <motion.div
              key={bar.label}
              initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.2 + i * 0.07 }}
            >
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700 dark:text-gray-300">{bar.label}</span>
                <span className="font-semibold" style={{ color: bar.color }}>
                  {bar.rate}% <span className="text-gray-500 dark:text-gray-400 font-normal">({bar.count} klientů)</span>
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${bar.rate}%` }}
                  transition={{ type: "spring", stiffness: 80, damping: 18, delay: 0.25 + i * 0.07 }}
                  style={{ background: bar.color }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Trends Section ──────────────────────────────────────────────────────────

function TrendsSection({ params }: { params: string }) {
  const shouldReduce = useReducedMotion();
  const { data, isLoading } = useSWR<TrendsData>(`/analytics/trends?${params}`, (url: string) => api.get<TrendsData>(url));

  const trendsWithRates = useMemo(() => {
    if (!data?.monthly) return [];
    return data.monthly.map((r) => {
      const closed = (Number(r.completed) || 0) + (Number(r.no_shows) || 0);
      const noShowRate = closed > 0 ? Math.round(((Number(r.no_shows) || 0) / closed) * 100) : 0;
      const total = Number(r.total) || 0;
      const cancelRate = total > 0 ? Math.round(((Number(r.cancellations) || 0) / total) * 100) : 0;
      return { ...r, no_show_rate: noShowRate, cancel_rate: cancelRate };
    });
  }, [data]);

  if (isLoading) return <p className="text-sm text-gray-500 dark:text-gray-400">Načítám trendy…</p>;

  return (
    <div className="space-y-6">
      {/* No-show & Cancellation Rate trend */}
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">No-show & Cancellation rate trend</h3>
          <motion.button
            onClick={() => exportCsv(trendsWithRates, "trends.csv")}
            className="btn-secondary text-xs px-3 py-1"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            ↓ Export CSV
          </motion.button>
        </div>
        <LineChart
          data={trendsWithRates}
          labelKey="month"
          lines={[
            { key: "no_show_rate", label: "No-show rate (%)", color: "#ef4444" },
            { key: "cancel_rate", label: "Cancellation rate (%)", color: "#f59e0b" },
          ]}
        />
      </motion.div>

      {/* New Clients trend */}
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">Noví klienti po měsících</h3>
          <motion.button
            onClick={() => exportCsv(data?.newClients ?? [], "new-clients.csv")}
            className="btn-secondary text-xs px-3 py-1"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            ↓ Export CSV
          </motion.button>
        </div>
        <BarChart
          data={data?.newClients ?? []}
          valueKey="new_clients"
          labelKey="month"
          color="#0ea5e9"
        />
      </motion.div>

      {/* Revenue Forecast */}
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.16 }}
        className="card"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Revenue forecast (lineární projekce)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tečkované sloupce = prognóza na příštích 3 měsíce</p>
          </div>
          <motion.button
            onClick={() => exportCsv(data?.forecast ?? [], "forecast.csv")}
            className="btn-secondary text-xs px-3 py-1"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            ↓ Export CSV
          </motion.button>
        </div>

        {/* Render actual + forecast as separate bar groups */}
        <div className="overflow-x-auto">
          {(() => {
            const actual = data?.monthly ?? [];
            const forecast = data?.forecast ?? [];
            if (!actual.length && !forecast.length) return <p className="text-sm text-gray-500 dark:text-gray-400">Žádná data</p>;

            const allRevenues = [
              ...actual.map((r) => Number(r.revenue) || 0),
              ...forecast.map((r) => r.revenue),
            ];
            const maxVal = Math.max(...allRevenues, 1);
            const allMonths = [
              ...actual.map((r) => ({ month: r.month, revenue: Number(r.revenue) || 0, isForecast: false })),
              ...forecast.map((r) => ({ month: r.month, revenue: r.revenue, isForecast: true })),
            ];
            const barW = 36;
            const gap = 6;
            const chartH = 160;
            const chartW = Math.max(560, allMonths.length * (barW + gap));

            return (
              <svg width={chartW} height={chartH + 40} aria-label="Revenue forecast chart">
                {allMonths.map((m, i) => {
                  const barH = Math.max(2, Math.round((m.revenue / maxVal) * chartH));
                  const x = i * (barW + gap) + 3;
                  const y = chartH - barH;
                  const color = m.isForecast ? "#a5b4fc" : "#22c55e";
                  return (
                    <g key={i}>
                      <rect
                        x={x} y={y} width={barW} height={barH} rx={3}
                        fill={color}
                        opacity={m.isForecast ? 0.7 : 0.9}
                        strokeDasharray={m.isForecast ? "4 2" : "none"}
                        stroke={m.isForecast ? "#6366f1" : "none"}
                      />
                      <title>{m.month}{m.isForecast ? " (prognóza)" : ""}: {formatCurrency(m.revenue)}</title>
                      <text
                        x={x + barW / 2} y={chartH + 14}
                        textAnchor="middle" fontSize="9" fill={m.isForecast ? "#6366f1" : "#6b7280"}
                        transform={`rotate(-35 ${x + barW / 2} ${chartH + 14})`}
                      >
                        {m.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>

        {/* Forecast table */}
        {(data?.forecast?.length ?? 0) > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="pb-2 pr-4">Měsíc</th>
                  <th className="pb-2 text-right">Prognóza výnosů</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data?.forecast.map((r, i) => (
                  <motion.tr
                    key={r.month}
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.22 + i * 0.04 }}
                  >
                    <td className="py-1.5 pr-4 font-medium text-indigo-700 dark:text-indigo-400">{r.month} 🔮</td>
                    <td className="py-1.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(r.revenue)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

type Tab = "revenue" | "occupancy" | "retention" | "trends";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "revenue", label: "💰 Revenue" },
  { id: "occupancy", label: "🏠 Obsazenost" },
  { id: "retention", label: "🔄 Retence" },
  { id: "trends", label: "📈 Trendy & Forecast" },
];

export default function BIDashboardPage() {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<Tab>("revenue");
  const [period, setPeriod] = useState<PeriodPreset>("year");
  const [therapistId, setTherapistId] = useState("");
  const [serviceId, setServiceId] = useState("");

  const { dateFrom, dateTo } = getPeriodDates(period);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ dateFrom, dateTo });
    if (therapistId) p.set("therapistId", therapistId);
    if (serviceId) p.set("serviceId", serviceId);
    return p.toString();
  }, [dateFrom, dateTo, therapistId, serviceId]);

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              📊 Business Intelligence Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Přehled výnosů, obsazenosti, retence klientů a trendů
            </p>
          </motion.div>

          {/* Filters */}
          <FiltersPanel
            period={period}
            onPeriod={setPeriod}
            therapistId={therapistId}
            onTherapistId={setTherapistId}
            serviceId={serviceId}
            onServiceId={setServiceId}
          />

          {/* Tabs */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
            className="flex gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto"
          >
            {TABS.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-700 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {activeTab === "revenue" && (
              <motion.div
                key="revenue"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <RevenueSection params={queryParams} />
              </motion.div>
            )}
            {activeTab === "occupancy" && (
              <motion.div
                key="occupancy"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <OccupancySection params={queryParams} />
              </motion.div>
            )}
            {activeTab === "retention" && (
              <motion.div
                key="retention"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <RetentionSection params={queryParams} />
              </motion.div>
            )}
            {activeTab === "trends" && (
              <motion.div
                key="trends"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <TrendsSection params={queryParams} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
