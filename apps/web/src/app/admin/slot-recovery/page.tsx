"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR, { mutate } from "swr";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminSlotRecoveryPage() {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [logStatusFilter, setLogStatusFilter] = useState<"ALL" | "SENT" | "FAILED">("ALL");
  const { data: events } = useSWR<any[]>("/slot-recovery/admin/events", fetcher);
  const { data: offers } = useSWR<any[]>("/slot-recovery/admin/offers", fetcher);
  const { data: settings } = useSWR<any>("/slot-recovery/admin/settings", fetcher);
  const { data: logs } = useSWR<any[]>("/slot-recovery/admin/delivery-logs", fetcher);
  const filteredLogs = (logs ?? []).filter((l) => (logStatusFilter === "ALL" ? true : l.status === logStatusFilter));

  async function runEngine() {
    setRunning(true);
    try {
      const res = await api.post("/slot-recovery/admin/run", {});
      setRunResult(res);
      mutate("/slot-recovery/admin/events");
      mutate("/slot-recovery/admin/offers");
    } finally {
      setRunning(false);
    }
  }

  async function saveSettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSettingsError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      enabled: form.get("enabled") === "on",
      mode: String(form.get("mode") || "full-auto"),
      pushOnly: form.get("pushOnly") === "on",
      batchSize: Number(form.get("batchSize")),
      offerExpirationMin: Number(form.get("offerExpirationMin")),
      discountHours: Number(form.get("discountHours")),
      maxOffersPerEvent: Number(form.get("maxOffersPerEvent")),
      maxOffersPerClientDay: Number(form.get("maxOffersPerClientDay")),
      clientCooldownHours: Number(form.get("clientCooldownHours")),
      defaultDiscountPercent: Number(form.get("defaultDiscountPercent")),
      maxDiscountPercent: Number(form.get("maxDiscountPercent")),
    };

    const rangeChecks: Array<{ value: number; min: number; max: number; label: string }> = [
      { value: payload.batchSize, min: 1, max: 200, label: "Batch size" },
      { value: payload.offerExpirationMin, min: 5, max: 180, label: "Offer expiration" },
      { value: payload.discountHours, min: 1, max: 48, label: "Discount hours threshold" },
      { value: payload.maxOffersPerEvent, min: 1, max: 25, label: "Max offers / event" },
      { value: payload.maxOffersPerClientDay, min: 1, max: 20, label: "Max offers / client / day" },
      { value: payload.clientCooldownHours, min: 1, max: 72, label: "Client cooldown" },
      { value: payload.defaultDiscountPercent, min: 0, max: 90, label: "Default discount %" },
      { value: payload.maxDiscountPercent, min: 0, max: 90, label: "Maximum discount %" },
    ];
    const invalid = rangeChecks.find((r) => Number.isNaN(r.value) || r.value < r.min || r.value > r.max);
    if (invalid) {
      setSettingsError(`${invalid.label} musí být v rozsahu ${invalid.min} až ${invalid.max}.`);
      return;
    }
    if (payload.defaultDiscountPercent > payload.maxDiscountPercent) {
      setSettingsError("Default discount % nesmí být vyšší než Maximum discount %.");
      return;
    }

    setSavingSettings(true);
    try {
      await api.put("/slot-recovery/admin/settings", payload);
      mutate("/slot-recovery/admin/settings");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Nepodařilo se uložit nastavení.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">Slot Recovery</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Full-auto režim s guardrails, dedupe a audit logem.
                </p>
              </div>
              <button onClick={runEngine} disabled={running} className="btn-primary">
                {running ? "Spouštím…" : "Run Engine"}
              </button>
            </div>
            {runResult && (
              <p className="text-sm text-green-600 mt-3">
                Processed: {runResult.processed}, Offered: {runResult.offered}, Filled: {runResult.filled}, Expired: {runResult.expired}
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Nastavení limitů a politiky</h2>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={saveSettings}>
              <label className="rounded border p-2 text-sm">
                <span>Engine enabled</span>
                <input className="ml-2" type="checkbox" name="enabled" defaultChecked={Boolean(settings?.enabled)} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Push only</span>
                <input className="ml-2" type="checkbox" name="pushOnly" defaultChecked={Boolean(settings?.pushOnly)} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Mode</span>
                <select name="mode" className="input mt-1" defaultValue={settings?.mode ?? "full-auto"}>
                  <option value="full-auto">full-auto</option>
                  <option value="dry-run">dry-run</option>
                </select>
              </label>

              <label className="rounded border p-2 text-sm">
                <span>Batch size</span>
                <input className="input mt-1" type="number" name="batchSize" defaultValue={settings?.batchSize ?? 25} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Offer expiration (min)</span>
                <input className="input mt-1" type="number" name="offerExpirationMin" defaultValue={settings?.offerExpirationMin ?? 20} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Discount hours threshold</span>
                <input className="input mt-1" type="number" name="discountHours" defaultValue={settings?.discountHours ?? 12} />
              </label>

              <label className="rounded border p-2 text-sm">
                <span>Max offers / event</span>
                <input className="input mt-1" type="number" name="maxOffersPerEvent" defaultValue={settings?.maxOffersPerEvent ?? 6} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Max offers / client / day</span>
                <input className="input mt-1" type="number" name="maxOffersPerClientDay" defaultValue={settings?.maxOffersPerClientDay ?? 4} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Client cooldown (h)</span>
                <input className="input mt-1" type="number" name="clientCooldownHours" defaultValue={settings?.clientCooldownHours ?? 6} />
              </label>

              <label className="rounded border p-2 text-sm">
                <span>Default discount %</span>
                <input className="input mt-1" type="number" name="defaultDiscountPercent" defaultValue={settings?.defaultDiscountPercent ?? 20} />
              </label>
              <label className="rounded border p-2 text-sm">
                <span>Maximum discount %</span>
                <input className="input mt-1" type="number" name="maxDiscountPercent" defaultValue={settings?.maxDiscountPercent ?? 30} />
              </label>
              <div className="flex items-end">
                <button className="btn-primary w-full" disabled={savingSettings}>
                  {savingSettings ? "Ukládám…" : "Uložit nastavení"}
                </button>
              </div>
            </form>
            {settingsError && (
              <p className="mt-3 text-sm text-red-600">{settingsError}</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Události storna</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">ID</th>
                    <th>Zdroj</th>
                    <th>Status</th>
                    <th>Start</th>
                    <th>Cena</th>
                    <th>Služba</th>
                  </tr>
                </thead>
                <tbody>
                  {(events ?? []).map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-2">{e.id}</td>
                      <td>{e.source_model}#{e.source_id}</td>
                      <td>{e.status}</td>
                      <td>{new Date(e.start_time).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td>{e.price_mode}</td>
                      <td>{e.service_name ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Nabídky klientům</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Offer</th>
                    <th>Event</th>
                    <th>Klient</th>
                    <th>Status</th>
                    <th>Kanál</th>
                    <th>Body</th>
                    <th>Vytvořeno</th>
                  </tr>
                </thead>
                <tbody>
                  {(offers ?? []).map((o) => (
                    <tr key={o.id} className="border-b">
                      <td className="py-2">#{o.id}</td>
                      <td>#{o.event_id}</td>
                      <td>{o.client_name}</td>
                      <td>{o.status}</td>
                      <td>{o.channel}</td>
                      <td>{o.reward_points}</td>
                      <td>{new Date(o.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold">Delivery log (komu co bylo posláno)</h2>
              <select
                className="input max-w-[180px]"
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value as "ALL" | "SENT" | "FAILED")}
              >
                <option value="ALL">Vše</option>
                <option value="SENT">Jen SENT</option>
                <option value="FAILED">Jen FAILED</option>
              </select>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Čas</th>
                    <th>Klient</th>
                    <th>Kanál</th>
                    <th>Status</th>
                    <th>Nadpis</th>
                    <th>Zpráva</th>
                    <th>Chyba</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr key={l.id} className="border-b align-top">
                      <td className="py-2">{new Date(l.created_at).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td>{l.client_name}</td>
                      <td>{l.channel}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            l.status === "FAILED"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          }`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td>{l.title}</td>
                      <td className="max-w-md whitespace-pre-wrap">{l.message}</td>
                      <td className="text-red-600">{l.error_message ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
