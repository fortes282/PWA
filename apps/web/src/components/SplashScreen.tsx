"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MOTION } from "@/lib/motion";

const SPLASH_KEY = "pristav-splash-shown";
const SPLASH_DURATION = 1200; // Was 2500ms — now 1.2s total

/** Animovaná splash screen — zobrazí se jednou za session */
export default function SplashScreen({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const [showSplash, setShowSplash] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Pokud už byl splash zobrazen v této session, přeskočit
    if (sessionStorage.getItem(SPLASH_KEY)) {
      setReady(true);
      return;
    }
    setShowSplash(true);
    sessionStorage.setItem(SPLASH_KEY, "1");
    const timer = setTimeout(() => {
      setShowSplash(false);
      setReady(true);
    }, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Redukovaný pohyb — bez splash
  if (prefersReducedMotion) return <>{children}</>;

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#FFFBF5] dark:bg-[#102A43]"
            exit={{ y: "-100%", opacity: 0 }}
            transition={{ duration: MOTION.duration.long, ease: MOTION.easing.standard }}
          >
            {/* Logo s bounce efektem — 0-400ms */}
            <motion.img
              src="/brand/logo-animated.svg"
              alt="Přístav Radosti"
              className="h-24 w-24 drop-shadow-lg"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...MOTION.easing.spring, stiffness: 260, damping: 18 }}
            />

            {/* Glow pulse */}
            <motion.div
              className="absolute h-32 w-32 rounded-full bg-sky-400/20 dark:bg-sky-500/15"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.4, opacity: [0, 0.6, 0] }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />

            {/* Název — fades in 200-600ms */}
            <motion.h1
              className="mt-6 font-display text-2xl font-bold text-[#102A43] dark:text-[#FFFBF5]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: MOTION.duration.long }}
            >
              Přístav Radosti
            </motion.h1>

            {/* Podtitul — fades in 300-700ms */}
            <motion.p
              className="mt-2 text-sm text-[#102A43]/60 dark:text-[#FFFBF5]/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: MOTION.duration.medium }}
            >
              Neurorehabilitační centrum
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      {ready && children}
    </>
  );
}
