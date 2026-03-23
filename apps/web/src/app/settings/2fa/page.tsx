"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { haptics } from "@/lib/haptics";
import {
  ShieldCheck,
  ShieldOff,
  QrCode,
  Copy,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type SetupStep = "status" | "scan" | "verify" | "backup-codes" | "done";

interface TwoFAStatus {
  enabled: boolean;
  mandatory: boolean;
  backupCodesRemaining: number;
}

interface SetupData {
  secret: string;
  otpAuthUrl: string;
  qrCode: string;
}

function CopyButton({ text }: { text: string }) {
  const shouldReduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors"
      whileTap={shouldReduce ? undefined : { scale: 0.95 }}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={shouldReduce ? {} : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={shouldReduce ? {} : { scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="inline-flex"
          >
            <CheckCircle size={14} className="text-green-500" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={shouldReduce ? {} : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={shouldReduce ? {} : { scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="inline-flex"
          >
            <Copy size={14} />
          </motion.span>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={shouldReduce ? {} : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          {copied ? "Zkopírováno" : "Kopírovat"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export default function TwoFASettingsPage() {
  const shouldReduce = useReducedMotion();
  const router = useRouter();

  const [status, setStatus] = useState<TwoFAStatus | null>(null);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [step, setStep] = useState<SetupStep>("status");
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState("");
  const [regenCode, setRegenCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showRegenForm, setShowRegenForm] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await api.get<TwoFAStatus>("/auth/2fa/status");
      setStatus(s);
    } catch {
      setError("Nepodařilo se načíst stav 2FA.");
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post<SetupData>("/auth/2fa/setup", {});
      setSetupData(data);
      setStep("scan");
    } catch (err: any) {
      setError(err?.message ?? "Chyba při inicializaci 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ ok: boolean; backupCodes: string[] }>("/auth/2fa/verify-setup", {
        token: verifyCode,
      });
      haptics.success();
      setBackupCodes(result.backupCodes);
      setStep("backup-codes");
      await loadStatus();
    } catch (err: any) {
      haptics.error();
      setError(err?.message ?? "Neplatný kód");
      setVerifyCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/2fa/disable", { token: disableCode });
      haptics.success();
      setDisableCode("");
      setShowDisableForm(false);
      await loadStatus();
    } catch (err: any) {
      haptics.error();
      setError(err?.message ?? "Chyba při deaktivaci 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleRegen = async (e: React.FormEvent) => {
    e.preventDefault();
    haptics.medium();
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ ok: boolean; backupCodes: string[] }>("/auth/2fa/backup-codes/regenerate", {
        token: regenCode,
      });
      haptics.success();
      setBackupCodes(result.backupCodes);
      setRegenCode("");
      setShowRegenForm(false);
      setStep("backup-codes");
    } catch (err: any) {
      haptics.error();
      setError(err?.message ?? "Chyba při regeneraci kódů");
    } finally {
      setLoading(false);
    }
  };

  const isMandatory = status?.mandatory ?? false;
  const isEnabled = status?.enabled ?? false;

  return (
    <RouteGuard>
      <Layout>
        <div className="max-w-lg mx-auto space-y-4">

          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <motion.button
              onClick={() => router.push("/settings")}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Zpět"
              whileTap={shouldReduce ? undefined : { scale: 0.92 }}
            >
              <ArrowLeft size={20} />
            </motion.button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dvoufaktorové ověření (2FA)</h1>
          </motion.div>

          {/* Global error */}
          <AnimatePresence>
            {error && step !== "verify" && (
              <motion.div
                key="error"
                initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm flex items-start gap-2"
              >
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step content */}
          <AnimatePresence mode="wait">

            {/* ── Loading ─────────────────────────────────────────── */}
            {!status && !error && (
              <motion.div
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center justify-center py-12"
              >
                <motion.div
                  animate={shouldReduce ? {} : { rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent"
                />
              </motion.div>
            )}

            {/* ── Status overview ─────────────────────────────────── */}
            {step === "status" && status && (
              <motion.div
                key="status"
                initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="space-y-4"
              >
                {/* Status card */}
                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
                  className="card"
                >
                  <div className="flex items-center gap-4">
                    <motion.div
                      initial={shouldReduce ? {} : { scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isEnabled
                          ? "bg-green-100 dark:bg-green-900/30"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      {isEnabled
                        ? <ShieldCheck className="text-green-600 dark:text-green-400" size={24} />
                        : <ShieldOff className="text-gray-500 dark:text-gray-400" size={24} />
                      }
                    </motion.div>
                    <div className="flex-1">
                      <motion.p
                        initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.13 }}
                        className="font-semibold text-gray-900 dark:text-gray-100"
                      >
                        {isEnabled ? "2FA je aktivní" : "2FA není aktivní"}
                      </motion.p>
                      <motion.p
                        initial={shouldReduce ? {} : { opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.17 }}
                        className="text-sm text-gray-500 dark:text-gray-400"
                      >
                        {isEnabled
                          ? `Záložní kódy: ${status.backupCodesRemaining} zbývá`
                          : isMandatory
                            ? "Povinné pro vaši roli"
                            : "Volitelné — doporučujeme aktivovat"
                        }
                      </motion.p>
                    </div>
                    <motion.span
                      initial={shouldReduce ? {} : { opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.2 }}
                      className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                        isEnabled
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {isEnabled ? "Aktivní" : "Neaktivní"}
                    </motion.span>
                  </div>
                </motion.div>

                {/* Mandatory warning */}
                <AnimatePresence>
                  {isMandatory && !isEnabled && (
                    <motion.div
                      key="mandatory-warning"
                      initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2"
                    >
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
                      <span>2FA je povinné pro vaši roli. Aktivujte jej pro plný přístup k systému.</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Low backup codes warning */}
                <AnimatePresence>
                  {isEnabled && status.backupCodesRemaining < 3 && (
                    <motion.div
                      key="low-codes-warning"
                      initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-amber-800 dark:text-amber-200 text-sm"
                    >
                      Zbývá jen {status.backupCodesRemaining} záložních kódů. Doporučujeme regenerovat.
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Activate button */}
                {!isEnabled && (
                  <motion.button
                    onClick={handleStartSetup}
                    disabled={loading}
                    className="btn-primary w-full"
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.12 }}
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {loading ? "Inicializuji…" : "Aktivovat 2FA"}
                  </motion.button>
                )}

                {/* Disable form section */}
                {isEnabled && !isMandatory && (
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.14 }}
                  >
                    <AnimatePresence mode="wait">
                      {!showDisableForm ? (
                        <motion.button
                          key="disable-btn"
                          onClick={() => setShowDisableForm(true)}
                          className="btn-secondary w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          initial={shouldReduce ? {} : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={shouldReduce ? {} : { opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        >
                          Deaktivovat 2FA
                        </motion.button>
                      ) : (
                        <motion.form
                          key="disable-form"
                          onSubmit={handleDisable}
                          initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="card space-y-3 border-red-200 dark:border-red-800"
                        >
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Zadejte kód z autentikátoru pro deaktivaci:
                          </p>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={disableCode}
                            onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                            className="input text-center font-mono tracking-widest text-xl"
                            placeholder="000000"
                            required
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <motion.button
                              type="submit"
                              disabled={loading || disableCode.length !== 6}
                              className="btn-primary flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            >
                              {loading ? "Deaktivuji…" : "Deaktivovat"}
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => { setShowDisableForm(false); setDisableCode(""); setError(null); }}
                              className="btn-secondary flex-1"
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            >
                              Zrušit
                            </motion.button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Regen form section */}
                {isEnabled && (
                  <motion.div
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.18 }}
                  >
                    <AnimatePresence mode="wait">
                      {!showRegenForm ? (
                        <motion.button
                          key="regen-btn"
                          onClick={() => setShowRegenForm(true)}
                          className="btn-secondary w-full flex items-center justify-center gap-2"
                          initial={shouldReduce ? {} : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={shouldReduce ? {} : { opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                        >
                          <motion.span
                            animate={shouldReduce ? {} : { rotate: [0, 0] }}
                            whileTap={shouldReduce ? undefined : { rotate: 180 }}
                          >
                            <RefreshCw size={16} />
                          </motion.span>
                          Regenerovat záložní kódy
                        </motion.button>
                      ) : (
                        <motion.form
                          key="regen-form"
                          onSubmit={handleRegen}
                          initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                          className="card space-y-3"
                        >
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Zadejte kód z autentikátoru pro generování nových záložních kódů:
                          </p>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={regenCode}
                            onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ""))}
                            className="input text-center font-mono tracking-widest text-xl"
                            placeholder="000000"
                            required
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <motion.button
                              type="submit"
                              disabled={loading || regenCode.length !== 6}
                              className="btn-primary flex-1"
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            >
                              {loading ? "Generuji…" : "Generovat nové kódy"}
                            </motion.button>
                            <motion.button
                              type="button"
                              onClick={() => { setShowRegenForm(false); setRegenCode(""); setError(null); }}
                              className="btn-secondary flex-1"
                              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                            >
                              Zrušit
                            </motion.button>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── Step: Scan QR ───────────────────────────────────── */}
            {step === "scan" && setupData && (
              <motion.div
                key="scan"
                initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -16 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card space-y-4"
              >
                <div className="text-center">
                  <motion.div
                    initial={shouldReduce ? {} : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.08 }}
                    className="inline-flex items-center justify-center w-12 h-12 bg-primary-50 dark:bg-primary-900/30 rounded-full mb-3"
                  >
                    <QrCode className="text-primary-600 dark:text-primary-400" size={24} />
                  </motion.div>
                  <motion.h2
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                    className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Naskenujte QR kód
                  </motion.h2>
                  <motion.p
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.14 }}
                    className="text-sm text-gray-500 dark:text-gray-400 mt-1"
                  >
                    Otevřete Google Authenticator nebo Authy a naskenujte tento kód.
                  </motion.p>
                </div>

                <motion.div
                  initial={shouldReduce ? {} : { scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 26, delay: 0.12 }}
                  className="flex justify-center"
                >
                  <Image
                    src={setupData.qrCode}
                    alt="QR kód pro 2FA"
                    width={200}
                    height={200}
                    className="rounded-lg border border-gray-200 dark:border-gray-700"
                    unoptimized
                  />
                </motion.div>

                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.18 }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nebo zadejte manuálně:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono break-all flex-1 text-gray-800 dark:text-gray-200">
                      {setupData.secret}
                    </code>
                    <CopyButton text={setupData.secret} />
                  </div>
                </motion.div>

                <motion.button
                  onClick={() => setStep("verify")}
                  className="btn-primary w-full"
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.22 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                >
                  Pokračovat →
                </motion.button>
              </motion.div>
            )}

            {/* ── Step: Verify code ──────────────────────────────── */}
            {step === "verify" && (
              <motion.form
                key="verify"
                onSubmit={handleVerifySetup}
                initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -16 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card space-y-4"
              >
                <div className="text-center">
                  <motion.h2
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.05 }}
                    className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Ověřte kód
                  </motion.h2>
                  <motion.p
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="text-sm text-gray-500 dark:text-gray-400 mt-1"
                  >
                    Zadejte 6místný kód z autentikátoru pro potvrzení.
                  </motion.p>
                </div>

                <motion.input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  className="input text-center text-3xl font-mono tracking-widest"
                  placeholder="000000"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  initial={shouldReduce ? {} : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
                />

                {/* Inline error for verify step */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="verify-error"
                      initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-700 dark:text-red-300 text-sm flex items-center gap-2"
                    >
                      <AlertTriangle size={14} className="flex-shrink-0" />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
                  className="flex gap-2"
                >
                  <motion.button
                    type="submit"
                    disabled={loading || verifyCode.length !== 6}
                    className="btn-primary flex-1"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {loading ? "Ověřuji…" : "Potvrdit a aktivovat"}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => { setStep("scan"); setError(null); }}
                    className="btn-secondary"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    Zpět
                  </motion.button>
                </motion.div>
              </motion.form>
            )}

            {/* ── Step: Show backup codes ─────────────────────────── */}
            {step === "backup-codes" && (
              <motion.div
                key="backup-codes"
                initial={shouldReduce ? {} : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -16 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card space-y-4"
              >
                <div className="text-center">
                  <motion.div
                    initial={shouldReduce ? {} : { scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.08 }}
                    className="inline-flex items-center justify-center w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-full mb-3"
                  >
                    <CheckCircle className="text-green-600 dark:text-green-400" size={24} />
                  </motion.div>
                  <motion.h2
                    initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.12 }}
                    className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                  >
                    2FA aktivována! Uložte záložní kódy
                  </motion.h2>
                  <motion.p
                    initial={shouldReduce ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.16 }}
                    className="text-sm text-gray-500 dark:text-gray-400 mt-1"
                  >
                    Tyto jednorázové kódy použijte, pokud ztratíte přístup k autentikátoru.{" "}
                    <strong className="text-gray-700 dark:text-gray-300">
                      Uložte je na bezpečné místo — ukážeme je jen jednou.
                    </strong>
                  </motion.p>
                </div>

                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.18 }}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, i) => (
                      <motion.code
                        key={code}
                        initial={shouldReduce ? {} : { opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.22 + i * 0.03 }}
                        className="text-center text-sm font-mono bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-800 dark:text-gray-200"
                      >
                        {code}
                      </motion.code>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={shouldReduce ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: 0.38 }}
                  className="flex items-center gap-3"
                >
                  <CopyButton text={backupCodes.join("\n")} />
                  <motion.button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([backupCodes.join("\n")], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "pristav-radosti-backup-codes.txt";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors"
                    whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                  >
                    Stáhnout .txt
                  </motion.button>
                </motion.div>

                <motion.button
                  onClick={() => { setStep("status"); setBackupCodes([]); loadStatus(); }}
                  className="btn-primary w-full"
                  initial={shouldReduce ? {} : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.42 }}
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                >
                  Hotovo
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
