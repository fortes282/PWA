"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[client error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl" aria-hidden="true">!</span>
        </div>
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
            href="/client"
            className="btn-secondary"
          >
            Zpet na prehled
          </Link>
        </div>
      </div>
    </div>
  );
}
