"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function OfflinePage() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <motion.div
        className="text-center px-6"
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <motion.div
          className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6"
          initial={shouldReduceMotion ? {} : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.06 }}
        >
          <span className="text-4xl">📡</span>
        </motion.div>
        <motion.h1
          className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2"
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
        >
          Jste offline
        </motion.h1>
        <motion.p
          className="text-gray-500 dark:text-gray-400 text-sm mb-6"
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
        >
          Zkontrolujte připojení k internetu a zkuste to znovu.
        </motion.p>
        <motion.button
          onClick={() => window.location.reload()}
          className="btn-primary inline-block"
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 500, damping: 22 }}
        >
          Zkusit znovu
        </motion.button>
      </motion.div>
    </div>
  );
}
