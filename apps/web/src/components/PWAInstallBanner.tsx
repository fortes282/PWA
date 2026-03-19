"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true); // start hidden
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only after 2nd visit
    const visits = parseInt(localStorage.getItem("pristav-visits") || "0", 10) + 1;
    localStorage.setItem("pristav-visits", String(visits));
    const wasDismissed = localStorage.getItem("pristav-install-dismissed") === "true";
    if (visits >= 2 && !wasDismissed) {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    if (canInstall && !dismissed) {
      // Small delay for smooth appearance
      const t = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(t);
    }
  }, [canInstall, dismissed]);

  if (!canInstall || dismissed || !visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem("pristav-install-dismissed", "true");
  };

  const handleInstall = async () => {
    await install();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={20} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Nainstalovat aplikaci</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Přidejte Přístav Radosti na plochu pro rychlý přístup.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="px-4 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors min-h-[44px]"
              >
                Nainstalovat
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-200 min-h-[44px]"
              >
                Později
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            aria-label="Zavřít"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
