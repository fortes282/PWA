"use client";

import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Entry-only fade+slide animation on route change.
 * AnimatePresence is intentionally omitted — in Next.js App Router, React
 * replaces children before AnimatePresence can capture the old subtree,
 * causing double-mount and broken SWR fetches. Using motion.div with key
 * alone gives a clean entry animation without those side effects.
 */
export function AnimatedPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      style={{ minHeight: "inherit" }}
    >
      {children}
    </motion.div>
  );
}

export default AnimatedPages;
