"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { Heart, Save, ArrowLeft, User } from "lucide-react";

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
  const { clientId } = use(params);

  const { data: record, mutate } = useSWR(
    `/health-records/${clientId}`,
    (url) => api.get<any>(url).catch((e: any) => (e?.status === 404 ? null : Promise.reject(e)))
  );
  const { data: client } = useSWR(`/users/${clientId}`, fetcher);

  const [form, setForm] = useState<HealthFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing record into form
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
    setSaving(true);
    try {
      await api.put(`/health-records/${clientId}`, form);
      mutate();
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
          <Link
            href="/reception/health-records"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft size={14} /> Zpět na seznam
          </Link>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Heart size={22} className="text-red-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Zdravotní záznam
              </h1>
              {client && (
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <User size={13} />
                  {client.name} ({client.email})
                </p>
              )}
            </div>
          </div>

          {saved && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
              ✓ Zdravotní záznam byl uložen.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* ── Základní zdravotní info ──────────────────────────────── */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
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
            </div>

            {/* ── Rehabilitace ─────────────────────────────────────────── */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Rehabilitace</h2>

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
            </div>

            {/* ── Nouzový kontakt ──────────────────────────────────────── */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Nouzový kontakt</h2>

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
            </div>

            {/* ── Poznámky ────────────────────────────────────────────── */}
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Interní poznámky</h2>
              <textarea
                className="input min-h-[100px]"
                value={form.notes}
                onChange={set("notes")}
                placeholder="Ostatní poznámky pro tým (viditelné jen interně)…"
              />
            </div>

            {/* Save */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={saving}
              >
                <Save size={16} />
                {saving ? "Ukládám…" : "Uložit záznam"}
              </button>
            </div>
          </form>
        </div>
      </Layout>
    </RouteGuard>
  );
}
