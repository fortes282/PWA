"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, X } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function PWAInstallBanner() {
  const { canInstall, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true); // start hidden
  const [visible, setVisible] = useState(false);
  const shouldReduceMotion = useReducedMotion();

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
    <AnimatePresence>
      {canInstall && !dismissed && visible && (
        <motion.div
          initial={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Download size={20} className="text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Nainstalovat aplikaci</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  Přidejte Přístav Radosti na plochu pro rychlý přístup.
                </p>
                <div className="flex gap-2 mt-3">
                  <motion.button
                    onClick={handleInstall}
                    whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                    className="px-4 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors min-h-[44px]"
                  >
                    Nainstalovat
                  </motion.button>
                  <motion.button
                    onClick={handleDismiss}
                    whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                    className="px-3 py-2 text-gray-500 dark:text-gray-500 text-xs hover:text-gray-700 dark:hover:text-gray-200 min-h-[44px]"
                  >
                    Později
                  </motion.button>
                </div>
              </div>
              <motion.button
                onClick={handleDismiss}
                whileTap={shouldReduceMotion ? {} : { scale: 0.85 }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                aria-label="Zavřít"
              >
                <X size={16} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
