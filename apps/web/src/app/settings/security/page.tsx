"use client";

import Link from "next/link";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";
import { ShieldCheck, ShieldOff, ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28, delay: i * 0.07 },
  }),
};

export default function SecuritySettingsPage() {
  const shouldReduce = useReducedMotion();
  const { user } = useAuth();

  // 2FA status
  const [twoFAStatus, setTwoFAStatus] = useState<{ enabled: boolean; mandatory: boolean; backupCodesRemaining: number } | null>(null);
  useEffect(() => {
    api.get<{ enabled: boolean; mandatory: boolean; backupCodesRemaining: number }>("/auth/2fa/status")
      .then(setTwoFAStatus)
      .catch(() => {});
  }, []);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  return (
    <RouteGuard>
      <Layout>
        <div className="max-w-md mx-auto space-y-4">
          {/* Page header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="mb-6"
          >
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-3 transition"
            >
              <ChevronLeft size={16} />
              Zpět na nastavení
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Zabezpečení</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Změna hesla a dvoufaktorové ověření</p>
          </motion.div>

          {/* Password change */}
          <motion.form
            custom={0}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            className="card space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setPwError(null);
              setPwSuccess(false);
              if (newPassword !== confirmPassword) {
                setPwError("Hesla se neshodují");
                return;
              }
              if (newPassword.length < 8) {
                setPwError("Heslo musí mít alespoň 8 znaků");
                return;
              }
              setPwSaving(true);
              try {
                await api.patch(`/users/${user!.id}/password`, {
                  currentPassword,
                  newPassword,
                });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPwSuccess(true);
                setTimeout(() => setPwSuccess(false), 3000);
              } catch (err: any) {
                setPwError(err?.message ?? "Chyba při změně hesla");
              } finally {
                setPwSaving(false);
              }
            }}
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Změna hesla</h2>
            <div>
              <label className="label dark:text-gray-300" htmlFor="current-password">Aktuální heslo</label>
              <input id="current-password" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required aria-invalid={!!pwError} aria-describedby={pwError ? "pw-error" : undefined} />
            </div>
            <div>
              <label className="label dark:text-gray-300" htmlFor="new-password">Nové heslo</label>
              <input id="new-password" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required aria-invalid={!!pwError} aria-describedby={pwError ? "pw-error" : undefined} />
            </div>
            <div>
              <label className="label dark:text-gray-300" htmlFor="confirm-password">Potvrzení hesla</label>
              <input id="confirm-password" type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required aria-invalid={!!pwError} aria-describedby={pwError ? "pw-error" : undefined} />
            </div>
            <AnimatePresence>
              {pwSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 text-green-700 dark:text-green-300 text-sm"
                >
                  Heslo změněno ✓
                </motion.div>
              )}
              {pwError && (
                <motion.div
                  id="pw-error"
                  role="alert"
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm"
                >
                  {pwError}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              type="submit"
              disabled={pwSaving}
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="btn-primary w-full"
            >
              {pwSaving ? "Měním heslo…" : "Změnit heslo"}
            </motion.button>
          </motion.form>

          {/* 2FA Security */}
          <motion.div
            custom={1}
            variants={shouldReduce ? undefined : cardVariants}
            initial="hidden"
            animate="visible"
            className="card"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Zabezpečení účtu</h2>
            <motion.div whileTap={shouldReduce ? undefined : { scale: 0.98 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
              <Link
                href="/settings/2fa"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition -mx-1"
              >
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    twoFAStatus?.enabled
                      ? "bg-green-100 dark:bg-green-900/30"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                  animate={shouldReduce ? {} : twoFAStatus?.enabled ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  key={String(twoFAStatus?.enabled)}
                >
                  {twoFAStatus?.enabled
                    ? <ShieldCheck className="text-green-600 dark:text-green-400" size={20} />
                    : <ShieldOff className="text-gray-500 dark:text-gray-400" size={20} />
                  }
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">Dvoufaktorové ověření (2FA)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {twoFAStatus === null
                      ? "Načítám…"
                      : twoFAStatus.enabled
                        ? `Aktivní · ${twoFAStatus.backupCodesRemaining} záložních kódů`
                        : twoFAStatus.mandatory
                          ? "Neaktivní — povinné pro vaši roli"
                          : "Neaktivní — doporučujeme aktivovat"
                    }
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-400 flex-shrink-0" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
