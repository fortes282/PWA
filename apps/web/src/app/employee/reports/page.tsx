"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Plus, FileText, Download } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function EmployeeReports() {
  const { data: reports, mutate } = useSWR("/medical-reports", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/medical-reports", {
        clientId: parseInt(clientId),
        title,
        content,
        diagnosis: diagnosis || undefined,
        recommendations: recommendations || undefined,
      });
      setShowForm(false);
      setTitle(""); setContent(""); setDiagnosis(""); setRecommendations(""); setClientId("");
      mutate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Lékařské zprávy</h1>
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} />
              Nová zpráva
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSave} className="card mb-6 space-y-4">
              <h2 className="font-semibold text-gray-900">Nová zpráva</h2>
              <div>
                <label className="label">Klient</label>
                <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                  <option value="">Vyberte klienta…</option>
                  {clients?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Název</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <label className="label">Obsah zprávy</label>
                <textarea className="input min-h-[120px]" value={content} onChange={(e) => setContent(e.target.value)} required />
              </div>
              <div>
                <label className="label">Diagnóza</label>
                <input className="input" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
              </div>
              <div>
                <label className="label">Doporučení</label>
                <textarea className="input" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Ukládám…" : "Uložit"}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Zrušit</button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {reports?.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">{r.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/pdf/medical-report/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                          title="Stáhnout PDF"
                        >
                          <Download size={11} /> PDF
                        </a>
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/docx/medical-report/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-xs py-0.5 px-2 flex items-center gap-1"
                          title="Stáhnout DOCX"
                        >
                          <Download size={11} /> DOCX
                        </a>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Klient ID: {r.clientId}</p>
                    {r.diagnosis && (
                      <p className="text-sm text-gray-600"><span className="font-medium">Diagnóza:</span> {r.diagnosis}</p>
                    )}
                    {r.recommendations && (
                      <p className="text-sm text-gray-600 mt-1"><span className="font-medium">Doporučení:</span> {r.recommendations}</p>
                    )}
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
