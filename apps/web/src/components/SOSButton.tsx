"use client";

import { useState } from "react";
import { Phone, X, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface EmergencyContact {
  name: string;
  phone: string;
  description?: string;
}

const DEFAULT_CONTACTS: EmergencyContact[] = [
  { name: "Linka bezpečí", phone: "116 123", description: "Bezplatná krizová linka, nonstop" },
  { name: "Centrum krizové intervence Praha", phone: "284 016 666", description: "Krizová intervence Praha" },
  { name: "Tísňová linka", phone: "112", description: "Integrovaný záchranný systém" },
];

export default function SOSButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>(DEFAULT_CONTACTS);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleOpen = async () => {
    setOpen(true);
    setSent(false);
    setError(null);
    // Pre-fetch contacts from API (non-blocking)
    try {
      const res = await api.get<{ contacts: EmergencyContact[] }>("/emergency/contacts");
      if (res.contacts?.length) setContacts(res.contacts);
    } catch { /* use defaults */ }
  };

  const handleContactTherapist = async () => {
    if (sending || sent) return;
    setSending(true);
    setError(null);
    try {
      await api.post<any>("/emergency/sos", {});
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? "Nepodařilo se odeslat upozornění");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating SOS button */}
      <button
        onClick={handleOpen}
        aria-label="SOS – Nouzová pomoc"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-lg shadow-red-600/40 flex items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-offset-2 animate-pulse hover:animate-none"
        style={{ bottom: "1.5rem", right: "1.5rem" }}
      >
        <span className="font-bold text-sm tracking-wide">SOS</span>
      </button>

      {/* Crisis dialog */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-dialog-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={22} className="text-white" />
                <h2 id="sos-dialog-title" className="text-white font-bold text-lg">
                  Krizová pomoc
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/80 hover:text-white"
                aria-label="Zavřít"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Jste v bezpečí? Pokud potřebujete okamžitou pomoc, zavolejte na jednu z krizových linek:
              </p>

              {/* Emergency contacts */}
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li key={c.phone}>
                    <a
                      href={`tel:${c.phone.replace(/\s/g, "")}`}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
                        <Phone size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{c.name}</p>
                        {c.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.description}</p>
                        )}
                      </div>
                      <span className="font-mono font-bold text-red-700 dark:text-red-400 text-sm group-hover:underline">
                        {c.phone}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Nebo upozornit svého terapeuta a recepci:
                </p>

                {sent ? (
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 rounded-xl px-4 py-3 text-sm">
                    <span className="text-lg">✓</span>
                    <span>Upozornění bylo odesláno. Terapeut/recepce byli informováni.</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={handleContactTherapist}
                      disabled={sending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-medium text-sm transition-colors"
                    >
                      {sending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Phone size={16} />
                      )}
                      Kontaktovat mého terapeuta
                    </button>
                    {error && (
                      <p className="text-xs text-red-600 mt-2">{error}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
