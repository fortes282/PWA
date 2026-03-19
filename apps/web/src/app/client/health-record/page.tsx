"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import GdprConsentDialog from "@/components/GdprConsentDialog";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import useSWR from "swr";
import { Heart, AlertCircle, Phone, Target, Shield } from "lucide-react";
import { useState } from "react";

export default function ClientHealthRecord() {
  const { user } = useAuth();
  const [consentDeclined, setConsentDeclined] = useState(false);

  const { data: consentData, isLoading: consentLoading, mutate: mutateConsent } = useSWR(
    user ? `/gdpr/consent/${user.id}` : null,
    (url: string) => api.get<any>(url)
  );

  const healthConsent = consentData?.consents?.find((c: any) => c.consent_type === "health_data");
  const consentGranted = healthConsent?.granted === 1 || healthConsent?.granted === true;
  const consentPending = !consentLoading && !healthConsent;

  const { data: record, error } = useSWR(
    user && consentGranted ? `/health-records/${user.id}` : null,
    (url: string) =>
      api.get<any>(url).catch((e: any) => (e?.message?.includes("404") ? null : Promise.reject(e)))
  );

  const notFound = error === null || record === null;

  function Field({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
      <div className="py-2 border-b border-gray-100 last:border-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 whitespace-pre-line">{value}</p>
      </div>
    );
  }

  const hasEmergency =
    record?.emergencyContactName ||
    record?.emergencyContactPhone ||
    record?.emergencyContactRelation;

  if (consentLoading) {
    return (
      <RouteGuard allowedRoles={["CLIENT"]}>
        <Layout>
          <div className="flex items-center justify-center min-h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" />
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        {/* GDPR Consent Dialog — shown when consent status unknown */}
        {consentPending && !consentDeclined && (
          <GdprConsentDialog
            onConsent={(granted) => {
              if (!granted) setConsentDeclined(true);
              mutateConsent();
            }}
          />
        )}

        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Heart size={22} className="text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Váš zdravotní záznam</h1>
              <p className="text-sm text-gray-500">Přehled vašich zdravotních informací v centru</p>
            </div>
          </div>

          {/* Consent declined or revoked */}
          {(consentDeclined || (healthConsent && !consentGranted)) && (
            <div className="card text-center py-10 border-amber-200 bg-amber-50">
              <Shield size={40} className="text-amber-400 mx-auto mb-3" />
              <p className="text-amber-800 font-medium">Přístup ke zdravotní kartě vyžaduje souhlas</p>
              <p className="text-xs text-amber-600 mt-2 mb-4">
                Bez souhlasu se zpracováním zdravotních dat nemůžeme zobrazit váš zdravotní záznam.
              </p>
              <button
                className="btn-primary"
                onClick={() => {
                  setConsentDeclined(false);
                  mutateConsent(undefined, { revalidate: false }); // trigger re-render to show dialog
                  setTimeout(() => mutateConsent(), 100);
                }}
              >
                Udělit souhlas
              </button>
            </div>
          )}

          {/* Health record content — only if consent granted */}
          {consentGranted && notFound && (
            <div className="card text-center py-10">
              <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Zdravotní záznam zatím nebyl vytvořen</p>
              <p className="text-xs text-gray-500 mt-2">
                Váš terapeut nebo recepce vytvoří zdravotní záznam při první návštěvě.
              </p>
            </div>
          )}

          {consentGranted && record && (
            <div className="space-y-4">
              {/* Základní info */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <Heart size={15} className="text-red-500" />
                  <h2 className="font-semibold text-gray-900">Zdravotní informace</h2>
                </div>
                {record.bloodType && (
                  <div className="py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 mb-0.5">Krevní skupina</p>
                    <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-sm font-bold">
                      {record.bloodType}
                    </span>
                  </div>
                )}
                <Field label="Primární diagnóza" value={record.primaryDiagnosis} />
                <Field label="Alergie" value={record.allergies} />
                <Field label="Kontraindikace" value={record.contraindications} />
                <Field label="Medikace" value={record.medications} />
                <Field label="Chronická onemocnění" value={record.chronicConditions} />
                {!record.bloodType &&
                  !record.primaryDiagnosis &&
                  !record.allergies &&
                  !record.contraindications &&
                  !record.medications &&
                  !record.chronicConditions && (
                    <p className="text-xs text-gray-500 py-2">Zatím žádné údaje.</p>
                  )}
              </div>

              {/* Rehabilitační cíle */}
              {(record.functionalStatus || record.rehabGoals) && (
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <Target size={15} className="text-primary-500" />
                    <h2 className="font-semibold text-gray-900">Rehabilitace</h2>
                  </div>
                  <Field label="Funkční stav" value={record.functionalStatus} />
                  <Field label="Rehabilitační cíle" value={record.rehabGoals} />
                </div>
              )}

              {/* Nouzový kontakt */}
              {hasEmergency && (
                <div className="card border-orange-100 bg-orange-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone size={15} className="text-orange-500" />
                    <h2 className="font-semibold text-orange-800">Nouzový kontakt</h2>
                  </div>
                  {record.emergencyContactName && (
                    <div className="py-2 border-b border-orange-100 last:border-0">
                      <p className="text-xs text-orange-600">Jméno</p>
                      <p className="text-sm font-medium text-orange-900">{record.emergencyContactName}</p>
                    </div>
                  )}
                  {record.emergencyContactPhone && (
                    <div className="py-2 border-b border-orange-100 last:border-0">
                      <p className="text-xs text-orange-600">Telefon</p>
                      <a
                        href={`tel:${record.emergencyContactPhone}`}
                        className="text-sm font-medium text-orange-900 hover:underline"
                      >
                        {record.emergencyContactPhone}
                      </a>
                    </div>
                  )}
                  {record.emergencyContactRelation && (
                    <div className="py-2">
                      <p className="text-xs text-orange-600">Vztah</p>
                      <p className="text-sm text-orange-900">{record.emergencyContactRelation}</p>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-500 text-center mt-2">
                Naposledy aktualizováno: {record.updatedAt?.slice(0, 10)}
              </p>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
