"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface MetricsData {
  uptimeSeconds: number;
  activeRequests: number;
  totalRequests: number;
  totalErrors: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  topRoutes: Array<{
    method: string;
    route: string;
    count: number;
    avgMs: number;
  }>;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export default function MonitoringPage() {
  const { accessToken: token } = useAuth();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const doFetch = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health/metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMetrics(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch metrics");
      } finally {
        setLoading(false);
      }
    };
    doFetch();
    if (!autoRefresh) return;
    const interval = setInterval(doFetch, 10_000);
    return () => clearInterval(interval);
  }, [token, autoRefresh]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          📊 Monitoring
        </h1>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          Auto-refresh (10s)
        </label>
      </div>

      {loading && !metrics && (
        <div className="text-center py-12 text-gray-500">Načítání metrik…</div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {metrics && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatUptime(metrics.uptimeSeconds)}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Celkem požadavků</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.totalRequests.toLocaleString("cs-CZ")}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Aktivní</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.activeRequests}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400">Chyby</div>
              <div className={`text-2xl font-bold ${metrics.totalErrors > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                {metrics.totalErrors}
              </div>
            </div>
          </div>

          {/* Memory */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              💾 Paměť (MB)
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">RSS</div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.memory.rss} MB
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Heap Used</div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.memory.heapUsed} MB
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Heap Total</div>
                <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {metrics.memory.heapTotal} MB
                </div>
              </div>
            </div>
            {/* Heap usage bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {Math.round((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100)}% heap utilized
              </div>
            </div>
          </div>

          {/* Top routes */}
          {metrics.topRoutes.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                🔥 Top Routes
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                      <th className="pb-2 pr-4">Method</th>
                      <th className="pb-2 pr-4">Route</th>
                      <th className="pb-2 pr-4 text-right">Requests</th>
                      <th className="pb-2 text-right">Avg (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 dark:text-gray-100">
                    {metrics.topRoutes.map((r, i) => (
                      <tr key={i} className="border-b dark:border-gray-700/50">
                        <td className="py-2 pr-4">
                          <span className={`inline-block px-2 py-0.5 text-xs font-mono rounded ${
                            r.method === "GET" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                            r.method === "POST" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                            "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                          }`}>
                            {r.method}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{r.route}</td>
                        <td className="py-2 pr-4 text-right">{r.count.toLocaleString("cs-CZ")}</td>
                        <td className={`py-2 text-right font-mono ${r.avgMs > 500 ? "text-red-500" : r.avgMs > 100 ? "text-yellow-500" : "text-green-500"}`}>
                          {r.avgMs}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
