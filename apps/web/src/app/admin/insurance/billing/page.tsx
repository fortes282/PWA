"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { ArrowLeft, Download, RefreshCw, FileText, CheckCircle, Clock, XCircle, Send } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => api.get<any>(url);

const STATUS_LABELS: Record<string, string> = {
  UNBILLED: "Nefakturováno",
  GENERATED: "Vygenerováno",
  SENT: "Odesláno",
  PAID: "Uhrazeno",
  REJECTED: "Zamítnuto",
};

const STATUS_COLORS: Record<string, string> = {
  UNBILLED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  GENERATED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  SENT: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PAID: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const BATCH_STATUS_TRANSITIONS: Record<string, string[]> = {
  GENERATED: ["SENT"],
  SENT: ["PAID", "REJECTED"],
  PAID: [],
  REJECTED: [],
};

export default function AdminBilling() {
  const { data: dashboard } = useSWR("/insurance/billing/dashboard", fetcher);
  const { data: companies } = useSWR("/insurance/companies", fetcher as any);
  const { data: batches, mutate: mutateBatches } = useSWR("/insurance/batches", fetcher as any);
  const { data: claims, mutate: mutateClaims } = useSWR("/insurance/claims", fetcher as any);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");

  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ insuranceCompanyId: "", period: new Date().toISOString().slice(0, 7), icp: "", icz: "" });
  const [showGenForm, setShowGenForm] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genForm.insuranceCompanyId || !genForm.period) return;
    setGenerating(true);
    setGenMsg("");
    try {
      const res = await api.post<any>("/insurance/batches/generate", {
        insuranceCompanyId: parseInt(genForm.insuranceCompanyId),
        period: genForm.period,
        icp: genForm.icp || undefined,
        icz: genForm.icz || undefined,
      });
      setGenMsg(`✅ Dávka vygenerována: ${res.claimsCount} výkonů, ${res.totalAmount?.toFixed(2)} Kč`);
      mutateBatches();
      mutateClaims();
      setShowGenForm(false);
    } catch (err: any) {
      setGenMsg(`❌ Chyba: ${err?.message || "Neznámá chyba"}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleBatchStatus = async (batchId: number, status: string) => {
    await api.patch(`/insurance/batches/${batchId}`, { status });
    mutateBatches();
    mutateClaims();
  };

  const handleDownloadXml = (batchId: number) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const url = `${API_BASE}/insurance/batches/${batchId}/xml`;
    const link = document.createElement("a");
    link.href = url;
    if (token) link.href = url + `?_token=${token}`; // fallback
    // Better: fetch with auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = burl;
        a.download = `davka-${batchId}.xml`;
        a.click();
      });
  };

  const filteredClaims = (claims ?? []).filter((c: any) => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterPeriod && !c.appointment?.startTime?.startsWith(filterPeriod)) return false;
    return true;
  });

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/insurance" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
            <h1 className="text-2xl font-bold">Fakturace pojišťovnám</h1>
          </div>

          {/* Dashboard stats */}
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Nefakturováno", value: dashboard.claims.unbilled, sub: `${dashboard.claims.unbilledAmount?.toFixed(0)} Kč`, color: "text-yellow-600", icon: <Clock size={20} /> },
                { label: "Vygenerováno", value: dashboard.claims.generated, sub: `${dashboard.claims.generatedAmount?.toFixed(0)} Kč`, color: "text-blue-600", icon: <FileText size={20} /> },
                { label: "Odesláno", value: dashboard.claims.sent, sub: "", color: "text-purple-600", icon: <Send size={20} /> },
                { label: "Uhrazeno", value: dashboard.claims.paid, sub: `${dashboard.claims.paidAmount?.toFixed(0)} Kč`, color: "text-green-600", icon: <CheckCircle size={20} /> },
                { label: "Zamítnuto", value: dashboard.claims.rejected, sub: "", color: "text-red-600", icon: <XCircle size={20} /> },
              ].map((s) => (
                <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
                  <div className={`flex items-center gap-2 ${s.color} mb-1`}>{s.icon} <span className="text-sm font-medium">{s.label}</span></div>
                  <div className="text-2xl font-bold">{s.value}</div>
                  {s.sub && <div className="text-xs text-gray-500">{s.sub}</div>}
                </div>
              ))}
            </div>
          )}

          {genMsg && (
            <div className={`p-3 rounded-lg text-sm ${genMsg.startsWith("✅") ? "bg-green-50 text-green-700 dark:bg-green-900/30" : "bg-red-50 text-red-700 dark:bg-red-900/30"}`}>
              {genMsg}
            </div>
          )}

          {/* Generate batch */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Generovat dávku DASTA XML</h2>
              <button onClick={() => setShowGenForm(!showGenForm)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1">
                <RefreshCw size={14} /> Generovat dávku
              </button>
            </div>
            {showGenForm && (
              <form onSubmit={handleGenerate} className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500">Pojišťovna *</label>
                    <select value={genForm.insuranceCompanyId} onChange={e => setGenForm({ ...genForm, insuranceCompanyId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" required>
                      <option value="">— vyberte —</option>
                      {(companies ?? []).filter((c: any) => c.isActive).map((c: any) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500">Období (YYYY-MM) *</label>
                    <input type="month" value={genForm.period} onChange={e => setGenForm({ ...genForm, period: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500">IČP poskytovatele</label>
                    <input value={genForm.icp} onChange={e => setGenForm({ ...genForm, icp: e.target.value })} placeholder="12345678" className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1 text-gray-500">IČZ</label>
                    <input value={genForm.icz} onChange={e => setGenForm({ ...genForm, icz: e.target.value })} placeholder="87654321" className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={generating} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                    {generating ? "Generuji…" : "Generovat a stáhnout XML"}
                  </button>
                  <button type="button" onClick={() => setShowGenForm(false)} className="px-4 py-2 border rounded-lg text-sm dark:border-gray-600">Zrušit</button>
                </div>
              </form>
            )}
          </div>

          {/* Batches */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700">
              <h2 className="font-semibold">Dávky</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">#</th>
                  <th className="text-left px-4 py-3 font-medium">Pojišťovna</th>
                  <th className="text-left px-4 py-3 font-medium">Období</th>
                  <th className="text-right px-4 py-3 font-medium">Výkonů</th>
                  <th className="text-right px-4 py-3 font-medium">Celkem</th>
                  <th className="text-left px-4 py-3 font-medium">Stav</th>
                  <th className="text-right px-4 py-3 font-medium">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {(batches ?? []).map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono text-gray-500">#{b.id}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600 font-bold">{b.insuranceCompany?.code}</span>
                      <span className="text-gray-500 ml-2 text-xs">{b.insuranceCompany?.name}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{b.period}</td>
                    <td className="px-4 py-3 text-right">{b.claimsCount}</td>
                    <td className="px-4 py-3 text-right font-medium">{b.totalAmount?.toFixed(2)} Kč</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] ?? ""}`}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                      <button onClick={() => handleDownloadXml(b.id)} title="Stáhnout XML" className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Download size={15} />
                      </button>
                      {(BATCH_STATUS_TRANSITIONS[b.status] ?? []).map((next) => (
                        <button key={next} onClick={() => handleBatchStatus(b.id, next)}
                          className={`px-2 py-1 text-xs rounded font-medium ${next === "PAID" ? "bg-green-600 text-white hover:bg-green-700" : next === "REJECTED" ? "bg-red-600 text-white hover:bg-red-700" : "bg-purple-600 text-white hover:bg-purple-700"}`}>
                          {next === "SENT" ? "Označit odesláno" : next === "PAID" ? "Uhrazeno" : "Zamítnuto"}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
                {(batches ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Žádné dávky</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Claims list */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <h2 className="font-semibold">Výkony</h2>
              <div className="flex gap-2">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600">
                  <option value="">Všechny stavy</option>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="month" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600" placeholder="Období" />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Termín</th>
                  <th className="text-left px-4 py-3 font-medium">Výkon</th>
                  <th className="text-left px-4 py-3 font-medium">Diagnóza</th>
                  <th className="text-right px-4 py-3 font-medium">Částka</th>
                  <th className="text-left px-4 py-3 font-medium">Stav</th>
                  <th className="text-left px-4 py-3 font-medium">Dávka</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {filteredClaims.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">{c.appointment?.startTime?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600 font-bold">{c.procedure?.code}</span>
                      <span className="text-gray-500 ml-1 text-xs">{c.procedure?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.diagnosis ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{c.amount?.toFixed(2)} Kč</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.batchId ? `#${c.batchId}` : "—"}</td>
                  </tr>
                ))}
                {filteredClaims.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Žádné výkony</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
