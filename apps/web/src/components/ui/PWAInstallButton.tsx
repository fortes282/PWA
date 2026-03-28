"use client";

import { useState } from "react";
import { Download, X, Share, Plus, MoreVertical } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { isIOSUserAgent, isAndroidBrowser } from "@/lib/pwa-platform";

type Props = {
  /** When set, outer spacing is tighter (e.g. directly under login submit). */
  variant?: "default" | "login-inline";
};

export default function PWAInstallButton({ variant = "default" }: Props) {
  const shouldReduce = useReducedMotion();
  const { canInstall, isInstalled, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidModal, setShowAndroidModal] = useState(false);

  const ios = isIOSUserAgent();
  const android = isAndroidBrowser();

  const showPromo = !isInstalled && !dismissed && (canInstall || ios || android);

  if (!showPromo) return null;

  const openInstructions = () => {
    if (ios) setShowIOSModal(true);
    else if (android) setShowAndroidModal(true);
  };

  const handlePrimaryClick = async () => {
    if (ios) {
      setShowIOSModal(true);
      return;
    }
    if (android && canInstall) {
      await install();
      return;
    }
    if (android) {
      setShowAndroidModal(true);
      return;
    }
    await install();
  };

  const primaryLabel = ios
    ? "Přidat na plochu (Safari — iPhone / iPad)"
    : android && canInstall
      ? "Nainstalovat aplikaci na plochu"
      : android
        ? "Přidat na plochu Androidu (návod)"
        : "Přidat na plochu telefonu";

  const marginClass = variant === "login-inline" ? "mt-4" : "mt-4";

  return (
    <>
      <AnimatePresence>
        <motion.div
          data-testid="pwa-install-banner"
          initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={shouldReduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: shouldReduce ? 0.1 : 0.25 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 ${marginClass}`}
        >
          <Download className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden />
          <button
            type="button"
            data-testid="pwa-install-primary"
            onClick={handlePrimaryClick}
            className="flex-1 text-sm text-blue-700 dark:text-blue-300 text-left font-medium"
          >
            {primaryLabel}
          </button>
          {android && !canInstall && (
            <button
              type="button"
              onClick={openInstructions}
              className="text-xs text-blue-600 dark:text-blue-400 underline shrink-0"
            >
              Návod
            </button>
          )}
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

      {android && !canInstall && variant === "login-inline" && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 px-1">
          Po instalaci se aplikace otevře bez adresního řádku jako běžná aplikace. V prohlížeči zůstane URL vidět — to je
          normální, dokud ji nepřidáte na plochu.
        </p>
      )}

      {/* iOS — Safari Add to Home Screen */}
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
              initial={shouldReduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
              animate={shouldReduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={shouldReduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
              transition={shouldReduce ? { duration: 0.15 } : { type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[min(24rem,calc(100vw-2rem))] min-w-0 bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-xl max-h-[min(90dvh,90vh)] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900 dark:text-white">Přidat na plochu</h3>
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
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Klepněte na ikonu <Share className="inline w-4 h-4 mb-0.5 text-blue-500" /> <strong>Sdílet</strong>.
                    Na <strong>iPhonu</strong> je obvykle ve spodní liště Safari, na <strong>iPadu</strong> často v horní
                    liště u adresního řádku.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Vyberte <strong>Přidat na plochu</strong> <Plus className="inline w-4 h-4 mb-0.5" />
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Potvrďte klepnutím na <strong>Přidat</strong>
                  </span>
                </li>
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Android — Chrome / Samsung Internet */}
      <AnimatePresence>
        {showAndroidModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-8"
            onClick={() => setShowAndroidModal(false)}
          >
            <motion.div
              initial={shouldReduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
              animate={shouldReduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
              exit={shouldReduce ? { opacity: 0 } : { y: 60, opacity: 0 }}
              transition={shouldReduce ? { duration: 0.15 } : { type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[min(24rem,calc(100vw-2rem))] min-w-0 bg-white dark:bg-neutral-900 rounded-2xl p-6 shadow-xl max-h-[min(90dvh,90vh)] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-base text-neutral-900 dark:text-white">Aplikace na plochu (Android)</h3>
                <button
                  type="button"
                  onClick={() => setShowAndroidModal(false)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Otevřete menu prohlížeče <MoreVertical className="inline w-4 h-4 mb-0.5 text-blue-500" />{" "}
                    <strong>(⋮)</strong> vpravo nahoře
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Zvolte <strong>Nainstalovat aplikaci</strong>, <strong>Přidat na plochu</strong> nebo{" "}
                    <strong>Přidat stránku na</strong> (záleží na prohlížeči — Chrome / Samsung Internet).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Potvrďte. Aplikace se pak spustí <strong>bez adresního řádku</strong> jako samostatná ikona.
                  </span>
                </li>
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
