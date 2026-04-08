"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Building2,
  CheckCircle,
  XCircle,
  Download,
  RefreshCw,
  FileText,
  Clock,
  Send,
  Receipt,
} from "lucide-react";
import Link from "next/link";

/* ──────────────── fetchers ──────────────── */

const fetcher = (url: string) => api.get<any[]>(url);
const fetchAny = (url: string) => api.get<any>(url);

/* ──────────────── billing constants ──────────────── */

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

/* ──────────────── main page ──────────────── */

export default function AdminInsurance() {
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState<"companies" | "billing">("companies");

  /* ── companies state ── */
  const { data: companies, mutate: mutateCompanies } = useSWR("/insurance/companies", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", contactEmail: "", contactPhone: "", contractNotes: "" });
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  /* ── billing state ── */
  const { data: dashboard } = useSWR(activeTab === "billing" ? "/insurance/billing/dashboard" : null, fetchAny);
  const { data: batches, mutate: mutateBatches } = useSWR(activeTab === "billing" ? "/insurance/batches" : null, fetchAny as any);
  const { data: claims, mutate: mutateClaims } = useSWR(activeTab === "billing" ? "/insurance/claims" : null, fetchAny as any);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ insuranceCompanyId: "", period: new Date().toISOString().slice(0, 7), icp: "", icz: "" });
  const [showGenForm, setShowGenForm] = useState(false);
  const [genMsg, setGenMsg] = useState("");

  /* ── companies handlers ── */

  const handleSeedDefaults = async () => {
    setSeeding(true);
    setSeedMsg("");
    try {
      const res = await api.post<{ seededCompanies: number; seededProcedures: number; skippedCompanies: number; skippedProcedures: number }>("/insurance/seed-defaults", {});
      setSeedMsg(`Přidáno ${res.seededCompanies} pojišťoven, ${res.seededProcedures} výkonů (přeskočeno ${res.skippedCompanies}/${res.skippedProcedures} duplicit)`);
      mutateCompanies();
    } catch {
      setSeedMsg("Chyba při importu výchozích dat");
    } finally {
      setSeeding(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", name: "", contactEmail: "", contactPhone: "", contractNotes: "" });
    setShowForm(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name, contactEmail: c.contactEmail ?? "", contactPhone: c.contactPhone ?? "", contractNotes: c.contractNotes ?? "" });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/insurance/companies/${editing.id}`, form);
      } else {
        await api.post("/insurance/companies", form);
      }
      setShowForm(false);
      mutateCompanies();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Opravdu smazat pojišťovnu?")) return;
    await api.delete(`/insurance/companies/${id}`);
    mutateCompanies();
  };

  const handleToggle = async (c: any) => {
    await api.patch(`/insurance/companies/${c.id}`, { isActive: !c.isActive });
    mutateCompanies();
  };

  /* ── billing handlers ── */

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
      setGenMsg(`Davka vygenerovana: ${res.claimsCount} vykonu, ${res.totalAmount?.toFixed(2)} Kc`);
      mutateBatches();
      mutateClaims();
      setShowGenForm(false);
    } catch (err: any) {
      setGenMsg(`Chyba: ${err?.message || "Neznama chyba"}`);
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
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const url = `${API_BASE}/insurance/batches/${batchId}/xml`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
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

  /* ── tab config ── */

  const tabs = [
    { key: "companies" as const, label: "Pojišťovny", icon: <Building2 size={14} /> },
    { key: "billing" as const, label: "Fakturace pojišťovnám", icon: <Receipt size={14} /> },
  ];

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="p-6 max-w-6xl mx-auto">
          {/* ── Header ── */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex flex-wrap items-start justify-between gap-3 mb-6"
          >
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 size={24} /> Pojišťovny a fakturace
              </h1>
              <p className="text-sm text-gray-500 mt-1">Správa zdravotních pojišťoven a fakturace</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href="/admin/insurance/procedures"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Výkony a kódy
              </Link>
            </div>
          </motion.div>

          {/* ── Tabs ── */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
            className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit overflow-x-auto"
          >
            {tabs.map((tab) => (
              <motion.button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 text-primary dark:text-primary-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.icon} {tab.label}
                </span>
              </motion.button>
            ))}
          </motion.div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait">
            {activeTab === "companies" && (
              <motion.div
                key="companies"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="space-y-4"
              >
                {/* Companies action bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <motion.button
                    onClick={handleSeedDefaults}
                    disabled={seeding}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Download size={16} /> {seeding ? "Importuji..." : "Importovat výchozí kódy ČR"}
                  </motion.button>
                  <motion.button
                    onClick={openNew}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus size={16} /> Přidat pojišťovnu
                  </motion.button>
                </div>

                {/* Seed message */}
                <AnimatePresence>
                  {seedMsg && (
                    <motion.p
                      initial={shouldReduce ? {} : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="text-sm text-green-600 dark:text-green-400"
                    >
                      {seedMsg}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Companies modal */}
                <AnimatePresence>
                  {showForm && (
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    >
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg p-6"
                      >
                        <h2 className="text-lg font-bold mb-4">{editing ? "Upravit pojišťovnu" : "Nová pojišťovna"}</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1">Kód pojišťovny *</label>
                              <input
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                                required
                                placeholder="111"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Název *</label>
                              <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                                required
                                placeholder="VZP ČR"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Kontaktní email</label>
                            <input
                              value={form.contactEmail}
                              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                              placeholder="smlouvy@vzp.cz"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Kontaktní telefon</label>
                            <input
                              value={form.contactPhone}
                              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                              placeholder="+420 222 111 111"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Smluvní podmínky / poznámka</label>
                            <textarea
                              value={form.contractNotes}
                              onChange={(e) => setForm({ ...form, contractNotes: e.target.value })}
                              rows={3}
                              className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowForm(false)}
                              className="px-4 py-2 border rounded-lg text-sm dark:border-gray-600"
                            >
                              Zrušit
                            </button>
                            <motion.button
                              type="submit"
                              disabled={saving}
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                              {saving ? "Ukládám..." : "Uložit"}
                            </motion.button>
                          </div>
                        </form>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Companies table */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
                >
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Kód</th>
                        <th className="text-left px-4 py-3 font-medium">Název</th>
                        <th className="text-left px-4 py-3 font-medium">Kontakt</th>
                        <th className="text-left px-4 py-3 font-medium">Stav</th>
                        <th className="text-right px-4 py-3 font-medium">Akce</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {(companies ?? []).map((c: any, i: number) => (
                        <motion.tr
                          key={c.id}
                          initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-blue-600">{c.code}</td>
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-gray-500">
                            {c.contactEmail && <div>{c.contactEmail}</div>}
                            {c.contactPhone && <div>{c.contactPhone}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <motion.button
                              onClick={() => handleToggle(c)}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                c.isActive
                                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                  : "bg-gray-100 text-gray-500 dark:bg-gray-700"
                              }`}
                            >
                              {c.isActive ? (
                                <>
                                  <CheckCircle size={12} /> Aktivní
                                </>
                              ) : (
                                <>
                                  <XCircle size={12} /> Neaktivní
                                </>
                              )}
                            </motion.button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <motion.button
                              onClick={() => openEdit(c)}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="p-1 text-gray-500 hover:text-blue-600 rounded"
                            >
                              <Edit2 size={15} />
                            </motion.button>
                            <motion.button
                              onClick={() => handleDelete(c.id)}
                              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="p-1 text-gray-500 hover:text-red-600 rounded ml-1"
                            >
                              <Trash2 size={15} />
                            </motion.button>
                          </td>
                        </motion.tr>
                      ))}
                      {(companies ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            Žádné pojišťovny
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </motion.div>
              </motion.div>
            )}

            {activeTab === "billing" && (
              <motion.div
                key="billing"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="space-y-6"
              >
                {/* Dashboard stats */}
                {dashboard && (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      {
                        label: "Nefakturováno",
                        value: dashboard.claims.unbilled,
                        sub: `${dashboard.claims.unbilledAmount?.toFixed(0)} Kč`,
                        color: "text-yellow-600",
                        icon: <Clock size={20} />,
                      },
                      {
                        label: "Vygenerováno",
                        value: dashboard.claims.generated,
                        sub: `${dashboard.claims.generatedAmount?.toFixed(0)} Kč`,
                        color: "text-blue-600",
                        icon: <FileText size={20} />,
                      },
                      {
                        label: "Odesláno",
                        value: dashboard.claims.sent,
                        sub: "",
                        color: "text-purple-600",
                        icon: <Send size={20} />,
                      },
                      {
                        label: "Uhrazeno",
                        value: dashboard.claims.paid,
                        sub: `${dashboard.claims.paidAmount?.toFixed(0)} Kč`,
                        color: "text-green-600",
                        icon: <CheckCircle size={20} />,
                      },
                      {
                        label: "Zamítnuto",
                        value: dashboard.claims.rejected,
                        sub: "",
                        color: "text-red-600",
                        icon: <XCircle size={20} />,
                      },
                    ].map((s, i) => (
                      <motion.div
                        key={s.label}
                        initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                        className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow"
                      >
                        <div className={`flex items-center gap-2 ${s.color} mb-1`}>
                          {s.icon} <span className="text-sm font-medium">{s.label}</span>
                        </div>
                        <div className="text-2xl font-bold">{s.value}</div>
                        {s.sub && <div className="text-xs text-gray-500">{s.sub}</div>}
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Gen message */}
                <AnimatePresence>
                  {genMsg && (
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className={`p-3 rounded-lg text-sm ${
                        genMsg.startsWith("Davka")
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30"
                      }`}
                    >
                      {genMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Generate batch */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold">Generovat dávku DASTA XML</h2>
                    <motion.button
                      onClick={() => setShowGenForm(!showGenForm)}
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1"
                    >
                      <RefreshCw size={14} /> Generovat dávku
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {showGenForm && (
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={shouldReduce ? {} : { opacity: 0, height: 0 }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="overflow-hidden"
                      >
                        <form onSubmit={handleGenerate} className="space-y-3 pt-1">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-500">Pojišťovna *</label>
                              <select
                                value={genForm.insuranceCompanyId}
                                onChange={(e) => setGenForm({ ...genForm, insuranceCompanyId: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                                required
                              >
                                <option value="">— vyberte —</option>
                                {(companies ?? [])
                                  .filter((c: any) => c.isActive)
                                  .map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.code} — {c.name}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-500">Období (YYYY-MM) *</label>
                              <input
                                type="month"
                                value={genForm.period}
                                onChange={(e) => setGenForm({ ...genForm, period: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-500">IČP poskytovatele</label>
                              <input
                                value={genForm.icp}
                                onChange={(e) => setGenForm({ ...genForm, icp: e.target.value })}
                                placeholder="12345678"
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium mb-1 text-gray-500">IČZ</label>
                              <input
                                value={genForm.icz}
                                onChange={(e) => setGenForm({ ...genForm, icz: e.target.value })}
                                placeholder="87654321"
                                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <motion.button
                              type="submit"
                              disabled={generating}
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                            >
                              {generating ? "Generuji..." : "Generovat a stáhnout XML"}
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => setShowGenForm(false)}
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}
                              className="px-4 py-2 border rounded-lg text-sm dark:border-gray-600"
                            >
                              Zrušit
                            </motion.button>
                          </div>
                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Batches */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
                >
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
                      {(batches ?? []).map((b: any, i: number) => (
                        <motion.tr
                          key={b.id}
                          initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.03 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-4 py-3 font-mono text-gray-500">#{b.id}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-blue-600 font-bold">{b.insuranceCompany?.code}</span>
                            <span className="text-gray-500 ml-2 text-xs">{b.insuranceCompany?.name}</span>
                          </td>
                          <td className="px-4 py-3 font-medium">{b.period}</td>
                          <td className="px-4 py-3 text-right">{b.claimsCount}</td>
                          <td className="px-4 py-3 text-right font-medium">{b.totalAmount?.toFixed(2)} Kč</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] ?? ""}`}
                            >
                              {STATUS_LABELS[b.status] ?? b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <motion.button
                                onClick={() => handleDownloadXml(b.id)}
                                title="Stáhnout XML"
                                whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                className="p-1.5 text-gray-500 hover:text-blue-600 rounded"
                              >
                                <Download size={15} />
                              </motion.button>
                              {(BATCH_STATUS_TRANSITIONS[b.status] ?? []).map((next) => (
                                <motion.button
                                  key={next}
                                  onClick={() => handleBatchStatus(b.id, next)}
                                  whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                                  className={`px-2 py-1 text-xs rounded font-medium ${
                                    next === "PAID"
                                      ? "bg-green-600 text-white hover:bg-green-700"
                                      : next === "REJECTED"
                                        ? "bg-red-600 text-white hover:bg-red-700"
                                        : "bg-purple-600 text-white hover:bg-purple-700"
                                  }`}
                                >
                                  {next === "SENT" ? "Označit odesláno" : next === "PAID" ? "Uhrazeno" : "Zamítnuto"}
                                </motion.button>
                              ))}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                      {(batches ?? []).length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            Žádné dávky
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </motion.div>

                {/* Claims list */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                    <h2 className="font-semibold">Výkony</h2>
                    <div className="flex gap-2">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                      >
                        <option value="">Všechny stavy</option>
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <input
                        type="month"
                        value={filterPeriod}
                        onChange={(e) => setFilterPeriod(e.target.value)}
                        className="border rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Období"
                      />
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Rezervace</th>
                        <th className="text-left px-4 py-3 font-medium">Výkon</th>
                        <th className="text-left px-4 py-3 font-medium">Diagnóza</th>
                        <th className="text-right px-4 py-3 font-medium">Částka</th>
                        <th className="text-left px-4 py-3 font-medium">Stav</th>
                        <th className="text-left px-4 py-3 font-medium">Dávka</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                      {filteredClaims.map((c: any, i: number) => (
                        <motion.tr
                          key={c.id}
                          initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 30, delay: i * 0.02 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-4 py-3">{c.appointment?.startTime?.slice(0, 10) ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-blue-600 font-bold">{c.procedure?.code}</span>
                            <span className="text-gray-500 ml-1 text-xs">{c.procedure?.name}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{c.diagnosis ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-medium">{c.amount?.toFixed(2)} Kč</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ""}`}
                            >
                              {STATUS_LABELS[c.status] ?? c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                            {c.batchId ? `#${c.batchId}` : "—"}
                          </td>
                        </motion.tr>
                      ))}
                      {filteredClaims.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            Žádné výkony
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
