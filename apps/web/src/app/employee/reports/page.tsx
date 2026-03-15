"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, FileText, Download, Edit2, X, Check } from "lucide-react";

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
  const { data: reports, mutate } = useSWR("/medical-reports", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReportFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof ReportFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  };

  const openEdit = (r: any) => {
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
        // Update existing report
        await api.patch(`/medical-reports/${editingId}`, {
          title: form.title,
          content: form.content,
          diagnosis: form.diagnosis || undefined,
          recommendations: form.recommendations || undefined,
        });
      } else {
        // Create new report
        await api.post("/medical-reports", {
          clientId: parseInt(form.clientId),
          title: form.title,
          content: form.content,
          diagnosis: form.diagnosis || undefined,
          recommendations: form.recommendations || undefined,
        });
      }
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

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001";

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Lékařské zprávy</h1>
            <button onClick={openNew} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nová zpráva
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSave} className="card mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  {editingId !== null ? "Upravit zprávu" : "Nová zpráva"}
                </h2>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <X size={18} />
                </button>
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

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                  <Check size={14} />
                  {saving ? "Ukládám…" : editingId !== null ? "Uložit změny" : "Vytvořit zprávu"}
                </button>
                <button type="button" className="btn-secondary" onClick={closeForm}>
                  Zrušit
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {(!reports || reports.length === 0) && (
              <div className="card text-center text-gray-400 py-12">
                Žádné zprávy. Klikněte na &bdquo;Nová zpráva&ldquo; pro vytvoření.
              </div>
            )}
            {reports?.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-gray-900">{r.title}</h3>
                        <p className="text-xs text-gray-400">{clientName(r.clientId)} · {formatDate(r.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => openEdit(r)}
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                          title="Upravit zprávu"
                        >
                          <Edit2 size={11} /> Upravit
                        </button>
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
                      <p className="text-sm text-gray-700 mt-2 line-clamp-2">{r.content}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      {r.diagnosis && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Diagnóza:</span> {r.diagnosis}
                        </p>
                      )}
                      {r.recommendations && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Doporučení:</span> {r.recommendations}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
