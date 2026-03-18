"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";

import { api } from "@/lib/api";
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
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800"
    >
      {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
      {copied ? "Zkopírováno" : "Kopírovat"}
    </button>
  );
}

export default function TwoFASettingsPage() {
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
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ ok: boolean; backupCodes: string[] }>("/auth/2fa/verify-setup", {
        token: verifyCode,
      });
      setBackupCodes(result.backupCodes);
      setStep("backup-codes");
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? "Neplatný kód");
      setVerifyCode("");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/2fa/disable", { token: disableCode });
      setDisableCode("");
      setShowDisableForm(false);
      await loadStatus();
    } catch (err: any) {
      setError(err?.message ?? "Chyba při deaktivaci 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleRegen = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<{ ok: boolean; backupCodes: string[] }>("/auth/2fa/backup-codes/regenerate", {
        token: regenCode,
      });
      setBackupCodes(result.backupCodes);
      setRegenCode("");
      setShowRegenForm(false);
      setStep("backup-codes");
    } catch (err: any) {
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
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push("/settings")}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Zpět"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Dvoufaktorové ověření (2FA)</h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── Status overview ─────────────────────────────────── */}
          {step === "status" && status && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isEnabled ? "bg-green-100" : "bg-gray-100"}`}>
                    {isEnabled
                      ? <ShieldCheck className="text-green-600" size={24} />
                      : <ShieldOff className="text-gray-400" size={24} />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {isEnabled ? "2FA je aktivní" : "2FA není aktivní"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {isEnabled
                        ? `Záložní kódy: ${status.backupCodesRemaining} zbývá`
                        : isMandatory
                          ? "Povinné pro vaši roli"
                          : "Volitelné — doporučujeme aktivovat"
                      }
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                  }`}>
                    {isEnabled ? "Aktivní" : "Neaktivní"}
                  </span>
                </div>
              </div>

              {isMandatory && !isEnabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>2FA je povinné pro vaši roli. Aktivujte jej pro plný přístup k systému.</span>
                </div>
              )}

              {!isEnabled && (
                <button
                  onClick={handleStartSetup}
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? "Inicializuji…" : "Aktivovat 2FA"}
                </button>
              )}

              {isEnabled && !isMandatory && (
                <>
                  {!showDisableForm ? (
                    <button
                      onClick={() => setShowDisableForm(true)}
                      className="btn-secondary w-full text-red-600 hover:bg-red-50"
                    >
                      Deaktivovat 2FA
                    </button>
                  ) : (
                    <form onSubmit={handleDisable} className="card space-y-3">
                      <p className="text-sm font-medium text-gray-700">Zadejte kód z autentikátoru pro deaktivaci:</p>
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
                        <button type="submit" disabled={loading || disableCode.length !== 6} className="btn-primary flex-1 bg-red-600 hover:bg-red-700">
                          {loading ? "Deaktivuji…" : "Deaktivovat"}
                        </button>
                        <button type="button" onClick={() => { setShowDisableForm(false); setDisableCode(""); setError(null); }} className="btn-secondary flex-1">
                          Zrušit
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {isEnabled && (
                <>
                  {status.backupCodesRemaining < 3 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
                      Zbývá jen {status.backupCodesRemaining} záložních kódů. Doporučujeme regenerovat.
                    </div>
                  )}
                  {!showRegenForm ? (
                    <button
                      onClick={() => setShowRegenForm(true)}
                      className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Regenerovat záložní kódy
                    </button>
                  ) : (
                    <form onSubmit={handleRegen} className="card space-y-3">
                      <p className="text-sm font-medium text-gray-700">Zadejte kód z autentikátoru pro generování nových záložních kódů:</p>
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
                        <button type="submit" disabled={loading || regenCode.length !== 6} className="btn-primary flex-1">
                          {loading ? "Generuji…" : "Generovat nové kódy"}
                        </button>
                        <button type="button" onClick={() => { setShowRegenForm(false); setRegenCode(""); setError(null); }} className="btn-secondary flex-1">
                          Zrušit
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Step: Scan QR ───────────────────────────────────── */}
          {step === "scan" && setupData && (
            <div className="card space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-50 rounded-full mb-3">
                  <QrCode className="text-primary-600" size={24} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Naskenujte QR kód</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Otevřete Google Authenticator nebo Authy a naskenujte tento kód.
                </p>
              </div>

              <div className="flex justify-center">
                <Image
                  src={setupData.qrCode}
                  alt="QR kód pro 2FA"
                  width={200}
                  height={200}
                  className="rounded-lg border border-gray-200"
                  unoptimized
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Nebo zadejte manuálně:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono break-all flex-1 text-gray-800">{setupData.secret}</code>
                  <CopyButton text={setupData.secret} />
                </div>
              </div>

              <button
                onClick={() => setStep("verify")}
                className="btn-primary w-full"
              >
                Pokračovat →
              </button>
            </div>
          )}

          {/* ── Step: Verify code ──────────────────────────────── */}
          {step === "verify" && (
            <form onSubmit={handleVerifySetup} className="card space-y-4">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Ověřte kód</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Zadejte 6místný kód z autentikátoru pro potvrzení.
                </p>
              </div>

              <input
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
              />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={loading || verifyCode.length !== 6} className="btn-primary flex-1">
                  {loading ? "Ověřuji…" : "Potvrdit a aktivovat"}
                </button>
                <button type="button" onClick={() => { setStep("scan"); setError(null); }} className="btn-secondary">
                  Zpět
                </button>
              </div>
            </form>
          )}

          {/* ── Step: Show backup codes ─────────────────────────── */}
          {step === "backup-codes" && (
            <div className="card space-y-4">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-50 rounded-full mb-3">
                  <CheckCircle className="text-green-600" size={24} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">2FA aktivována! Uložte záložní kódy</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Tyto jednorázové kódy použijte, pokud ztratíte přístup k autentikátoru.
                  <strong className="text-gray-700"> Uložte je na bezpečné místo — ukážeme je jen jednou.</strong>
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code) => (
                    <code key={code} className="text-center text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1 text-gray-800">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <CopyButton text={backupCodes.join("\n")} />
                <button
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
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Stáhnout .txt
                </button>
              </div>

              <button
                onClick={() => { setStep("status"); setBackupCodes([]); loadStatus(); }}
                className="btn-primary w-full"
              >
                Hotovo
              </button>
            </div>
          )}

          {!status && !error && (
            <div className="text-center py-8 text-gray-400">Načítám…</div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
