"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import AnimatedLogo from "@/components/ui/AnimatedLogo";
import PWAInstallButton from "@/components/ui/PWAInstallButton";
import { haptics } from "@/lib/haptics";

export default function LoginPage() {
  const { login, complete2FA, useBackupCode: submitBackupCode } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  // Step 1: email + password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: 2FA
  const [step, setStep] = useState<"credentials" | "totp" | "backup">("credentials");
  const [pendingToken, setPendingToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result && "requires2FA" in result && result.requires2FA) {
        setPendingToken(result.pendingToken);
        setStep("totp");
      }
    } catch (err: unknown) {
      haptics.error();
      setError(err instanceof Error ? err.message : "Chyba přihlášení");
      setShakeKey((k) => k + 1);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitTOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setError("");
    setLoading(true);
    try {
      await complete2FA(pendingToken, totpCode);
    } catch (err: unknown) {
      haptics.error();
      setError(err instanceof Error ? err.message : "Neplatný kód");
      setTotpCode("");
      setShakeKey((k) => k + 1);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setError("");
    setLoading(true);
    try {
      await submitBackupCode(pendingToken, backupCode);
    } catch (err: unknown) {
      haptics.error();
      setError(err instanceof Error ? err.message : "Neplatný záložní kód");
      setBackupCode("");
      setShakeKey((k) => k + 1);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <motion.div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-8"
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.06 }}
          >
            <AnimatedLogo size={48} />
          </motion.div>
          <motion.h1
            className="text-2xl font-bold text-gray-900 dark:text-gray-100"
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
          >
            Přístav Radosti
          </motion.h1>
          <motion.p
            className="text-sm text-gray-500 dark:text-gray-400 mt-1"
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 }}
          >
            Neurorehabilitační centrum
          </motion.p>
        </div>

        {/* ── Step 1: Credentials ─────────────────────────────────── */}
        {step === "credentials" && (
          <motion.form
            key={`form-credentials-${shakeKey}`}
            onSubmit={handleSubmitCredentials}
            className="space-y-4"
            animate={
              shouldReduceMotion
                ? {}
                : isShaking
                ? { x: [0, -8, 8, -8, 8, 0] }
                : { x: 0 }
            }
            transition={{ duration: 0.4 }}
          >
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="vas@email.cz"
                required
                autoComplete="email"
                aria-invalid={!!error}
                aria-describedby={error ? "credentials-error" : undefined}
              />
            </div>

            <div>
              <label className="label" htmlFor="password">Heslo</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby={error ? "credentials-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
                  aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                id="credentials-error"
                role="alert"
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              {loading ? "Přihlašování…" : "Přihlásit se"}
            </motion.button>

            <PWAInstallButton variant="login-inline" />
          </motion.form>
        )}

        {/* ── Step 2a: TOTP code ──────────────────────────────────── */}
        {step === "totp" && (
          <motion.form
            key={`form-totp-${shakeKey}`}
            onSubmit={handleSubmitTOTP}
            className="space-y-4"
            initial={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
            animate={
              shouldReduceMotion
                ? {}
                : isShaking
                ? { opacity: 1, x: [0, -8, 8, -8, 8, 0] }
                : { opacity: 1, x: 0 }
            }
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            <div className="text-center mb-2">
              <motion.div
                className="w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full mx-auto mb-3 flex items-center justify-center"
                initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.05 }}
              >
                <ShieldCheck className="text-primary-600 dark:text-primary-400" size={24} />
              </motion.div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dvoufaktorové ověření</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Zadejte 6místný kód z autentikátoru
              </p>
            </div>

            <div>
              <label className="label" htmlFor="totp-code">Kód z autentikátoru</label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="input text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                required
                autoComplete="one-time-code"
                autoFocus
                aria-invalid={!!error}
                aria-describedby={error ? "totp-error" : undefined}
              />
            </div>

            {error && (
              <motion.div
                id="totp-error"
                role="alert"
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading || totpCode.length !== 6}
              className="btn-primary w-full"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              {loading ? "Ověřuji…" : "Ověřit kód"}
            </motion.button>

            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setStep("backup"); setError(""); }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
              >
                Nemám přístup k autentikátoru — použít záložní kód
              </button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setError(""); setPendingToken(""); }}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ← Zpět
              </button>
            </div>
          </motion.form>
        )}

        {/* ── Step 2b: Backup code ────────────────────────────────── */}
        {step === "backup" && (
          <motion.form
            key={`form-backup-${shakeKey}`}
            onSubmit={handleSubmitBackup}
            className="space-y-4"
            initial={shouldReduceMotion ? {} : { opacity: 0, x: 20 }}
            animate={
              shouldReduceMotion
                ? {}
                : isShaking
                ? { opacity: 1, x: [0, -8, 8, -8, 8, 0] }
                : { opacity: 1, x: 0 }
            }
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            <div className="text-center mb-2">
              <motion.div
                className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 rounded-full mx-auto mb-3 flex items-center justify-center"
                initial={shouldReduceMotion ? {} : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.05 }}
              >
                <KeyRound className="text-amber-600 dark:text-amber-400" size={24} />
              </motion.div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Záložní kód</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Zadejte jeden z vašich jednorázových záložních kódů
              </p>
            </div>

            <div>
              <label className="label" htmlFor="backup-code">Záložní kód</label>
              <input
                id="backup-code"
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                className="input text-center font-mono tracking-widest"
                placeholder="XXXX-XXXX-XXXX"
                required
                autoFocus
                aria-invalid={!!error}
                aria-describedby={error ? "backup-error" : undefined}
              />
            </div>

            {error && (
              <motion.div
                id="backup-error"
                role="alert"
                initial={shouldReduceMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading || backupCode.trim().length < 6}
              className="btn-primary w-full"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              {loading ? "Ověřuji…" : "Použít záložní kód"}
            </motion.button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setStep("totp"); setError(""); }}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
              >
                ← Použít kód z autentikátoru
              </button>
            </div>
          </motion.form>
        )}

        {step === "credentials" && (
          <div className="text-center mt-4">
            <Link
              href="/forgot-password"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline"
            >
              Zapomněli jste heslo?
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          © 2026 Přístav Radosti · v2.0
        </p>
      </motion.div>
    </div>
  );
}
