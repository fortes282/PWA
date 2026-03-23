"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { haptics } from "@/lib/haptics";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      haptics.success();
      setSent(true);
    } catch (err: any) {
      haptics.error();
      setError(err?.message || "Nepodařilo se odeslat e-mail. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md"
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4"
              initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </motion.div>
            <motion.h1
              className="text-2xl font-bold text-gray-900 dark:text-gray-100"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
            >
              Reset hesla
            </motion.h1>
            <motion.p
              className="text-gray-500 dark:text-gray-400 text-sm mt-1"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
            >
              Přístav Radosti
            </motion.p>
          </div>

          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                className="text-center"
                initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
              >
                <motion.div
                  className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
                  initial={shouldReduceMotion ? {} : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                >
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <motion.h2
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                >
                  E-mail odeslán
                </motion.h2>
                <motion.p
                  className="text-gray-500 dark:text-gray-400 text-sm mb-6"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
                >
                  Pokud účet s touto e-mailovou adresou existuje, obdržíte e-mail s odkazem pro reset hesla.
                  Odkaz je platný 1 hodinu.
                </motion.p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Neobdrželi jste e-mail? Zkontrolujte složku spam.</p>
                <Link href="/login" className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium">
                  Zpět na přihlášení
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={shouldReduceMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.p
                  className="text-gray-600 dark:text-gray-400 text-sm mb-6"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.18 }}
                >
                  Zadejte svůj e-mail a my vám pošleme odkaz pro reset hesla.
                </motion.p>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="error"
                      initial={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 mb-4 text-sm text-red-700 dark:text-red-400"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <motion.div
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.22 }}
                  >
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      E-mailová adresa
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vas@email.cz"
                      className="input"
                      autoComplete="email"
                    />
                  </motion.div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full"
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {loading ? "Odesílám…" : "Odeslat odkaz pro reset"}
                  </motion.button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    ← Zpět na přihlášení
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
