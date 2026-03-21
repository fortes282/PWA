"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { motion, useReducedMotion } from "framer-motion";
import { slideUp, scaleIn } from "@/lib/motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const shouldReduceMotion = useReducedMotion();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Nepodařilo se odeslat e-mail. Zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md"
        variants={scaleIn}
        initial={shouldReduceMotion ? "visible" : "hidden"}
        animate="visible"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <motion.h1
              className="text-2xl font-bold text-gray-900"
              variants={slideUp}
              initial={shouldReduceMotion ? "visible" : "hidden"}
              animate="visible"
            >
              Reset hesla
            </motion.h1>
            <p className="text-gray-500 text-sm mt-1">Přístav Radosti</p>
          </div>

          {sent ? (
            <motion.div
              className="text-center"
              variants={scaleIn}
              initial={shouldReduceMotion ? "visible" : "hidden"}
              animate="visible"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">E-mail odeslán</h2>
              <p className="text-gray-500 text-sm mb-6">
                Pokud účet s touto e-mailovou adresou existuje, obdržíte e-mail s odkazem pro reset hesla.
                Odkaz je platný 1 hodinu.
              </p>
              <p className="text-sm text-gray-500 mb-4">Neobdrželi jste e-mail? Zkontrolujte složku spam.</p>
              <Link href="/login" className="text-primary-600 hover:underline text-sm font-medium">
                Zpět na přihlášení
              </Link>
            </motion.div>
          ) : (
            <>
              <p className="text-gray-600 text-sm mb-6">
                Zadejte svůj e-mail a my vám pošleme odkaz pro reset hesla.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    E-mailová adresa
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vas@email.cz"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm transition"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
                  whileHover={shouldReduceMotion ? {} : { y: -1 }}
                >
                  {loading ? "Odesílám…" : "Odeslat odkaz pro reset"}
                </motion.button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
                  ← Zpět na přihlášení
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
