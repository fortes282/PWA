"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import GdprConsentDialog from "@/components/GdprConsentDialog";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import useSWR from "swr";
import { Heart, AlertCircle, Phone, Target, Shield } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function ClientHealthRecord() {
  const shouldReduce = useReducedMotion();
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

  function Field({ label, value, i = 0 }: { label: string; value?: string | null; i?: number }) {
    if (!value) return null;
    return (
      <motion.div
        initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 + i * 0.04 }}
        className="py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line">{value}</p>
      </motion.div>
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
            <motion.div
              animate={shouldReduce ? {} : { rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
              className="rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"
            />
          </div>
        </Layout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        {consentPending && !consentDeclined && (
          <GdprConsentDialog
            onConsent={(granted) => {
              if (!granted) setConsentDeclined(true);
              mutateConsent();
            }}
          />
        )}

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <motion.div
              initial={shouldReduce ? {} : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
              className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0"
            >
              <Heart size={22} className="text-red-500 dark:text-red-400" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Váš zdravotní záznam</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Přehled vašich zdravotních informací v centru</p>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* Consent declined or revoked */}
            {(consentDeclined || (healthConsent && !consentGranted)) && (
              <motion.div
                key="consent-declined"
                initial={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, scale: 0.97, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="card text-center py-10 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
              >
                <motion.div
                  initial={shouldReduce ? {} : { scale: 0, rotate: -15 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                >
                  <Shield size={40} className="text-amber-400 dark:text-amber-500 mx-auto mb-3" />
                </motion.div>
                <p className="text-amber-800 dark:text-amber-200 font-medium">
                  Přístup ke zdravotní kartě vyžaduje souhlas
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 mb-4">
                  Bez souhlasu se zpracováním zdravotních dat nemůžeme zobrazit váš zdravotní záznam.
                </p>
                <motion.button
                  className="btn-primary"
                  onClick={() => {
                    setConsentDeclined(false);
                    mutateConsent(undefined, { revalidate: false });
                    setTimeout(() => mutateConsent(), 100);
                  }}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                >
                  Udělit souhlas
                </motion.button>
              </motion.div>
            )}

            {/* Not found */}
            {consentGranted && notFound && (
              <motion.div
                key="not-found"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="card text-center py-10"
              >
                <motion.div
                  initial={shouldReduce ? {} : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 }}
                >
                  <AlertCircle size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                </motion.div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Zdravotní záznam zatím nebyl vytvořen</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  Váš terapeut nebo recepce vytvoří zdravotní záznam při první návštěvě.
                </p>
              </motion.div>
            )}

            {/* Health record content */}
            {consentGranted && record && (
              <motion.div
                key="record"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {/* Zdravotní informace */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.05 }}
                  className="card"
                >
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                    className="flex items-center gap-2 mb-3"
                  >
                    <Heart size={15} className="text-red-500 dark:text-red-400" />
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Zdravotní informace</h2>
                  </motion.div>

                  {record.bloodType && (
                    <motion.div
                      initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.13 }}
                      className="py-2 border-b border-gray-100 dark:border-gray-700"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Krevní skupina</p>
                      <motion.span
                        initial={shouldReduce ? {} : { scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.18 }}
                        className="inline-block px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-sm font-bold"
                      >
                        {record.bloodType}
                      </motion.span>
                    </motion.div>
                  )}

                  <Field label="Primární diagnóza" value={record.primaryDiagnosis} i={0} />
                  <Field label="Alergie" value={record.allergies} i={1} />
                  <Field label="Kontraindikace" value={record.contraindications} i={2} />
                  <Field label="Medikace" value={record.medications} i={3} />
                  <Field label="Chronická onemocnění" value={record.chronicConditions} i={4} />

                  {!record.bloodType &&
                    !record.primaryDiagnosis &&
                    !record.allergies &&
                    !record.contraindications &&
                    !record.medications &&
                    !record.chronicConditions && (
                      <motion.p
                        initial={shouldReduce ? {} : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.15 }}
                        className="text-xs text-gray-500 dark:text-gray-500 py-2"
                      >
                        Zatím žádné údaje.
                      </motion.p>
                    )}
                </motion.div>

                {/* Rehabilitace */}
                <AnimatePresence>
                  {(record.functionalStatus || record.rehabGoals) && (
                    <motion.div
                      key="rehab"
                      initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.1 }}
                      className="card"
                    >
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 }}
                        className="flex items-center gap-2 mb-3"
                      >
                        <Target size={15} className="text-primary-500 dark:text-primary-400" />
                        <h2 className="font-semibold text-gray-900 dark:text-gray-100">Rehabilitace</h2>
                      </motion.div>
                      <Field label="Funkční stav" value={record.functionalStatus} i={0} />
                      <Field label="Rehabilitační cíle" value={record.rehabGoals} i={1} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Nouzový kontakt */}
                <AnimatePresence>
                  {hasEmergency && (
                    <motion.div
                      key="emergency"
                      initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: 10 }}
                      transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.15 }}
                      className="card border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"
                    >
                      <motion.div
                        initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.2 }}
                        className="flex items-center gap-2 mb-3"
                      >
                        <Phone size={15} className="text-orange-500 dark:text-orange-400" />
                        <h2 className="font-semibold text-orange-800 dark:text-orange-200">Nouzový kontakt</h2>
                      </motion.div>

                      {record.emergencyContactName && (
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.22 }}
                          className="py-2 border-b border-orange-100 dark:border-orange-800 last:border-0"
                        >
                          <p className="text-xs text-orange-600 dark:text-orange-400">Jméno</p>
                          <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                            {record.emergencyContactName}
                          </p>
                        </motion.div>
                      )}

                      {record.emergencyContactPhone && (
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.26 }}
                          className="py-2 border-b border-orange-100 dark:border-orange-800 last:border-0"
                        >
                          <p className="text-xs text-orange-600 dark:text-orange-400">Telefon</p>
                          <motion.a
                            href={`tel:${record.emergencyContactPhone}`}
                            className="text-sm font-medium text-orange-900 dark:text-orange-100 hover:underline"
                            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                          >
                            {record.emergencyContactPhone}
                          </motion.a>
                        </motion.div>
                      )}

                      {record.emergencyContactRelation && (
                        <motion.div
                          initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.3 }}
                          className="py-2"
                        >
                          <p className="text-xs text-orange-600 dark:text-orange-400">Vztah</p>
                          <p className="text-sm text-orange-900 dark:text-orange-100">
                            {record.emergencyContactRelation}
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.p
                  initial={shouldReduce ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  className="text-xs text-gray-500 dark:text-gray-500 text-center mt-2"
                >
                  Naposledy aktualizováno: {record.updatedAt?.slice(0, 10)}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
