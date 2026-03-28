"use client";

/**
 * Skeleton loading components with Framer Motion fade-in stagger.
 * CSS shimmer is applied via the .skeleton-shimmer class in globals.css.
 */
import { motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

const skeletonStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const skeletonStaggerReduced: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
};

const skeletonItem: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

const skeletonItemReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.1 } },
};

export function SkeletonLine({
  width = "w-full",
  height = "h-4",
  className = "",
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      variants={shouldReduce ? skeletonItemReduced : skeletonItem}
      className={`skeleton-shimmer rounded ${width} ${height} ${className}`}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className="card space-y-3"
      variants={shouldReduce ? skeletonStaggerReduced : skeletonStagger}
      initial="hidden"
      animate="visible"
    >
      <SkeletonLine width="w-1/3" height="h-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? "w-full" : "w-3/4"} height="h-3" />
      ))}
    </motion.div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Načítání...">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
      <span className="sr-only">Načítání...</span>
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}
      variants={shouldReduce ? skeletonStaggerReduced : skeletonStagger}
      initial="hidden"
      animate="visible"
      role="status"
      aria-label="Načítání..."
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={shouldReduce ? skeletonItemReduced : skeletonItem} className="card text-center space-y-2">
          <div className="skeleton-shimmer h-8 w-12 mx-auto rounded" />
          <div className="skeleton-shimmer h-3 w-2/3 mx-auto rounded" />
        </motion.div>
      ))}
      <span className="sr-only">Načítání...</span>
    </motion.div>
  );
}

/** Skeleton for an appointment card row */
export function SkeletonAppointmentCard() {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className="card flex items-center justify-between"
      variants={shouldReduce ? skeletonStaggerReduced : skeletonStagger}
      initial="hidden"
      animate="visible"
    >
      <div className="space-y-2 flex-1">
        <SkeletonLine width="w-40" height="h-4" />
        <SkeletonLine width="w-56" height="h-3" />
      </div>
      <SkeletonLine width="w-16" height="h-6" className="rounded-full flex-shrink-0" />
    </motion.div>
  );
}

/** Skeleton for a client list row */
export function SkeletonClientCard() {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className="card flex items-center gap-3"
      variants={shouldReduce ? skeletonStaggerReduced : skeletonStagger}
      initial="hidden"
      animate="visible"
    >
      <div className="skeleton-shimmer w-9 h-9 rounded-full flex-shrink-0" />
      <div className="space-y-2 flex-1">
        <SkeletonLine width="w-32" height="h-4" />
        <SkeletonLine width="w-48" height="h-3" />
      </div>
      <SkeletonLine width="w-12" height="h-5" className="rounded-full flex-shrink-0" />
    </motion.div>
  );
}

/** Skeleton for a finance/stats card */
export function SkeletonFinanceCard() {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      className="card space-y-3"
      variants={shouldReduce ? skeletonStaggerReduced : skeletonStagger}
      initial="hidden"
      animate="visible"
    >
      <SkeletonLine width="w-1/3" height="h-4" />
      <SkeletonLine width="w-1/2" height="h-8" />
      <SkeletonLine width="w-2/3" height="h-3" />
    </motion.div>
  );
}
