"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps page children with AnimatePresence + pathname key
 * so each route transition gets a fade+slide animation.
 * Must be a client component because it uses usePathname().
 */
export function AnimatedPages({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ minHeight: "inherit" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default AnimatedPages;
