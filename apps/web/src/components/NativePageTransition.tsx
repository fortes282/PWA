"use client";

import { useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "@/lib/motion";

/** Počet segmentů v cestě — pro detekci "zpět" */
function pathDepth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

/**
 * iOS-like push/pop přechod stránek.
 *
 * Nová stránka přijíždí zprava, při navigaci zpět se směr obrátí.
 * AnimatePresence je záměrně vynecháno — viz komentář v AnimatedPages.tsx.
 */
export default function NativePageTransition({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const prevDepthRef = useRef(pathDepth(pathname));

  const currentDepth = pathDepth(pathname);
  const isBack = currentDepth < prevDepthRef.current;
  prevDepthRef.current = currentDepth;

  // Přístupnost — pouze fade při redukovaném pohybu
  if (prefersReducedMotion) {
    return (
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: MOTION.duration.micro }}
        style={{ minHeight: "inherit" }}
      >
        {children}
      </motion.div>
    );
  }

  // Směr slide: vpřed = zprava, zpět = zleva
  const direction = isBack ? -1 : 1;

  return (
    <motion.div
      key={pathname}
      initial={{ x: `${direction * 100}%`, opacity: 0.5 }}
      animate={{ x: "0%", opacity: 1 }}
      transition={MOTION.easing.spring}
      style={{ minHeight: "inherit" }}
    >
      {children}
    </motion.div>
  );
}
