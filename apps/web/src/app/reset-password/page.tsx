"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") || "";
  const shouldReduceMotion = useReducedMotion();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Validate token on load
  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }
    api
      .get<{ valid: boolean }>(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((res) => {
        setTokenValid(res.valid);
      })
      .catch(() => {
        setTokenValid(false);
      })
      .finally(() => setValidating(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      haptics.error();
      setError("Heslo musí mít alespoň 8 znaků");
      return;
    }
    if (password !== confirm) {
      haptics.error();
      setError("Hesla se neshodují");
      return;
    }

    haptics.medium();
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      haptics.success();
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      haptics.error();
      setError(err?.message || "Odkaz pro reset hesla je neplatný nebo vypršel.");
    } finally {
      setLoading(false);
    }
  };

  const strengthScore = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Slabé", "Průměrné", "Dobré", "Silné"][strengthScore];
  const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"][strengthScore];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md"
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
          <div className="text-center mb-8">
            <motion.div
              className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4"
              initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </motion.div>
            <motion.h1
              className="text-2xl font-bold text-gray-900 dark:text-gray-100"
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
            >
              Nové heslo
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
            {validating ? (
              <motion.div
                key="validating"
                className="text-center py-8"
                initial={shouldReduceMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduceMotion ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <motion.div
                  animate={shouldReduceMotion ? {} : { rotate: 360 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="rounded-full h-8 w-8 border-2 border-primary-600 dark:border-primary-400 border-t-transparent mx-auto mb-3"
                />
                <p className="text-gray-500 dark:text-gray-400 text-sm">Ověřuji odkaz…</p>
              </motion.div>
            ) : !tokenValid ? (
              <motion.div
                key="invalid"
                className="text-center"
                initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
              >
                <motion.div
                  className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
                  initial={shouldReduceMotion ? {} : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                >
                  <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </motion.div>
                <motion.h2
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                >
                  Odkaz není platný
                </motion.h2>
                <motion.p
                  className="text-gray-500 dark:text-gray-400 text-sm mb-6"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
                >
                  Odkaz pro reset hesla je neplatný nebo vypršel. Platnost je 1 hodina.
                </motion.p>
                <motion.div
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.18 }}
                >
                  <Link
                    href="/forgot-password"
                    className="btn-primary inline-block text-sm px-6"
                  >
                    Požádat o nový odkaz
                  </Link>
                </motion.div>
              </motion.div>
            ) : success ? (
              <motion.div
                key="success"
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
                  Heslo změněno!
                </motion.h2>
                <motion.p
                  className="text-gray-500 dark:text-gray-400 text-sm mb-4"
                  initial={shouldReduceMotion ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.14 }}
                >
                  Vaše heslo bylo úspěšně změněno. Za chvíli budete přesměrováni na přihlášení.
                </motion.p>
                <Link href="/login" className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium">
                  Přejít na přihlášení →
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
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nové heslo
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Alespoň 8 znaků"
                      className="input"
                    />
                    <AnimatePresence>
                      {password.length > 0 && (
                        <motion.div
                          key="strength"
                          initial={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={shouldReduceMotion ? {} : { opacity: 0, height: 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="mt-2 overflow-hidden"
                        >
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3, 4].map((i) => (
                              <motion.div
                                key={i}
                                className={`h-1 flex-1 rounded-full transition-colors ${i <= strengthScore ? strengthColor : "bg-gray-200 dark:bg-gray-700"}`}
                                initial={shouldReduceMotion ? {} : { scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.05 }}
                                style={{ originX: 0 }}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{strengthLabel}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Potvrzení hesla
                    </label>
                    <input
                      id="confirm"
                      type="password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Zopakujte heslo"
                      className={`input ${
                        confirm && password !== confirm
                          ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10"
                          : ""
                      }`}
                    />
                    <AnimatePresence>
                      {confirm && password !== confirm && (
                        <motion.p
                          key="mismatch"
                          initial={shouldReduceMotion ? {} : { opacity: 0, y: -2 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduceMotion ? {} : { opacity: 0, y: -2 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="text-xs text-red-500 dark:text-red-400 mt-1"
                        >
                          Hesla se neshodují
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading || (!!confirm && password !== confirm)}
                    className="btn-primary w-full"
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  >
                    {loading ? "Ukládám…" : "Nastavit nové heslo"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const shouldReduceFallback = useReducedMotion();
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <motion.div
          animate={shouldReduceFallback ? {} : { rotate: 360 }}
          transition={shouldReduceFallback ? { duration: 0 } : { repeat: Infinity, duration: 0.8, ease: "linear" }}
          className="rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"
        />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
