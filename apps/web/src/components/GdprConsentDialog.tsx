"use client";

import { useState } from "react";
import { Shield, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface Props {
  onConsent: (granted: boolean) => void;
}

export default function GdprConsentDialog({ onConsent }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConsent = async (granted: boolean) => {
    setLoading(true);
    setError("");
    try {
      await api.post("/gdpr/consent", { granted, consentType: "health_data" });
      onConsent(granted);
    } catch {
      setError("Nepodařilo se uložit souhlas. Zkuste to znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
            <Shield size={22} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Souhlas se zpracováním zdravotních dat</h2>
            <p className="text-xs text-gray-500 dark:text-gray-500">Vyžadováno dle GDPR (čl. 9)</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert mb-5 text-gray-700 dark:text-gray-300 space-y-2 text-sm">
          <p>
            Centrum <strong>Přístav Radosti</strong> zpracovává vaše zdravotní údaje (diagnózy, medikace, rehabilitační záznamy)
            za účelem poskytování zdravotní péče a vedení zdravotnické dokumentace.
          </p>
          <p>
            Zdravotní data jsou <strong>šifrována AES-256</strong> a přistupují k nim pouze oprávnění pracovníci centra.
            Každý přístup je evidován v audit logu.
          </p>
          <p>
            Máte právo na přístup k datům, jejich opravu a výmaz. Souhlas lze kdykoli odvolat v nastavení.
          </p>
          <Link href="/privacy" target="_blank" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
            Zásady ochrany osobních údajů <ChevronRight size={12} />
          </Link>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleConsent(true)}
            disabled={loading}
            className="flex-1 btn-primary"
          >
            {loading ? "Ukládám…" : "Souhlasím"}
          </button>
          <button
            onClick={() => handleConsent(false)}
            disabled={loading}
            className="flex-1 btn-secondary"
          >
            Nesouhlasím
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-3">
          Bez souhlasu nemůžete přistupovat ke zdravotní kartě.
        </p>
      </div>
    </div>
  );
}
