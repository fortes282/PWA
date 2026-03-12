"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Save, Bell, Building, Shield } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminSettings() {
  const { data: stats } = useSWR("/stats", fetcher);

  const [settings, setSettings] = useState({
    // Invoice settings
    invoicePrefix: "INV",
    dueDays: "14",
    invoiceFooter: "Pristav Radosti s.r.o. | IČ: 12345678",

    // Notification defaults
    emailReminder: true,
    smsReminder: false,
    reminderHours: "24",

    // Behavior
    noShowPenalty: "20",
    lateCancelPenalty: "10",
    goodBehaviorBonus: "5",

    // Business
    timezone: "Europe/Prague",
    currency: "CZK",
    language: "cs",
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    // In production: POST /admin/settings
    // For now: simulate save
    await new Promise((r) => setTimeout(r, 500));
    setSaved(true);
    setSaving(false);
  };

  const update = (key: string, value: string | boolean) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const Toggle = ({ label, desc, field }: { label: string; desc?: string; field: keyof typeof settings }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
      <button
        onClick={() => update(field, !settings[field])}
        className={`relative w-12 h-6 rounded-full transition-colors ${settings[field] ? "bg-primary-600" : "bg-gray-200"}`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings[field] ? "translate-x-7" : "translate-x-1"}`} />
      </button>
    </div>
  );

  const Field = ({ label, field, type = "text", placeholder = "" }: {
    label: string; field: keyof typeof settings; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={settings[field] as string}
        onChange={(e) => update(field, e.target.value)}
        className="input"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Nastavení</h1>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              <Save size={16} /> {saving ? "Ukládám…" : "Uložit vše"}
            </button>
          </div>

          {saved && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
              ✓ Nastavení uloženo
            </div>
          )}

          {/* Business info */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Building size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Provoz</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Časová zóna</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                  className="input"
                >
                  <option value="Europe/Prague">Europe/Prague</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Měna</label>
                <select
                  value={settings.currency}
                  onChange={(e) => update("currency", e.target.value)}
                  className="input"
                >
                  <option value="CZK">CZK</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jazyk systému</label>
                <select
                  value={settings.language}
                  onChange={(e) => update("language", e.target.value)}
                  className="input"
                >
                  <option value="cs">Čeština</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Faktury</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prefix čísla faktury" field="invoicePrefix" placeholder="INV" />
              <Field label="Splatnost (dny)" field="dueDays" type="number" placeholder="14" />
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Patička faktury</label>
                <textarea
                  value={settings.invoiceFooter}
                  onChange={(e) => update("invoiceFooter", e.target.value)}
                  className="input min-h-[60px]"
                  placeholder="Firma s.r.o. | IČ: ..."
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Notifikace</h2>
            </div>
            <Toggle label="Email připomínky" desc="Automatický email před termínem" field="emailReminder" />
            <Toggle label="SMS připomínky" desc="Automatická SMS před termínem (FAYN)" field="smsReminder" />
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">
                Odeslat připomínku (hodin před termínem)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={settings.reminderHours}
                onChange={(e) => update("reminderHours", e.target.value)}
                className="input w-32"
              />
            </div>
          </div>

          {/* Behavior scoring */}
          <div className="card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900">Behavior skóre</h2>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Body se automaticky přičítají/odečítají při událostech (no-show, zrušení, dochvilnost…)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">No-show (penalizace)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.noShowPenalty}
                  onChange={(e) => update("noShowPenalty", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Pozdní zrušení</label>
                <input
                  type="number"
                  min="0"
                  value={settings.lateCancelPenalty}
                  onChange={(e) => update("lateCancelPenalty", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dochvilnost (bonus)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.goodBehaviorBonus}
                  onChange={(e) => update("goodBehaviorBonus", e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* System info */}
          <div className="card bg-gray-50 border-gray-200">
            <h2 className="font-semibold text-gray-700 mb-3">Systémové info</h2>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-gray-500">Verze</span>
              <span className="font-mono">2.0.0</span>
              <span className="text-gray-500">Databáze</span>
              <span className="font-mono">SQLite</span>
              <span className="text-gray-500">Celkem termínů</span>
              <span>{stats?.totalAppts ?? "—"}</span>
              <span className="text-gray-500">Celkem klientů</span>
              <span>{stats?.totalClients ?? "—"}</span>
            </div>
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
