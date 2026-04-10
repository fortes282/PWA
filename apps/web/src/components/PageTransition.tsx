"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "@/lib/motion";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION.duration.short, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
