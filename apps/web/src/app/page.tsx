"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import AnimatedLogo from "@/components/ui/AnimatedLogo";
import { staggerContainer, listItem, slideUp, fadeIn } from "@/lib/motion";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(ROLE_DEFAULT_ROUTES[user.role]);
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500 text-sm">Načítání…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500 text-sm">Přesměrování…</p>
        </div>
      </div>
    );
  }

  // Not authenticated — show landing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col">
      {/* Header */}
      <motion.header
        className="p-6 flex items-center justify-between max-w-5xl mx-auto w-full"
        variants={fadeIn}
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate="visible"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <AnimatedLogo size={32} />
          </div>
          <span className="font-bold text-xl text-gray-900">Přístav Radosti</span>
        </div>
        <motion.div whileHover={shouldReduceMotion ? {} : { y: -1 }} whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}>
          <Link
            href="/login"
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            Přihlásit se
          </Link>
        </motion.div>
      </motion.header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
        <div className="max-w-2xl">
          <motion.div
            className="w-24 h-24 bg-primary-600 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-lg"
            variants={slideUp}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
          >
            <AnimatedLogo size={72} />
          </motion.div>
          <motion.h1
            className="text-4xl font-bold text-gray-900 mb-4"
            variants={slideUp}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            Vítejte v Přístavu Radosti
          </motion.h1>
          <motion.p
            className="text-lg text-gray-600 mb-8"
            variants={slideUp}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
            transition={{ delay: 0.15 }}
          >
            Komplexní systém pro správu terapeutické kliniky. Spravujte termíny,
            klienty, terapeuty a dokumentaci na jednom místě.
          </motion.p>
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={slideUp}
            initial={shouldReduceMotion ? "visible" : "hidden"}
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            <motion.div whileHover={shouldReduceMotion ? {} : { y: -2 }} whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}>
              <Link
                href="/login"
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-lg shadow-md block"
              >
                Přihlásit se
              </Link>
            </motion.div>
          </motion.div>
        </div>

        {/* Feature highlights */}
        <motion.div
          className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full"
          variants={staggerContainer}
          initial={shouldReduceMotion ? "visible" : "hidden"}
          animate="visible"
        >
          {[
            { icon: "📅", title: "Správa termínů", desc: "Přehledný kalendář a plánování sezení" },
            { icon: "👥", title: "Evidence klientů", desc: "Kompletní profily a zdravotní záznamy" },
            { icon: "📊", title: "Reporting & statistiky", desc: "Přehledy výkonnosti a financí" },
          ].map((f) => (
            <motion.div
              key={f.title}
              className="bg-white/70 backdrop-blur rounded-xl p-6 shadow-sm"
              variants={listItem}
              whileHover={shouldReduceMotion ? {} : { scale: 1.02, transition: { duration: 0.2 } }}
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-400 p-6">
        © {new Date().getFullYear()} Přístav Radosti
      </footer>
    </div>
  );
}
