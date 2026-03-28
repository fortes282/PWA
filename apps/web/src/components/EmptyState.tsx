"use client";

import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 text-center"
      initial={shouldReduce ? {} : { opacity: 0, y: 12 }}
      animate={shouldReduce ? {} : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {icon && (
        <motion.div
          className="text-gray-300 mb-4 text-5xl"
          animate={shouldReduce ? {} : { y: [0, -4, 0] }}
          transition={shouldReduce ? { duration: 0 } : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-lg font-medium text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </motion.div>
  );
}
