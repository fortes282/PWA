"use client";

import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MOTION } from "@/lib/motion";

const SPLASH_KEY = "pristav-splash-shown";
const SPLASH_DURATION = 1800; // 1.8s — allows time for all animations

function isAutomatedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.webdriver === true) return true;
  // Fallback: some automation stacks omit webdriver; HeadlessChrome is still typical for CI / Playwright.
  return /\bHeadlessChrome\b/i.test(navigator.userAgent || "");
}

/* ---------- sparkle particle config ---------- */
const SPARKLES = [
  { x: -30, startY: 20, delay: 0.5, dur: 1.0 },
  { x: 20, startY: 10, delay: 0.7, dur: 0.9 },
  { x: -10, startY: 30, delay: 0.6, dur: 1.1 },
  { x: 35, startY: 15, delay: 0.8, dur: 0.8 },
];

/** Animovaná splash screen — zobrazí se jednou za session */
export default function SplashScreen({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    if (isAutomatedBrowser()) return;
    if (sessionStorage.getItem(SPLASH_KEY)) return;
    setShowSplash(true);
    sessionStorage.setItem(SPLASH_KEY, "1");
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION);
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
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#F8F9FF] dark:bg-[#0D144B]"
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
              className="absolute h-32 w-32 rounded-full bg-[#242B61]/20 dark:bg-[#3B4279]/25"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.4, opacity: [0, 0.6, 0] }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />

            {/* Light rays — 400-1200ms */}
            <motion.div
              className="pointer-events-none absolute"
              style={{ width: 200, height: 200 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.5, 0.5, 0] }}
              transition={{ delay: 0.4, duration: 0.8, ease: "easeInOut" }}
            >
              {/* Ray 1: top-left to bottom-right */}
              <div
                className="absolute left-1/2 top-1/2 h-[2px] w-[120px] origin-left bg-gradient-to-r from-[#B9BAE3]/80 to-transparent dark:from-[#B9BAE3]/60"
                style={{ transform: "translate(-50%, -50%) rotate(35deg)" }}
              />
              {/* Ray 2: top-right to bottom-left */}
              <div
                className="absolute left-1/2 top-1/2 h-[2px] w-[120px] origin-left bg-gradient-to-r from-[#B9BAE3]/80 to-transparent dark:from-[#B9BAE3]/60"
                style={{ transform: "translate(-50%, -50%) rotate(-35deg)" }}
              />
            </motion.div>

            {/* Sparkle particles — 500-1500ms */}
            {SPARKLES.map((s, i) => (
              <motion.div
                key={i}
                className="absolute h-[5px] w-[5px] rounded-full bg-[#D4A843] dark:bg-[#E8C35A]"
                style={{ left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.startY}px)` }}
                initial={{ opacity: 0, y: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1, 1, 0], y: -60, scale: [0.5, 1, 1, 0.3] }}
                transition={{ delay: s.delay, duration: s.dur, ease: "easeOut" }}
              />
            ))}

            {/* Název — fades in 200-600ms */}
            <motion.h1
              className="mt-6 font-display text-2xl font-bold text-[#242B61] dark:text-[#F8F9FF]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: MOTION.duration.long }}
            >
              Přístav Radosti
            </motion.h1>

            {/* Podtitul — fades in 300-700ms */}
            <motion.p
              className="mt-2 text-sm text-[#242B61]/60 dark:text-[#F8F9FF]/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: MOTION.duration.medium }}
            >
              Neurorehabilitační centrum
            </motion.p>

            {/* Water wave — 600-1800ms */}
            <motion.div
              className="absolute inset-x-0 bottom-0 h-16 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4, ease: "easeOut" }}
            >
              <div
                className="absolute bottom-0 h-full w-[200%] animate-[wave_3s_ease-in-out_infinite] bg-[#B9BAE3] dark:bg-[#B9BAE3]/40"
                style={{
                  clipPath:
                    "polygon(0% 60%, 2% 55%, 5% 50%, 8% 48%, 12% 50%, 16% 55%, 20% 58%, 25% 55%, 30% 50%, 35% 48%, 40% 52%, 45% 58%, 50% 60%, 55% 55%, 60% 50%, 65% 48%, 70% 52%, 75% 58%, 80% 60%, 85% 55%, 90% 50%, 95% 52%, 100% 58%, 100% 100%, 0% 100%)",
                }}
              />
              <div
                className="absolute bottom-0 h-full w-[200%] animate-[wave_4s_ease-in-out_0.5s_infinite] bg-[#B9BAE3]/50 dark:bg-[#B9BAE3]/20"
                style={{
                  clipPath:
                    "polygon(0% 65%, 4% 58%, 8% 52%, 12% 50%, 16% 54%, 20% 60%, 25% 62%, 30% 58%, 35% 52%, 40% 50%, 45% 55%, 50% 62%, 55% 65%, 60% 58%, 65% 52%, 70% 50%, 75% 55%, 80% 62%, 85% 65%, 90% 58%, 95% 55%, 100% 60%, 100% 100%, 0% 100%)",
                }}
              />
              {/* Inject wave keyframes */}
              <style>{`
                @keyframes wave {
                  0%   { transform: translateX(0); }
                  50%  { transform: translateX(-25%); }
                  100% { transform: translateX(0); }
                }
              `}</style>
            </motion.div>

            {/* Progress bar — 0-1800ms fills left to right */}
            <div className="absolute inset-x-0 bottom-0 h-[3px]">
              <motion.div
                className="h-full origin-left bg-[#242B61]/40 dark:bg-[#B9BAE3]/60"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: SPLASH_DURATION / 1000,
                  ease: "linear",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
