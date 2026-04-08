"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { Download, Save, CheckCircle, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

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
  shouldReduce,
}: {
  field: TemplateField;
  value: number | undefined;
  onChange: (v: number) => void;
  shouldReduce: boolean | null;
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
          <motion.button
            key={step}
            type="button"
            onClick={() => { haptics.light(); onChange(step); }}
            whileTap={shouldReduce ? undefined : { scale: 0.88 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
            className={`w-10 h-10 rounded-lg border-2 font-semibold text-sm transition-all ${
              value === step
                ? "border-primary bg-primary text-white"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-primary"
            }`}
          >
            {step}
          </motion.button>
        ))}
      </div>
      {value !== undefined && (
        <p className="text-xs text-gray-500">{labels[value] ?? `Hodnota: ${value}`}</p>
      )}
    </div>
  );
}

export default function TherapyReportDetailPage() {
  const shouldReduce = useReducedMotion();
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

  const reportId = report?.id;
  const reportData = report?.data;
  useEffect(() => {
    if (reportData) {
      setFormData(reportData);
    }
  }, [reportId, reportData]);

  const handleExportPDF = useCallback(async () => {
    if (!report) return;
    haptics.light();
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
      haptics.success();
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
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
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
            <motion.button
              onClick={() => { haptics.light(); router.push("/employee/therapy-reports"); }}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="text-sm text-gray-500 hover:text-primary flex items-center gap-1 mb-2"
            >
              <ArrowLeft size={14} /> Zpět na zprávy
            </motion.button>
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{report.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {report.client?.name ?? "—"} · {report.template?.name ?? "Vlastní zpráva"}
                  {report.status === "FINAL" && (
                    <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                      <CheckCircle size={12} /> Finální
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={handleExportPDF}
                  disabled={exporting}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <Download size={14} />
                  {exporting ? "Generuji…" : "Export PDF"}
                </motion.button>
                <motion.button
                  onClick={() => handleSave("FINAL")}
                  disabled={saving}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <CheckCircle size={14} />
                  Finalizovat
                </motion.button>
              </div>
            </div>
          </div>

          {/* Auto-fill info box */}
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Klient</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{report.client?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Terapeut</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{report.therapist?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Datum</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {new Date(report.createdAt).toLocaleDateString("cs-CZ")}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Šablona</p>
              <p className="font-medium text-gray-800 dark:text-gray-200">{report.template?.name ?? "—"}</p>
            </div>
          </div>

          {/* Dynamic form fields */}
          <div className="card">
            {fields.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">Tato zpráva nemá definované pole šablony.</p>
            )}

            <div
              className="space-y-6"
            >
              {fields.map((field: TemplateField, i: number) => (
                <motion.div
                  key={field.id}
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 + i * 0.04 }}
                >
                  <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
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
                      shouldReduce={shouldReduce}
                    />
                  )}

                  {field.type === "checkbox" && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(formData[field.id])}
                        onChange={(e) => setField(field.id, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Ano</span>
                    </label>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Save actions */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="text-sm text-red-600 mt-3"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mt-5">
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                  className="text-sm text-green-600 flex items-center gap-1"
                >
                  <CheckCircle size={14} /> Uloženo
                </motion.span>
              )}
            </AnimatePresence>
            <div className="flex gap-3 ml-auto">
              <motion.button
                onClick={() => handleSave("DRAFT")}
                disabled={saving}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "Ukládám…" : "Uložit koncept"}
              </motion.button>
              <motion.button
                onClick={handleExportPDF}
                disabled={exporting}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50"
              >
                <Download size={14} />
                {exporting ? "Generuji PDF…" : "Export PDF"}
              </motion.button>
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
