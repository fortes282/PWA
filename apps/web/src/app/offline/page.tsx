"use client";

import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, slideUp } from "@/lib/motion";

export default function OfflinePage() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        className="text-center"
        variants={scaleIn}
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate="visible"
      >
        <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">📡</span>
        </div>
        <motion.h1
          className="text-2xl font-bold text-gray-800 mb-2"
          variants={slideUp}
          initial={shouldReduceMotion ? "visible" : "hidden"}
          animate="visible"
        >
          Jste offline
        </motion.h1>
        <p className="text-gray-500 text-sm">Zkontrolujte připojení k internetu a zkuste to znovu.</p>
        <motion.button
          onClick={() => window.location.reload()}
          className="btn-primary mt-6 inline-block"
          whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
          whileHover={shouldReduceMotion ? {} : { y: -1 }}
        >
          Zkusit znovu
        </motion.button>
      </motion.div>
    </div>
  );
}
