"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { SkeletonStats, SkeletonFinanceCard } from "@/components/Skeleton";

function MonthlyReportTab() {
  const shouldReduce = useReducedMotion();
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [exportingCsv, setExportingCsv] = useState(false);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const blob = await api.getBlob(`/reports/monthly/export/csv?year=${year}&month=${month}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `monthly-report-${year}-${String(month).padStart(2, "0")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  };

  const { data: report, isLoading } = useSWR<any>(
    `/reports/monthly?year=${year}&month=${month}`,
    (url: string) => api.get<any>(url)
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="card flex flex-wrap gap-4 items-end"
      >
        <div>
          <label className="label">Rok</label>
          <input
            type="number"
            className="input w-24"
            value={year}
            min={2020}
            max={2030}
            onChange={(e) => setYear(parseInt(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Měsíc</label>
          <select
            className="input w-32"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {[
              [1, "Leden"], [2, "Únor"], [3, "Březen"], [4, "Duben"],
              [5, "Květen"], [6, "Červen"], [7, "Červenec"], [8, "Srpen"],
              [9, "Září"], [10, "Říjen"], [11, "Listopad"], [12, "Prosinec"]
            ].map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <motion.button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            {exportingCsv ? "Exportuji…" : "↓ Exportovat CSV"}
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <SkeletonStats count={4} />
            <SkeletonFinanceCard />
            <SkeletonFinanceCard />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {report && (
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Celkové výnosy", value: formatCurrency(report.revenue?.total ?? 0), color: "text-green-600" },
                { label: "Rezervací celkem", value: report.appointments?.total ?? 0, color: "text-gray-900" },
                { label: "Úspěšnost", value: `${report.appointments?.completionRate ?? 0}%`, color: "text-blue-600" },
                { label: "Noví klienti", value: report.newClients ?? 0, color: "text-purple-600" },
              ].map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                  className="card text-center"
                >
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
                className="card"
              >
                <h3 className="font-semibold text-gray-900 mb-3">Přehled rezervací</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {[
                      ["Dokončeno", report.appointments?.completed, "text-green-600"],
                      ["Potvrzeno", report.appointments?.confirmed, "text-blue-600"],
                      ["Čeká", report.appointments?.pending, "text-yellow-600"],
                      ["Zrušeno", report.appointments?.cancelled, "text-gray-500"],
                      ["Neoprávněné storno", report.appointments?.unjustifiedCancel, "text-red-600"],
                    ].map(([label, val, cls], i) => (
                      <motion.tr
                        key={label as string}
                        initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.22 + i * 0.03 }}
                        className="border-b border-gray-50 last:border-0"
                      >
                        <td className="py-2 text-gray-600">{label}</td>
                        <td className={`py-2 text-right font-semibold ${cls}`}>{val ?? 0}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>

              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.25 }}
                className="card"
              >
                <h3 className="font-semibold text-gray-900 mb-3">Výnosy dle služeb</h3>
                {(report.revenue?.byService ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500">Žádná data</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="text-left py-1">Služba</th>
                        <th className="text-right py-1">Počet</th>
                        <th className="text-right py-1">Výnosy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.revenue?.byService ?? []).map((s: any, i: number) => (
                        <motion.tr
                          key={i}
                          initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.27 + i * 0.03 }}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-2 text-gray-600">#{s.serviceId}</td>
                          <td className="py-2 text-right text-gray-700">{s.count}</td>
                          <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(s.total)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </motion.div>

              {(report.topClients ?? []).length > 0 && (
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.3 }}
                  className="card"
                >
                  <h3 className="font-semibold text-gray-900 mb-3">Top klienti</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="text-left py-1">Klient</th>
                        <th className="text-right py-1">Rezervací</th>
                        <th className="text-right py-1">Výnosy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.topClients ?? []).map((c: any, i: number) => (
                        <motion.tr
                          key={i}
                          initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.32 + i * 0.03 }}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-2 text-gray-600">#{c.clientId}</td>
                          <td className="py-2 text-right text-gray-700">{c.count}</td>
                          <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(c.revenue)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}

              {(report.topEmployees ?? []).length > 0 && (
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.35 }}
                  className="card"
                >
                  <h3 className="font-semibold text-gray-900 mb-3">Top terapeuti</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-100">
                        <th className="text-left py-1">Terapeut</th>
                        <th className="text-right py-1">Rezervací</th>
                        <th className="text-right py-1">Výnosy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.topEmployees ?? []).map((e: any, i: number) => (
                        <motion.tr
                          key={i}
                          initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.37 + i * 0.03 }}
                          className="border-b border-gray-50 last:border-0"
                        >
                          <td className="py-2 text-gray-600">#{e.employeeId}</td>
                          <td className="py-2 text-right text-gray-700">{e.count}</td>
                          <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(e.revenue)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </div>

            <motion.div
              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.4 }}
              className="card"
            >
              <p className="text-xs text-gray-500">
                Průměrná hodnota sezení: <span className="font-semibold text-gray-800">{formatCurrency(report.avgSessionValue ?? 0)}</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const fetcher = (url: string) => api.get<any>(url);

function LoyaltyLeaderboardTab() {
  const shouldReduce = useReducedMotion();
  const { data: leaderboard, isLoading } = useSWR<any[]>("/loyalty/leaderboard?limit=20", fetcher);
  return (
    <div>
      <motion.h2
        initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="text-lg font-semibold text-gray-900 mb-4"
      >
        Top klienti — věrnostní body
      </motion.h2>
      <AnimatePresence>
        {isLoading && (
          <motion.p
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-gray-500 text-sm"
          >
            Načítám...
          </motion.p>
        )}
      </AnimatePresence>
      {!isLoading && (!leaderboard || leaderboard.length === 0) && (
        <motion.p
          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="text-gray-500 text-sm"
        >
          Zatím žádné věrnostní body.
        </motion.p>
      )}
      {leaderboard && leaderboard.length > 0 && (
        <motion.div
          initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
          className="card overflow-x-auto"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">#</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Klient</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Email</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Body</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row: any, i: number) => (
                <motion.tr
                  key={row.user_id}
                  initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="py-2 px-3 text-gray-500 font-medium">{i + 1}.</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{row.name}</td>
                  <td className="py-2 px-3 text-gray-500">{row.email}</td>
                  <td className="text-right py-2 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                      ★ {row.total_points}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}

function Bar({ value, max, color = "bg-primary-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// CSS-based donut chart (SVG)
function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div className="text-center text-xs text-gray-500 py-6">Žádná data</div>;

  let offset = 0;
  const R = 40;
  const cx = 56;
  const cy = 56;
  const circumference = 2 * Math.PI * R;

  const arcs = segments.map((seg) => {
    const fraction = seg.value / total;
    const dashArray = `${fraction * circumference} ${circumference}`;
    const rotation = offset * 360 - 90;
    offset += fraction;
    return { ...seg, dashArray, rotation, fraction };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth="16" />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="16"
            strokeDasharray={arc.dashArray}
            strokeDashoffset="0"
            transform={`rotate(${arc.rotation} ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#111827">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">
          rezervací
        </text>
      </svg>
      <div className="space-y-1.5">
        {arcs.map((arc) => (
          <div key={arc.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-xs text-gray-600">{arc.label}</span>
            <span className="text-xs font-semibold text-gray-800 ml-auto pl-3">
              {arc.value} ({Math.round(arc.fraction * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingsSummaryTab() {
  const shouldReduce = useReducedMotion();
  const { data: rows, isLoading } = useSWR<any[]>("/ratings/summary", fetcher);
  return (
    <motion.div
      initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="card"
    >
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Hodnocení terapeutů</h2>
      <AnimatePresence>
        {isLoading && (
          <motion.p
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-gray-500 text-sm"
          >
            Načítám…
          </motion.p>
        )}
      </AnimatePresence>
      {!isLoading && (!rows || rows.length === 0) && (
        <motion.p
          initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="text-gray-500 text-sm"
        >
          Žádná hodnocení zatím nebyla přidána.
        </motion.p>
      )}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b text-gray-500">
              <th className="pb-2 pr-4">#</th>
              <th className="pb-2 pr-4">Terapeut</th>
              <th className="pb-2 pr-4 text-center">Počet hodnocení</th>
              <th className="pb-2 text-center">Průměr ★</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r: any, i: number) => (
              <motion.tr
                key={r.employee_id}
                initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                className="hover:bg-gray-50"
              >
                <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
                <td className="py-2 pr-4 font-medium text-gray-800">{r.employee_name}</td>
                <td className="py-2 pr-4 text-center text-gray-600">{r.total_ratings}</td>
                <td className="py-2 text-center">
                  <span className="inline-flex items-center gap-1 font-semibold text-yellow-600">
                    {r.avg_rating} ★
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
    </motion.div>
  );
}

function ExportyTab() {
  const shouldReduce = useReducedMotion();
  const [apptFrom, setApptFrom] = useState("");
  const [apptTo, setApptTo] = useState("");
  const [invFrom, setInvFrom] = useState("");
  const [invTo, setInvTo] = useState("");
  const downloadCsv = async (url: string, filename: string) => {
    const blob = await api.getBlob(url);
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="card"
      >
        <h2 className="font-semibold text-gray-900 mb-4">Export dat</h2>
        <div className="space-y-4">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.08 }}
            className="flex items-center justify-between border-b border-gray-100 pb-4"
          >
            <div>
              <p className="font-medium text-gray-800">Klienti</p>
              <p className="text-xs text-gray-500">Seznam aktivních klientů s věrnostními body</p>
            </div>
            <motion.button
              onClick={() => downloadCsv("/export/clients.csv", "clients.csv")}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-secondary text-sm"
            >
              ↓ clients.csv
            </motion.button>
          </motion.div>
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.12 }}
            className="border-b border-gray-100 pb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-800">Rezervace</p>
                <p className="text-xs text-gray-500">Export rezervací v daném rozsahu</p>
              </div>
              <motion.button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (apptFrom) params.set("from", apptFrom);
                  if (apptTo) params.set("to", apptTo);
                  const qs = params.toString() ? `?${params.toString()}` : "";
                  downloadCsv(`/export/appointments.csv${qs}`, "appointments.csv");
                }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-secondary text-sm"
              >
                ↓ appointments.csv
              </motion.button>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="label text-xs">Od</label>
                <input type="date" className="input text-sm py-1" value={apptFrom} onChange={(e) => setApptFrom(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Do</label>
                <input type="date" className="input text-sm py-1" value={apptTo} onChange={(e) => setApptTo(e.target.value)} />
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.16 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-gray-800">Faktury</p>
                <p className="text-xs text-gray-500">Export faktur v daném rozsahu (pouze ADMIN)</p>
              </div>
              <motion.button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (invFrom) params.set("from", invFrom);
                  if (invTo) params.set("to", invTo);
                  const qs = params.toString() ? `?${params.toString()}` : "";
                  downloadCsv(`/export/invoices.csv${qs}`, "invoices.csv");
                }}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-secondary text-sm"
              >
                ↓ invoices.csv
              </motion.button>
            </div>
            <div className="flex gap-3">
              <div>
                <label className="label text-xs">Od</label>
                <input type="date" className="input text-sm py-1" value={invFrom} onChange={(e) => setInvFrom(e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">Do</label>
                <input type="date" className="input text-sm py-1" value={invTo} onChange={(e) => setInvTo(e.target.value)} />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function RevenueReportsTab() {
  const shouldReduce = useReducedMotion();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data: monthlyData, isLoading: isLoadingMonthly } = useSWR<any>(
    `/reports/revenue-monthly?year=${year}`,
    (url: string) => api.get<any>(url)
  );
  const { data: occupancyData, isLoading: isLoadingOccupancy } = useSWR<any>(
    "/reports/occupancy-weekly",
    (url: string) => api.get<any>(url)
  );

  const maxRevenue = monthlyData?.months
    ? Math.max(...monthlyData.months.map((m: any) => m.totalRevenue), 1)
    : 1;

  const MONTH_NAMES = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];

  return (
    <div className="space-y-6">
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="card"
      >
        <div className="flex items-center gap-4 mb-4">
          <h2 className="font-semibold text-gray-900">Měsíční výnosy</h2>
          <input
            type="number"
            className="input w-24 text-sm py-1"
            value={year}
            min={2020}
            max={2030}
            onChange={(e) => setYear(parseInt(e.target.value))}
          />
        </div>
        <AnimatePresence>
          {isLoadingMonthly && (
            <motion.p
              initial={shouldReduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-gray-500"
            >
              Načítám...
            </motion.p>
          )}
        </AnimatePresence>
        {monthlyData?.months && (
          <div className="space-y-2">
            {monthlyData.months.map((m: any, i: number) => (
              <motion.div
                key={m.month}
                initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                className="flex items-center gap-3"
              >
                <span className="text-xs text-gray-500 w-8 flex-shrink-0">{MONTH_NAMES[m.month - 1]}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${maxRevenue > 0 ? Math.min((m.totalRevenue / maxRevenue) * 100, 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-28 text-right">
                  {formatCurrency(m.totalRevenue)}
                </span>
                <span className="text-xs text-gray-500 w-16 text-right">
                  {m.completedAppointments} rezervací
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
        className="card"
      >
        <h2 className="font-semibold text-gray-900 mb-4">Týdenní obsazenost (posledních 90 dní)</h2>
        <AnimatePresence>
          {isLoadingOccupancy && (
            <motion.p
              initial={shouldReduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-gray-500"
            >
              Načítám...
            </motion.p>
          )}
        </AnimatePresence>
        {occupancyData?.weeks && (
          occupancyData.weeks.length === 0 ? (
            <p className="text-xs text-gray-500">Žádná data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2">Týden od</th>
                    <th className="text-right py-2">Celkem slotů</th>
                    <th className="text-right py-2">Obsazeno</th>
                    <th className="text-right py-2">Obsazenost</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancyData.weeks.map((w: any, i: number) => (
                    <motion.tr
                      key={w.week}
                      initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.025 }}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2 text-gray-700">{w.week}</td>
                      <td className="py-2 text-right text-gray-500">{w.totalSlots}</td>
                      <td className="py-2 text-right text-gray-700">{w.bookedSlots}</td>
                      <td className="py-2 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.occupancyRate >= 80 ? "bg-green-100 text-green-700" :
                          w.occupancyRate >= 50 ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {w.occupancyRate}%
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </motion.div>
    </div>
  );
}

export default function AdminStats() {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"overview" | "monthly" | "loyalty" | "ratings" | "exports" | "revenue-reports">("overview");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [statsDays, setStatsDays] = useState("30");

  const url = `/stats${from || to ? "?" + new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }) : ""}`;
  const { data: stats } = useSWR(url, fetcher);
  const { data: topClients } = useSWR<any[]>("/stats/top-clients?limit=5", fetcher);
  const { data: roomsUtil } = useSWR<any>(`/stats/rooms-utilization?days=${statsDays}`, fetcher);
  const { data: empPerf } = useSWR<any>(`/stats/employees-performance?days=${statsDays}`, fetcher);

  const maxOccupancy = stats
    ? Math.max(...Object.values(stats.occupancyByDay as Record<string, number>), 1)
    : 1;

  const tabs = [
    { id: "overview", label: "Přehled" },
    { id: "monthly", label: "Měsíční zprávy" },
    { id: "loyalty", label: "Věrnostní program" },
    { id: "ratings", label: "Hodnocení terapeutů" },
    { id: "exports", label: "Exporty" },
    { id: "revenue-reports", label: "Reporty" },
  ] as const;

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <motion.h1
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="text-2xl font-bold text-gray-900 mb-6"
          >
            Statistiky
          </motion.h1>

          {/* Tab switcher */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
            className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto"
          >
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Tab panels with AnimatePresence */}
          <AnimatePresence mode="wait">
            {activeTab === "monthly" && (
              <motion.div
                key="monthly"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <MonthlyReportTab />
              </motion.div>
            )}
            {activeTab === "loyalty" && (
              <motion.div
                key="loyalty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <LoyaltyLeaderboardTab />
              </motion.div>
            )}
            {activeTab === "ratings" && (
              <motion.div
                key="ratings"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <RatingsSummaryTab />
              </motion.div>
            )}
            {activeTab === "exports" && (
              <motion.div
                key="exports"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <ExportyTab />
              </motion.div>
            )}
            {activeTab === "revenue-reports" && (
              <motion.div
                key="revenue-reports"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <RevenueReportsTab />
              </motion.div>
            )}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="space-y-6"
              >
                {/* Date filter */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                  className="card flex flex-wrap gap-4 items-end"
                >
                  <div>
                    <label className="label">Od</label>
                    <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Do</label>
                    <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                  <motion.button
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn-secondary"
                    onClick={() => { setFrom(""); setTo(""); }}
                  >
                    Reset
                  </motion.button>
                  <AnimatePresence>
                    {(from || to) && (
                      <motion.p
                        initial={shouldReduce ? {} : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-gray-500"
                      >
                        Filtrovaný výsledek
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>

                <AnimatePresence>
                  {stats && (
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-6"
                    >
                      {/* KPI grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Celkem rezervací", value: stats.totalAppts, color: "text-gray-900" },
                          { label: "Dokončeno", value: stats.completedAppts, color: "text-green-600" },
                          { label: "Neoprávněné storno", value: stats.unjustifiedCancelAppts, color: "text-red-600" },
                          { label: "Neoprávněné storno rate", value: `${stats.unjustifiedCancelRate}%`, color: stats.unjustifiedCancelRate > 20 ? "text-red-600" : "text-orange-500" },
                        ].map((s, i) => (
                          <motion.div
                            key={s.label}
                            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                            className="card text-center"
                          >
                            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                          </motion.div>
                        ))}
                      </div>

                      {/* Revenue + clients + therapists */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          {
                            label: "Výnosy (dokončené)",
                            content: <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.revenue)}</p>,
                          },
                          {
                            label: "Klientů celkem / aktivních",
                            content: (
                              <p className="text-2xl font-bold text-primary-600">
                                {stats.totalClients}
                                <span className="text-sm text-gray-500 font-normal"> / {stats.activeClients}</span>
                              </p>
                            ),
                          },
                          {
                            label: "Terapeutů",
                            content: <p className="text-2xl font-bold text-blue-600">{stats.totalEmployees}</p>,
                          },
                        ].map((card, i) => (
                          <motion.div
                            key={card.label}
                            initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.2 + i * 0.05 }}
                            className="card"
                          >
                            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                            {card.content}
                          </motion.div>
                        ))}
                      </div>

                      {/* Donut + top services */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.3 }}
                          className="card"
                        >
                          <h2 className="font-semibold text-gray-900 mb-4">Rozložení rezervací</h2>
                          <DonutChart
                            segments={[
                              { label: "Dokončeno", value: stats.completedAppts, color: "#16a34a" },
                              { label: "Potvrzeno", value: Math.max(0, stats.confirmedAppts - stats.completedAppts), color: "#2563eb" },
                              { label: "Čeká", value: stats.pendingAppts, color: "#f59e0b" },
                              { label: "Neoprávněné storno", value: stats.unjustifiedCancelAppts, color: "#dc2626" },
                              { label: "Zrušeno", value: stats.cancelledAppts, color: "#9ca3af" },
                            ].filter((s) => s.value > 0)}
                          />
                        </motion.div>

                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.35 }}
                          className="card"
                        >
                          <h2 className="font-semibold text-gray-900 mb-4">Nejpoužívanější služby</h2>
                          {stats.topServices?.length === 0 ? (
                            <p className="text-xs text-gray-500">Žádná data</p>
                          ) : (
                            <div className="space-y-3">
                              {stats.topServices.map((s: any, i: number) => (
                                <motion.div
                                  key={i}
                                  initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.37 + i * 0.03 }}
                                  className="flex items-center gap-3"
                                >
                                  <span className="text-xs text-gray-500 w-5 text-right">{i + 1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-700 truncate">{s.name}</p>
                                  </div>
                                  <div className="w-24">
                                    <Bar value={s.count} max={stats.topServices[0]?.count ?? 1} color="bg-primary-400" />
                                  </div>
                                  <span className="text-xs font-semibold text-gray-700 w-8 text-right">{s.count}</span>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      </div>

                      {/* Top employees bar chart */}
                      {stats.topEmployees?.some((e: any) => e.completed > 0) && (
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.4 }}
                          className="card"
                        >
                          <h2 className="font-semibold text-gray-900 mb-4">Terapeuti — dokončené sezení</h2>
                          <div className="space-y-2">
                            {stats.topEmployees.map((e: any, i: number) => (
                              <motion.div
                                key={i}
                                initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.42 + i * 0.03 }}
                                className="flex items-center gap-3"
                              >
                                <span className="text-xs text-gray-500 w-5 text-right">{i + 1}.</span>
                                <span className="text-sm text-gray-700 w-32 truncate">{e.name}</span>
                                <Bar value={e.completed} max={stats.topEmployees[0]?.completed ?? 1} color="bg-green-400" />
                                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{e.completed}</span>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Occupancy by day */}
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.45 }}
                        className="card"
                      >
                        <h2 className="font-semibold text-gray-900 mb-4">Obsazenost — posledních 14 dní</h2>
                        {Object.keys(stats.occupancyByDay).length === 0 ? (
                          <p className="text-xs text-gray-500">Žádná data pro toto období</p>
                        ) : (
                          <div className="space-y-2">
                            {Object.entries(stats.occupancyByDay as Record<string, number>)
                              .sort(([a], [b]) => a.localeCompare(b))
                              .map(([day, count], i) => (
                                <motion.div
                                  key={day}
                                  initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.47 + i * 0.025 }}
                                  className="flex items-center gap-3"
                                >
                                  <span className="text-xs text-gray-500 w-24 flex-shrink-0">{day}</span>
                                  <Bar value={count as number} max={maxOccupancy} />
                                  <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count as number}</span>
                                </motion.div>
                              ))}
                          </div>
                        )}
                      </motion.div>

                      {/* Top 5 clients */}
                      {(topClients ?? []).length > 0 && (
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.5 }}
                          className="card"
                        >
                          <h2 className="font-semibold text-gray-900 mb-4">Top klienti (dle aktivity)</h2>
                          <div className="space-y-2">
                            {(topClients ?? []).map((c: any, i: number) => (
                              <motion.div
                                key={c.clientId}
                                initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.52 + i * 0.03 }}
                                className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-5">#{i + 1}</span>
                                  <div>
                                    <p className="font-medium text-gray-900">{c.clientName ?? `Klient #${c.clientId}`}</p>
                                    <p className="text-xs text-gray-500">{c.completedCount} rezervací · skóre {c.behaviorScore?.toFixed(0)}</p>
                                  </div>
                                </div>
                                <span className="text-xs font-semibold text-gray-700">{formatCurrency(c.totalRevenue)}</span>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Revenue by month */}
                      {stats.revenueByMonth && Object.keys(stats.revenueByMonth).length > 0 && (
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.55 }}
                          className="card"
                        >
                          <h2 className="font-semibold text-gray-900 mb-4">Výnosy po měsících — posledních 12 měsíců</h2>
                          {(() => {
                            const entries = Object.entries(stats.revenueByMonth as Record<string, number>)
                              .sort(([a], [b]) => a.localeCompare(b));
                            const maxRev = Math.max(...entries.map(([, v]) => v as number), 1);
                            const total12 = entries.reduce((s, [, v]) => s + (v as number), 0);
                            return (
                              <>
                                <div className="text-xs text-gray-500 mb-3">
                                  Celkem za 12 měsíců: <span className="font-semibold text-gray-800">{formatCurrency(total12)}</span>
                                </div>
                                <div className="space-y-2">
                                  {entries.map(([month, rev], i) => (
                                    <motion.div
                                      key={month}
                                      initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.57 + i * 0.025 }}
                                      className="flex items-center gap-3"
                                    >
                                      <span className="text-xs text-gray-500 w-20 flex-shrink-0">{month}</span>
                                      <Bar value={rev as number} max={maxRev} color="bg-emerald-500" />
                                      <span className="text-xs font-semibold text-gray-700 w-24 text-right">
                                        {formatCurrency(rev as number)}
                                      </span>
                                    </motion.div>
                                  ))}
                                </div>
                              </>
                            );
                          })()}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Rooms + Employees period selector */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                  className="card flex flex-wrap gap-4 items-center"
                >
                  <h2 className="font-semibold text-gray-900 mr-auto">Obsazenost místností & výkon</h2>
                  <label className="text-sm text-gray-600">Období:</label>
                  <select
                    className="input w-auto text-sm py-1.5"
                    value={statsDays}
                    onChange={(e) => setStatsDays(e.target.value)}
                  >
                    <option value="7">7 dní</option>
                    <option value="30">30 dní</option>
                    <option value="90">90 dní</option>
                    <option value="365">1 rok</option>
                  </select>
                </motion.div>

                {/* Rooms utilization */}
                <AnimatePresence>
                  {roomsUtil && (
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      className="card"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900">Obsazenost místností</h2>
                        <span className="text-xs text-gray-500">Posledních {roomsUtil.periodDays} dní</span>
                      </div>
                      {roomsUtil.rooms?.length === 0 ? (
                        <p className="text-sm text-gray-500">Žádné místnosti</p>
                      ) : (
                        <div className="space-y-4">
                          {roomsUtil.rooms?.map((room: any, i: number) => (
                            <motion.div
                              key={room.id}
                              initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.04 }}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800">{room.name}</span>
                                  {!room.isActive && (
                                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">neaktivní</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <span>{room.totalAppointments} rezervací</span>
                                  <span className="font-semibold text-gray-800">{room.utilizationPct}%</span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    room.utilizationPct >= 80 ? "bg-green-500" :
                                    room.utilizationPct >= 50 ? "bg-blue-500" :
                                    room.utilizationPct >= 20 ? "bg-yellow-400" : "bg-gray-300"
                                  }`}
                                  style={{ width: `${room.utilizationPct}%` }}
                                />
                              </div>
                              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                <span className="text-green-600">✓ {room.completedAppointments} dokončeno</span>
                                <span className="text-red-400">✗ {room.cancelledAppointments} zrušeno</span>
                                <span className="ml-auto">{room.avgPerDay}/den průměr</span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Employees performance */}
                <AnimatePresence>
                  {empPerf && (
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                      className="card"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900">Výkon terapeutů</h2>
                        <span className="text-xs text-gray-500">Posledních {empPerf.periodDays} dní</span>
                      </div>
                      {empPerf.employees?.length === 0 ? (
                        <p className="text-sm text-gray-500">Žádní terapeuti</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Terapeut</th>
                                <th className="text-center py-2 px-2 text-gray-500 font-medium">Rezervací</th>
                                <th className="text-center py-2 px-2 text-gray-500 font-medium">Dokončeno</th>
                                <th className="text-center py-2 px-2 text-gray-500 font-medium">Zrušeno</th>
                                <th className="text-center py-2 px-2 text-gray-500 font-medium">Úspěšnost</th>
                                <th className="text-right py-2 pl-2 text-gray-500 font-medium">Průměr/den</th>
                              </tr>
                            </thead>
                            <tbody>
                              {empPerf.employees?.map((emp: any, i: number) => (
                                <motion.tr
                                  key={emp.id}
                                  initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-3 pr-4">
                                    <p className="font-medium text-gray-800">{emp.name}</p>
                                    <p className="text-xs text-gray-500">{emp.email}</p>
                                  </td>
                                  <td className="text-center py-3 px-2 font-semibold text-gray-700">{emp.totalAppointments}</td>
                                  <td className="text-center py-3 px-2 text-green-600">{emp.completedAppointments}</td>
                                  <td className="text-center py-3 px-2 text-red-400">{emp.cancelledAppointments}</td>
                                  <td className="text-center py-3 px-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                      emp.completionRate >= 80 ? "bg-green-100 text-green-700" :
                                      emp.completionRate >= 60 ? "bg-yellow-100 text-yellow-700" :
                                      "bg-red-100 text-red-700"
                                    }`}>
                                      {emp.completionRate}%
                                    </span>
                                  </td>
                                  <td className="text-right py-3 pl-2 text-gray-600">{emp.avgPerDay}</td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
