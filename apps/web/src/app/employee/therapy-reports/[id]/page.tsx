"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Download, Save, CheckCircle, ArrowLeft } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

interface TemplateField {
  id: string;
  label: string;
  type: "text" | "textarea" | "scale" | "checkbox";
  min?: number;
  max?: number;
  required?: boolean;
}

function ScaleInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  const max = field.max ?? 5;
  const min = field.min ?? 1;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const labels: Record<number, string> = {
    1: "Velmi slabé",
    2: "Slabé",
    3: "Průměrné",
    4: "Dobré",
    5: "Výborné",
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2 flex-wrap">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            className={`w-10 h-10 rounded-lg border-2 font-semibold text-sm transition-all ${
              value === step
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-primary-400"
            }`}
          >
            {step}
          </button>
        ))}
      </div>
      {value !== undefined && (
        <p className="text-xs text-gray-500">{labels[value] ?? `Hodnota: ${value}`}</p>
      )}
    </div>
  );
}

export default function TherapyReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const { data: report, mutate } = useSWR(id ? `/reports/therapy/${id}` : null, fetcher);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill form when report loads (only when report id changes, not on every data update)
  const reportId = report?.id;
  const reportData = report?.data;
  useEffect(() => {
    if (reportData) {
      setFormData(reportData);
    }
  }, [reportId, reportData]);

  // Auto-export PDF if ?export=pdf
  const handleExportPDF = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    try {
      const { generateTherapyReportPDF } = await import("@/lib/therapy-pdf");
      generateTherapyReportPDF({ ...report, data: formData });
    } catch (e) {
      console.error(e);
      alert("Nepodařilo se vygenerovat PDF.");
    } finally {
      setExporting(false);
    }
  }, [report, formData]);

  useEffect(() => {
    if (searchParams?.get("export") === "pdf" && report) {
      handleExportPDF();
    }
  }, [report, searchParams, handleExportPDF]);

  const setField = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setSaved(false);
  };

  const handleSave = async (status?: "DRAFT" | "FINAL") => {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/reports/therapy/${id}`, {
        data: formData,
        status: status ?? report?.status,
      });
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message ?? "Nepodařilo se uložit.");
    } finally {
      setSaving(false);
    }
  };

  if (!report) {
    return (
      <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
        <Layout>
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  const fields: TemplateField[] = report.template?.structure ?? [];

  return (
    <RouteGuard allowedRoles={["EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push("/employee/therapy-reports")}
              className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1 mb-2"
            >
              <ArrowLeft size={14} /> Zpět na zprávy
            </button>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{report.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {report.client?.name ?? "—"} · {report.template?.name ?? "Vlastní zpráva"}
                  {report.status === "FINAL" && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle size={12} /> Finální
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download size={14} />
                  {exporting ? "Generuji…" : "Export PDF"}
                </button>
                <button
                  onClick={() => handleSave("FINAL")}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  <CheckCircle size={14} />
                  Finalizovat
                </button>
              </div>
            </div>
          </div>

          {/* Auto-fill info box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Klient</p>
              <p className="font-medium text-gray-800">{report.client?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Terapeut</p>
              <p className="font-medium text-gray-800">{report.therapist?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Datum</p>
              <p className="font-medium text-gray-800">
                {new Date(report.createdAt).toLocaleDateString("cs-CZ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Šablona</p>
              <p className="font-medium text-gray-800">{report.template?.name ?? "—"}</p>
            </div>
          </div>

          {/* Dynamic form fields */}
          <div className="card space-y-6">
            {fields.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">Tato zpráva nemá definované pole šablony.</p>
            )}

            {fields.map((field: TemplateField) => (
              <div key={field.id}>
                <label className="block text-sm font-semibold text-gray-800 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {field.type === "text" && (
                  <input
                    className="input"
                    value={(formData[field.id] as string) ?? ""}
                    onChange={(e) => setField(field.id, e.target.value)}
                    placeholder={`Zadejte ${field.label.toLowerCase()}…`}
                  />
                )}

                {field.type === "textarea" && (
                  <textarea
                    className="input min-h-[120px] resize-y"
                    value={(formData[field.id] as string) ?? ""}
                    onChange={(e) => setField(field.id, e.target.value)}
                    placeholder={`Zadejte ${field.label.toLowerCase()}…`}
                  />
                )}

                {field.type === "scale" && (
                  <ScaleInput
                    field={field}
                    value={formData[field.id] as number | undefined}
                    onChange={(v) => setField(field.id, v)}
                  />
                )}

                {field.type === "checkbox" && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData[field.id])}
                      onChange={(e) => setField(field.id, e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600"
                    />
                    <span className="text-sm text-gray-700">Ano</span>
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* Save actions */}
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex items-center justify-between mt-5">
            <div>
              {saved && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle size={14} /> Uloženo
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleSave("DRAFT")}
                disabled={saving}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Save size={14} />
                {saving ? "Ukládám…" : "Uložit koncept"}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Download size={14} />
                {exporting ? "Generuji PDF…" : "Export PDF"}
              </button>
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
