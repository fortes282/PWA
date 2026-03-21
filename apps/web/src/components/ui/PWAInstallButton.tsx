"use client";

import { useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePWAInstall } from "@/hooks/usePWAInstall";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PWAInstallButton() {
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  const ios = isIOS();
  const showButton = !isInstalled && !dismissed && (canInstall || ios);

  if (!showButton) return null;

  const handleClick = async () => {
    if (ios) {
      setShowIOSModal(true);
    } else {
      await install();
    }
  };

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-2 mt-4 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800"
        >
          <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <button
            type="button"
            onClick={handleClick}
            className="flex-1 text-sm text-blue-700 dark:text-blue-300 text-left font-medium"
          >
            Přidat na plochu telefonu
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors"
            aria-label="Zavřít"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </AnimatePresence>

      {/* iOS modal */}
      <AnimatePresence>
        {showIOSModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-8"
            onClick={() => setShowIOSModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900 dark:text-white">
                  Přidat na plochu
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSModal(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">1</span>
                  <span>
                    Klepněte na ikonu <Share className="inline w-4 h-4 mb-0.5 text-blue-500" /> <strong>Sdílet</strong> ve spodní liště Safari
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">2</span>
                  <span>
                    Vyberte <strong>Přidat na plochu</strong> <Plus className="inline w-4 h-4 mb-0.5" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">3</span>
                  <span>Potvrďte klepnutím na <strong>Přidat</strong></span>
                </li>
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
