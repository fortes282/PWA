"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-3">Něco se pokazilo</h1>
        <p className="text-gray-500 text-sm mb-2">
          Došlo k neočekávané chybě. Zkuste stránku obnovit.
        </p>
        {error?.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">
            Chyba: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Zkusit znovu
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Hlavní stránka
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-8">Přístav Radosti — Neurorehabilitační centrum</p>
      </div>
    </div>
  );
}
