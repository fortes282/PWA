"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { Heart, Save, ArrowLeft, User, CheckCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

interface HealthFormData {
  bloodType: string;
  allergies: string;
  contraindications: string;
  medications: string;
  chronicConditions: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  primaryDiagnosis: string;
  functionalStatus: string;
  rehabGoals: string;
  notes: string;
}

const EMPTY_FORM: HealthFormData = {
  bloodType: "",
  allergies: "",
  contraindications: "",
  medications: "",
  chronicConditions: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  primaryDiagnosis: "",
  functionalStatus: "",
  rehabGoals: "",
  notes: "",
};

const BLOOD_TYPES = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"];

export default function HealthRecordDetail({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const shouldReduce = useReducedMotion();
  const { clientId } = use(params);

  const { data: record, mutate } = useSWR(
    `/health-records/${clientId}`,
    (url) => api.get<any>(url).catch((e: any) => (e?.status === 404 ? null : Promise.reject(e)))
  );
  const { data: client } = useSWR(`/users/${clientId}`, fetcher);

  const [form, setForm] = useState<HealthFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        bloodType: record.bloodType ?? "",
        allergies: record.allergies ?? "",
        contraindications: record.contraindications ?? "",
        medications: record.medications ?? "",
        chronicConditions: record.chronicConditions ?? "",
        emergencyContactName: record.emergencyContactName ?? "",
        emergencyContactPhone: record.emergencyContactPhone ?? "",
        emergencyContactRelation: record.emergencyContactRelation ?? "",
        primaryDiagnosis: record.primaryDiagnosis ?? "",
        functionalStatus: record.functionalStatus ?? "",
        rehabGoals: record.rehabGoals ?? "",
        notes: record.notes ?? "",
      });
    }
  }, [record]);

  const set = (field: keyof HealthFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setSaving(true);
    try {
      await api.put(`/health-records/${clientId}`, form);
      mutate();
      haptics.success();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN", "EMPLOYEE"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          {/* Back */}
          <motion.div
            initial={shouldReduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Link
              href="/reception/health-records"
              className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
              onClick={() => haptics.light()}
            >
              <ArrowLeft size={14} /> Zpět na seznam
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            className="flex items-center gap-3 mb-6"
            initial={shouldReduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.04 }}
          >
            <motion.div
              className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center"
              whileHover={shouldReduce ? undefined : { scale: 1.08 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <Heart size={22} className="text-red-500" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Zdravotní záznam
              </h1>
              {client && (
                <motion.p
                  className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"
                  initial={shouldReduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                >
                  <User size={13} />
                  {client.name} ({client.email})
                </motion.p>
              )}
            </div>
          </motion.div>

          {/* Saved banner */}
          <AnimatePresence>
            {saved && (
              <motion.div
                key="saved-banner"
                initial={shouldReduce ? false : { opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2"
              >
                <CheckCircle size={15} className="text-green-500" />
                Zdravotní záznam byl uložen.
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-6">
              {/* ── Základní zdravotní info ──────────────────────────────── */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.08 }}
                className="card space-y-4"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Heart size={16} className="text-red-500" />
                  Základní zdravotní informace
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Krevní skupina</label>
                    <select
                      className="input"
                      value={form.bloodType}
                      onChange={set("bloodType")}
                    >
                      {BLOOD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t || "— nezadáno —"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Primární diagnóza</label>
                    <input
                      className="input"
                      value={form.primaryDiagnosis}
                      onChange={set("primaryDiagnosis")}
                      placeholder="Např. CMP, RS, TBI…"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Alergie</label>
                  <textarea
                    className="input min-h-[80px]"
                    value={form.allergies}
                    onChange={set("allergies")}
                    placeholder="Léky, potraviny, materiály…"
                  />
                </div>

                <div>
                  <label className="label">Kontraindikace</label>
                  <textarea
                    className="input min-h-[80px]"
                    value={form.contraindications}
                    onChange={set("contraindications")}
                    placeholder="Procedury nebo aktivity, které nelze aplikovat…"
                  />
                </div>

                <div>
                  <label className="label">Medikace</label>
                  <textarea
                    className="input min-h-[80px]"
                    value={form.medications}
                    onChange={set("medications")}
                    placeholder="Aktuálně užívané léky, dávkování…"
                  />
                </div>

                <div>
                  <label className="label">Chronická onemocnění</label>
                  <textarea
                    className="input min-h-[80px]"
                    value={form.chronicConditions}
                    onChange={set("chronicConditions")}
                    placeholder="Diabetes, hypertenze, srdeční onemocnění…"
                  />
                </div>
              </motion.div>

              {/* ── Rehabilitace ─────────────────────────────────────────── */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 }}
                className="card space-y-4"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Rehabilitace</h2>

                <div>
                  <label className="label">Funkční stav</label>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.functionalStatus}
                    onChange={set("functionalStatus")}
                    placeholder="Aktuální pohybové, kognitivní a komunikační schopnosti…"
                  />
                </div>

                <div>
                  <label className="label">Rehabilitační cíle</label>
                  <textarea
                    className="input min-h-[100px]"
                    value={form.rehabGoals}
                    onChange={set("rehabGoals")}
                    placeholder="Krátkodobé a dlouhodobé cíle terapie…"
                  />
                </div>
              </motion.div>

              {/* ── Nouzový kontakt ──────────────────────────────────────── */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.16 }}
                className="card space-y-4"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nouzový kontakt</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Jméno</label>
                    <input
                      className="input"
                      value={form.emergencyContactName}
                      onChange={set("emergencyContactName")}
                      placeholder="Jan Novák"
                    />
                  </div>
                  <div>
                    <label className="label">Telefon</label>
                    <input
                      className="input"
                      value={form.emergencyContactPhone}
                      onChange={set("emergencyContactPhone")}
                      placeholder="+420 777 123 456"
                    />
                  </div>
                  <div>
                    <label className="label">Vztah ke klientovi</label>
                    <input
                      className="input"
                      value={form.emergencyContactRelation}
                      onChange={set("emergencyContactRelation")}
                      placeholder="Manžel/ka, rodič, sourozenec…"
                    />
                  </div>
                </div>
              </motion.div>

              {/* ── Poznámky ────────────────────────────────────────────── */}
              <motion.div
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.20 }}
                className="card space-y-4"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Interní poznámky</h2>
                <textarea
                  className="input min-h-[100px]"
                  value={form.notes}
                  onChange={set("notes")}
                  placeholder="Ostatní poznámky pro tým (viditelné jen interně)…"
                />
              </motion.div>
            </div>

            {/* Save */}
            <motion.div
              className="flex justify-end"
              initial={shouldReduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.3 }}
            >
              <motion.button
                type="submit"
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
                disabled={saving}
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                <Save size={16} />
                {saving ? "Ukládám…" : "Uložit záznam"}
              </motion.button>
            </motion.div>
          </form>
        </div>
      </Layout>
    </RouteGuard>
  );
}
