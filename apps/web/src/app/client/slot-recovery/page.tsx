"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate } from "swr";
import { useState } from "react";
import { Bell, CheckCircle2, Clock, XCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientSlotRecoveryPage() {
  const [saving, setSaving] = useState(false);
  const [respondingOfferId, setRespondingOfferId] = useState<number | null>(null);
  const { data: profile } = useSWR("/slot-recovery/me/profile", fetcher);
  const { data: history } = useSWR<any[]>("/slot-recovery/me/history", fetcher);

  async function updateProfile(next: { optIn: boolean; preferredWindowHours: number }) {
    setSaving(true);
    try {
      await api.put("/slot-recovery/me/profile", next);
      mutate("/slot-recovery/me/profile");
    } finally {
      setSaving(false);
    }
  }

  async function respond(offerId: number, action: "ACCEPT" | "DECLINE") {
    setRespondingOfferId(offerId);
    try {
      await api.post("/slot-recovery/respond", { offerId, action });
      mutate("/slot-recovery/me/history");
      mutate("/slot-recovery/me/profile");
    } finally {
      setRespondingOfferId(null);
    }
  }

  const activeOffers = (history ?? []).filter((h) => h.status === "OFFERED");

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="card">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="text-primary-500" size={18} />
              <h1 className="text-xl font-semibold">Náhradní termíny</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Autonomní systém vás osloví při uvolnění termínu. Recovery body jsou samostatné a neovlivňují skóre dochvilnosti.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Recovery score</p>
                <p className="text-2xl font-bold text-primary-600">{profile?.recoveryScore ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Nabídky celkem</p>
                <p className="text-2xl font-bold">{profile?.totalOffers ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Přijaté nabídky</p>
                <p className="text-2xl font-bold text-green-600">{profile?.totalAccepted ?? 0}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <label className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">Automatické oslovování</span>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(profile?.optIn)}
                  disabled={saving}
                  onChange={(e) => updateProfile({ optIn: e.target.checked, preferredWindowHours: profile?.preferredWindowHours ?? 48 })}
                />
              </label>
              <label className="rounded-lg border p-3">
                <span className="text-sm font-medium">Preferované časové okno (hodiny)</span>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="input mt-2"
                  value={profile?.preferredWindowHours ?? 48}
                  disabled={saving}
                  onChange={(e) =>
                    updateProfile({
                      optIn: Boolean(profile?.optIn),
                      preferredWindowHours: Number.parseInt(e.target.value, 10) || 48,
                    })
                  }
                />
              </label>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Aktivní nabídky</h2>
            {activeOffers.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Momentálně nemáte aktivní nabídky.</p>
            )}
            <div className="space-y-3">
              {activeOffers.map((offer) => (
                <div key={offer.offerId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {new Date(offer.startTime).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="text-xs text-gray-500">
                        Režim: {offer.priceMode === "FULL" ? "Plná cena" : "Last-minute sleva"} | Body: +{offer.rewardPoints}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-primary"
                        disabled={respondingOfferId === offer.offerId}
                        onClick={() => respond(offer.offerId, "ACCEPT")}
                      >
                        Přijmout
                      </button>
                      <button
                        className="btn-secondary"
                        disabled={respondingOfferId === offer.offerId}
                        onClick={() => respond(offer.offerId, "DECLINE")}
                      >
                        Odmítnout
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Historie recovery nabídek</h2>
            <div className="space-y-2">
              {(history ?? []).map((offer) => (
                <div key={offer.offerId} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div>
                    <p>{new Date(offer.startTime).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })}</p>
                    <p className="text-xs text-gray-500">Kanál: {offer.channel}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {offer.status === "ACCEPTED" && <CheckCircle2 size={16} className="text-green-500" />}
                    {offer.status === "DECLINED" && <XCircle size={16} className="text-red-500" />}
                    {offer.status === "EXPIRED" && <Clock size={16} className="text-orange-500" />}
                    <span>{offer.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
