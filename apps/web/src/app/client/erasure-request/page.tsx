"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function ErasureRequestPage() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;
    haptics.medium();
    setLoading(true);
    try {
      const data = await api.post<any>("/gdpr/erasure-request", { notes });
      haptics.success();
      setResult({ ok: true, message: data.message ?? "Žádost byla přijata." });
    } catch (err: any) {
      haptics.error();
      setResult({ ok: false, message: err?.message ?? "Nepodařilo se odeslat žádost." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <Trash2 size={22} className="text-red-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Žádost o výmaz dat</h1>
              <p className="text-sm text-gray-500">Právo být zapomenut dle GDPR čl. 17</p>
            </div>
          </div>

          {result ? (
            <div className={`card text-center py-10 ${result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <p className={`font-medium ${result.ok ? "text-green-800" : "text-red-800"}`}>{result.message}</p>
              {result.ok && (
                <p className="text-sm text-green-600 mt-2">
                  Vaše žádost bude vyřízena do 30 dnů. Budeme vás informovat e-mailem.
                </p>
              )}
              <Link href="/client" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
                ← Zpět na dashboard
              </Link>
            </div>
          ) : (
            <div className="card">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Upozornění před odesláním žádosti</p>
                    <ul className="list-disc pl-4 space-y-1 text-amber-700">
                      <li>Smazání dat je <strong>nevratné</strong> — zdravotní záznamy, termíny a faktury budou anonymizovány.</li>
                      <li>Zpracování trvá až <strong>30 dní</strong>.</li>
                      <li>Po výmazu nebude možné přistupovat ke klientskému portálu.</li>
                      <li>Zákonem požadované záznamy (faktury) mohou být uchovány po dobu stanovenou zákonem.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="notes">Důvod žádosti (volitelné)</label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Proč žádáte o výmaz svých dat…"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-1 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    Rozumím, že tato žádost povede k <strong>trvalému smazání nebo anonymizaci</strong> mých osobních
                    a zdravotních dat a tato akce je nevratná.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!confirmed || loading}
                  className="btn-primary w-full bg-red-600 hover:bg-red-700 focus:ring-red-500 disabled:opacity-50"
                >
                  {loading ? "Odesílám žádost…" : "Odeslat žádost o výmaz"}
                </button>
              </form>

              <p className="text-xs text-gray-500 text-center mt-4">
                Máte otázky?{" "}
                <a href="mailto:gdpr@pristav-radosti.cz" className="text-blue-600 hover:underline">
                  gdpr@pristav-radosti.cz
                </a>{" "}
                ·{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  Zásady ochrany osobních údajů
                </Link>
              </p>
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
