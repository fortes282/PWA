"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";
import { motion, useReducedMotion } from "framer-motion";
import { scaleIn, slideUp } from "@/lib/motion";

export default function UnauthorizedPage() {
  const { user } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        className="text-center"
        variants={scaleIn}
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate="visible"
      >
        <p className="text-5xl mb-4">🔒</p>
        <motion.h1
          className="text-2xl font-bold text-gray-800 mb-2"
          variants={slideUp}
          initial={shouldReduceMotion ? "visible" : "hidden"}
          animate="visible"
        >
          Nemáte přístup
        </motion.h1>
        <p className="text-gray-500 text-sm mb-6">Tato stránka není pro vaši roli dostupná.</p>
        {user && (
          <Link href={ROLE_DEFAULT_ROUTES[user.role]} className="btn-primary">
            Zpět na dashboard
          </Link>
        )}
      </motion.div>
    </div>
  );
}
