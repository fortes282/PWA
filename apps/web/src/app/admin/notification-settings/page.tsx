"use client";

import { useState, useEffect } from "react";
import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { Bell, Save, CheckCircle } from "lucide-react";

const STORAGE_KEY = "notification_settings";

interface NotificationSettings {
  // Waitlist
  waitlistEnabled: boolean;
  waitlistDelay: "0" | "15" | "30" | "60";
  // Discount
  discountEnabled: boolean;
  discountThreshold: number;
  discountHoursBefore: "2" | "4" | "6" | "12" | "24";
  // Reminder
  reminderEnabled: boolean;
  reminderBefore: "1" | "2" | "24" | "48";
}

const DEFAULTS: NotificationSettings = {
  waitlistEnabled: true,
  waitlistDelay: "15",
  discountEnabled: true,
  discountThreshold: 20,
  discountHoursBefore: "4",
  reminderEnabled: true,
  reminderBefore: "24",
};

function loadSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function set<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Bell size={22} className="text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nastavení notifikací</h1>
          </div>

          {saved && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700 rounded-lg px-4 py-3 mb-5 text-sm">
              <CheckCircle size={16} />
              Nastavení bylo uloženo.
            </div>
          )}

          {/* ── Section 1: Waitlist ─────────────────────────────────────────── */}
          <section className="card mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Automatické notifikace na waitlistu</h2>

            <label className="flex items-center justify-between gap-3 mb-4 cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Automaticky notifikovat klienty na waitlistu
              </span>
              <button
                type="button"
                onClick={() => set("waitlistEnabled", !settings.waitlistEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.waitlistEnabled ? "bg-primary-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings.waitlistEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            <div className={settings.waitlistEnabled ? "" : "opacity-50 pointer-events-none"}>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                Prodleva po uvolnění slotu
              </label>
              <select
                value={settings.waitlistDelay}
                onChange={(e) => set("waitlistDelay", e.target.value as NotificationSettings["waitlistDelay"])}
                className="input w-full max-w-xs"
              >
                <option value="0">Ihned</option>
                <option value="15">15 minut</option>
                <option value="30">30 minut</option>
                <option value="60">1 hodina</option>
              </select>
            </div>
          </section>

          {/* ── Section 2: Discount slots ────────────────────────────────────── */}
          <section className="card mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Slevové sloty (last-minute)</h2>

            <label className="flex items-center justify-between gap-3 mb-4 cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Notifikace o slevových slotech
              </span>
              <button
                type="button"
                onClick={() => set("discountEnabled", !settings.discountEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.discountEnabled ? "bg-primary-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings.discountEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            <div className={`space-y-4 ${settings.discountEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Sleva ≥ X %
                </label>
                <div className="flex items-center gap-2 max-w-xs">
                  <input
                    type="number"
                    min={10}
                    max={50}
                    value={settings.discountThreshold}
                    onChange={(e) =>
                      set("discountThreshold", Math.min(50, Math.max(10, parseInt(e.target.value) || 10)))
                    }
                    className="input w-24"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <span className="text-xs text-gray-400">(10–50 %)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  Notifikovat X hodin předem
                </label>
                <select
                  value={settings.discountHoursBefore}
                  onChange={(e) =>
                    set("discountHoursBefore", e.target.value as NotificationSettings["discountHoursBefore"])
                  }
                  className="input w-full max-w-xs"
                >
                  <option value="2">2 hodiny</option>
                  <option value="4">4 hodiny</option>
                  <option value="6">6 hodin</option>
                  <option value="12">12 hodin</option>
                  <option value="24">24 hodin</option>
                </select>
              </div>
            </div>
          </section>

          {/* ── Section 3: Reminders ─────────────────────────────────────────── */}
          <section className="card mb-6">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Připomínky před termínem</h2>

            <label className="flex items-center justify-between gap-3 mb-4 cursor-pointer">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Připomínka před termínem
              </span>
              <button
                type="button"
                onClick={() => set("reminderEnabled", !settings.reminderEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.reminderEnabled ? "bg-primary-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    settings.reminderEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>

            <div className={settings.reminderEnabled ? "" : "opacity-50 pointer-events-none"}>
              <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                Kdy připomenout
              </label>
              <select
                value={settings.reminderBefore}
                onChange={(e) => set("reminderBefore", e.target.value as NotificationSettings["reminderBefore"])}
                className="input w-full max-w-xs"
              >
                <option value="1">1 hodinu před termínem</option>
                <option value="2">2 hodiny před termínem</option>
                <option value="24">24 hodin před termínem</option>
                <option value="48">48 hodin před termínem</option>
              </select>
            </div>
          </section>

          <button
            type="button"
            onClick={handleSave}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} /> Uložit nastavení
          </button>
        </div>
      </Layout>
    </RouteGuard>
  );
}
