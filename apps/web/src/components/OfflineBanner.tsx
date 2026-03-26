"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";

/**
 * Displays a banner when the browser goes offline.
 * Automatically hides when the connection is restored.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 3000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [wasOffline]);

  const isVisible = isOffline || showRestored;

  const bannerVariants: Variants = {
    hidden: { y: shouldReduceMotion ? 0 : -48, opacity: shouldReduceMotion ? 1 : 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] },
    },
    exit: {
      y: shouldReduceMotion ? 0 : -48,
      opacity: 0,
      transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
    },
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={isOffline ? "offline" : "restored"}
          variants={bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`fixed top-0 left-0 right-0 z-50 safe-area-top flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
            isOffline
              ? "bg-red-500 text-white"
              : "bg-green-500 text-white"
          }`}
          role="alert"
        >
          {isOffline ? (
            <>
              <WifiOff size={15} />
              <span>Jste offline — data mohou být neaktuální</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>Připojení obnoveno.</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
