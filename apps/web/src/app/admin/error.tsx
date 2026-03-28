"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <img src="/brand/error-generic.svg" alt="" className="w-24 h-24 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Neco se pokazilo
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">
          {error.message || "Doslo k neocekavane chybe."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 dark:text-gray-400 font-mono mb-6">
            Kod: {error.digest}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="btn-primary"
          >
            Zkusit znovu
          </button>
          <Link
            href="/admin"
            className="btn-secondary"
          >
            Zpet na prehled
          </Link>
        </div>
      </div>
    </div>
  );
}
