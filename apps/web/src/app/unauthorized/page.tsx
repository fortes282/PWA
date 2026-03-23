"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";
import { motion, useReducedMotion } from "framer-motion";

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-800">
      <motion.div
        className="text-center"
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        <p className="text-5xl mb-4">🔒</p>
        <motion.h1
          className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2"
          initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
        >
          Nemáte přístup
        </motion.h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Tato stránka není pro vaši roli dostupná.</p>
        {user && (
          <Link href={ROLE_DEFAULT_ROUTES[user.role]} className="btn-primary">
            Zpět na dashboard
          </Link>
        )}
      </motion.div>
    </div>
  );
}
