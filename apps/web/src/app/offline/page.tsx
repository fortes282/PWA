"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">📡</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Jste offline</h1>
        <p className="text-gray-500 text-sm">Zkontrolujte připojení k internetu a zkuste to znovu.</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary mt-6 inline-block"
        >
          Zkusit znovu
        </button>
      </div>
    </div>
  );
}
