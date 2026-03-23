"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, FileText, Download, Edit2, X, Check } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

const fetcher = (url: string) => api.get<any[]>(url);

interface ReportFormState {
  clientId: string;
  title: string;
  content: string;
  diagnosis: string;
  recommendations: string;
}

const emptyForm = (): ReportFormState => ({
  clientId: "",
  title: "",
  content: "",
  diagnosis: "",
  recommendations: "",
});

export default function EmployeeReports() {
  const shouldReduce = useReducedMotion();
  const { data: reports, mutate } = useSWR("/medical-reports", fetcher);
  const { data: clients } = useSWR("/clients", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReportFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof ReportFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openNew = () => {
    haptics.light();
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  };

  const openEdit = (r: any) => {
    haptics.light();
    setEditingId(r.id);
    setForm({
      clientId: String(r.clientId),
      title: r.title ?? "",
      content: r.content ?? "",
      diagnosis: r.diagnosis ?? "",
      recommendations: r.recommendations ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId !== null) {
        await api.patch(`/medical-reports/${editingId}`, {
          title: form.title,
          content: form.content,
          diagnosis: form.diagnosis || undefined,
          recommendations: form.recommendations || undefined,
        });
      } else {
        await api.post("/medical-reports", {
          clientId: parseInt(form.clientId),
          title: form.title,
          content: form.content,
          diagnosis: form.diagnosis || undefined,
          recommendations: form.recommendations || undefined,
        });
      }
      haptics.success();
      closeForm();
      mutate();
    } catch {
      setError("Uložení selhalo. Zkuste to znovu.");
    } finally {
      setSaving(false);
    }
  };

  const clientName = (clientId: number) =>
    clients?.find((c: any) => c.id === clientId)?.name ?? `Klient #${clientId}`;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Lékařské zprávy</h1>
            <motion.button
              onClick={openNew}
              whileTap={shouldReduce ? undefined : { scale: 0.96 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Nová zpráva
            </motion.button>
          </div>

          <AnimatePresence initial={false}>
            {showForm && (
              <motion.form
                key="report-form"
                onSubmit={handleSave}
                initial={shouldReduce ? false : { opacity: 0, scale: 0.97, y: -14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -10 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className="card mb-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    {editingId !== null ? "Upravit zprávu" : "Nová zpráva"}
                  </h2>
                  <motion.button
                    type="button"
                    onClick={closeForm}
                    whileTap={shouldReduce ? undefined : { scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <X size={18} />
                  </motion.button>
                </div>

                {!editingId && (
                  <div>
                    <label className="label" htmlFor="report-client">Klient</label>
                    <select id="report-client" className="input" value={form.clientId} onChange={setField("clientId")} required>
                      <option value="">Vyberte klienta…</option>
                      {clients?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="report-title">Název</label>
                  <input id="report-title" className="input" value={form.title} onChange={setField("title")} required />
                </div>
                <div>
                  <label className="label" htmlFor="report-content">Obsah zprávy</label>
                  <textarea
                    id="report-content"
                    className="input min-h-[120px]"
                    value={form.content}
                    onChange={setField("content")}
                    required
                  />
                </div>
                <div>
                  <label className="label">Diagnóza</label>
                  <input className="input" value={form.diagnosis} onChange={setField("diagnosis")} />
                </div>
                <div>
                  <label className="label">Doporučení</label>
                  <textarea className="input" value={form.recommendations} onChange={setField("recommendations")} />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      className="text-sm text-red-600"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex gap-3">
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    <Check size={14} />
                    {saving ? "Ukládám…" : editingId !== null ? "Uložit změny" : "Vytvořit zprávu"}
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                    className="btn-secondary"
                    onClick={closeForm}
                  >
                    Zrušit
                  </motion.button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <div
            className="space-y-4"
          >
            <AnimatePresence>
              {(!reports || reports.length === 0) && (
                <motion.div
                  key="empty"
                  initial={shouldReduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="card text-center text-gray-500 dark:text-gray-400 py-12"
                >
                  <FileText size={36} className="mx-auto mb-3 opacity-30" />
                  <p>Žádné zprávy. Klikněte na &bdquo;Nová zpráva&ldquo; pro vytvoření.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {reports?.map((r: any, i: number) => (
              <motion.div
                key={r.id}
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                layout
                className="card"
              >
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">{r.title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{clientName(r.clientId)} · {formatDate(r.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <motion.button
                          onClick={() => openEdit(r)}
                          whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                          transition={{ type: "spring", stiffness: 500, damping: 22 }}
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                          title="Upravit zprávu"
                        >
                          <Edit2 size={11} /> Upravit
                        </motion.button>
                        <a
                          href={`${apiBase}/pdf/medical-report/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                          title="Stáhnout PDF"
                        >
                          <Download size={11} /> PDF
                        </a>
                        <a
                          href={`${apiBase}/docx/medical-report/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                          title="Stáhnout DOCX"
                        >
                          <Download size={11} /> DOCX
                        </a>
                      </div>
                    </div>

                    {r.content && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">{r.content}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {r.diagnosis && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Diagnóza:</span> {r.diagnosis}
                        </p>
                      )}
                      {r.recommendations && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Doporučení:</span> {r.recommendations}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
