"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { Save, Bell, Building, Shield, Plus, Trash2, AlertTriangle, Phone } from "lucide-react";
import { useToast } from "@/app/components/Toast";

const fetcher = (url: string) => api.get<Record<string, string>>(url);

const DEFAULTS = {
  invoicePrefix: "INV",
  dueDays: "14",
  invoiceFooter: "Pristav Radosti s.r.o. | IČ: 12345678",
  emailReminder: "true",
  smsReminder: "false",
  reminderHours: "24",
  noShowPenalty: "20",
  lateCancelPenalty: "10",
  goodBehaviorBonus: "5",
  timezone: "Europe/Prague",
  currency: "CZK",
  language: "cs",
};

interface EmContact {
  id: number;
  name: string;
  phone: string;
  description?: string;
  is_active: number;
  sort_order: number;
}

function EmergencyContactsSection() {
  const shouldReduce = useReducedMotion();
  const { data, mutate } = useSWR<{ contacts: EmContact[] }>("/emergency/contacts", (url: string) => api.get<any>(url));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", description: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const contacts = data?.contacts ?? [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    setSaving(true);
    try {
      await api.post<any>("/emergency/contacts", { name: form.name, phone: form.phone, description: form.description });
      toast("success", "Kontakt byl uložen.");
      setForm({ name: "", phone: "", description: "" });
      setAdding(false);
      mutate();
    } catch (err: unknown) {
      toast("error", err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete<any>(`/emergency/contacts/${id}`);
      mutate();
    } catch { /* ignore */ }
  };

  const handleToggle = async (c: EmContact) => {
    try {
      await api.put<any>(`/emergency/contacts/${c.id}`, { isActive: !c.is_active });
      mutate();
    } catch { /* ignore */ }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-500" />
        Nouzové kontakty
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Tyto kontakty se zobrazí klientům v SOS krizovém dialogu.
      </p>

      <ul className="space-y-2 mb-4">
        <AnimatePresence>
          {contacts.length === 0 && (
            <motion.li
              key="empty"
              initial={shouldReduce ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduce ? {} : { opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-sm text-gray-500 dark:text-gray-400 italic"
            >
              Žádné kontakty.
            </motion.li>
          )}
          {contacts.map((c, i) => (
            <motion.li
              key={c.id}
              initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduce ? {} : { opacity: 0, x: -6 }}
              transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${c.is_active ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" : "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-50"}`}
            >
              <Phone size={14} className="text-red-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.phone}{c.description ? ` — ${c.description}` : ""}</p>
              </div>
              <motion.button
                onClick={() => handleToggle(c)}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.is_active ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60" : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"}`}
                whileTap={shouldReduce ? undefined : { scale: 0.95 }}
              >
                {c.is_active ? "Aktivní" : "Neaktivní"}
              </motion.button>
              <motion.button
                onClick={() => handleDelete(c.id)}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                aria-label="Smazat"
                whileTap={shouldReduce ? undefined : { scale: 0.9 }}
              >
                <Trash2 size={15} />
              </motion.button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <AnimatePresence mode="wait">
        {adding ? (
          <motion.form
            key="add-form"
            initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onSubmit={handleAdd}
            className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-xl p-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Název *</label>
                <input
                  className="input text-sm"
                  placeholder="Linka bezpečí"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Telefon *</label>
                <input
                  className="input text-sm"
                  placeholder="116 123"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Popis</label>
              <input
                className="input text-sm"
                placeholder="Bezplatná krizová linka, nonstop"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <motion.button
                type="submit"
                disabled={saving}
                className="btn-primary text-sm"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                {saving ? "Ukládám…" : "Uložit"}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => setAdding(false)}
                className="btn-secondary text-sm"
                whileTap={shouldReduce ? undefined : { scale: 0.97 }}
              >
                Zrušit
              </motion.button>
            </div>
          </motion.form>
        ) : (
          <motion.button
            key="add-btn"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            <Plus size={16} />
            Přidat kontakt
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailTestSection() {
  const shouldReduce = useReducedMotion();
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const { data: smtpStatus } = useSWR<any>("/system-settings/smtp/status", (url: string) => api.get<any>(url));

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTestResult(null);
    try {
      await api.post<any>("/system-settings/email/test", { to: testEmail });
      setTestResult({ ok: true });
    } catch (err: any) {
      setTestResult({ error: err?.message ?? "Chyba" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        E-mail test
        <AnimatePresence>
          {smtpStatus && (
            <motion.span
              key="smtp-badge"
              initial={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduce ? {} : { opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={`text-xs px-2 py-0.5 rounded-full font-normal ${smtpStatus.configured ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400"}`}
            >
              {smtpStatus.configured ? `SMTP: ${smtpStatus.host}` : "SMTP není nakonfigurováno"}
            </motion.span>
          )}
        </AnimatePresence>
      </h2>
      <AnimatePresence>
        {smtpStatus && !smtpStatus.configured && (
          <motion.p
            key="smtp-warning"
            initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="text-xs text-yellow-700 dark:text-yellow-400 mb-3"
          >
            Pro aktivaci e-mailu nastavte env proměnné: SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM
          </motion.p>
        )}
      </AnimatePresence>
      <form onSubmit={handleTest} className="flex gap-2">
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="testovaci@email.cz"
          className="input flex-1 text-sm"
          required
        />
        <motion.button
          type="submit"
          disabled={sending}
          className="btn-secondary text-sm"
          whileTap={shouldReduce ? undefined : { scale: 0.97 }}
        >
          {sending ? "Odesílám…" : "Odeslat test"}
        </motion.button>
      </form>
      <AnimatePresence>
        {testResult && (
          <motion.p
            key="test-result"
            initial={shouldReduce ? {} : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduce ? {} : { opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className={`text-xs mt-2 ${testResult.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {testResult.ok ? "✓ Testovací e-mail byl odeslán" : `✗ ${testResult.error}`}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppointmentTemplatesSection() {
  const shouldReduce = useReducedMotion();
  const { data: templates, mutate } = useSWR<any[]>("/appointment-templates", (url: string) => api.get<any[]>(url));
  const { data: services } = useSWR<any[]>("/services", (url: string) => api.get<any[]>(url));
  const { data: employees } = useSWR<any[]>("/employees", (url: string) => api.get<any[]>(url));
  const [form, setForm] = useState({ name: "", serviceId: "", employeeId: "", durationMinutes: "60", notes: "" });
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.serviceId) return;
    setSaving(true);
    try {
      await api.post("/appointment-templates", {
        name: form.name,
        serviceId: parseInt(form.serviceId),
        employeeId: form.employeeId ? parseInt(form.employeeId) : undefined,
        durationMinutes: parseInt(form.durationMinutes),
        notes: form.notes || undefined,
      });
      setForm({ name: "", serviceId: "", employeeId: "", durationMinutes: "60", notes: "" });
      mutate();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/appointment-templates/${id}`);
    mutate();
  };

  return (
    <div className="card mb-6">
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Šablony termínů</h2>
      <AnimatePresence>
        {(templates?.length ?? 0) > 0 ? (
          <motion.div
            key="templates-list"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-2 mb-4"
          >
            {templates!.map((t: any, i: number) => (
              <motion.div
                key={t.id}
                initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, x: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                className="flex items-center justify-between gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
              >
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{t.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">· {t.serviceName ?? "?"} · {t.employeeName ?? "any"} · {t.durationMinutes} min</span>
                  {t.notes && <span className="text-gray-500 dark:text-gray-400 ml-2">· {t.notes}</span>}
                </div>
                <motion.button
                  onClick={() => handleDelete(t.id)}
                  className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300"
                  whileTap={shouldReduce ? undefined : { scale: 0.9 }}
                >
                  <Trash2 size={14} />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.p
            key="templates-empty"
            initial={shouldReduce ? {} : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduce ? {} : { opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs text-gray-500 dark:text-gray-400 mb-4"
          >
            Žádné šablony. Přidejte první šablonu.
          </motion.p>
        )}
      </AnimatePresence>
      <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Název šablony *</label>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Standardní masáž" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Služba *</label>
          <select required value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })} className="input">
            <option value="">-- vyberte --</option>
            {services?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Terapeut (volitelný)</label>
          <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="input">
            <option value="">-- jakýkoliv --</option>
            {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Délka (min)</label>
          <input type="number" min="15" max="480" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="input" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Poznámka</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Volitelná poznámka…" />
        </div>
        <div className="col-span-2 flex justify-end">
          <motion.button
            type="submit"
            className="btn-primary flex items-center gap-1.5 text-sm"
            disabled={saving}
            whileTap={shouldReduce ? undefined : { scale: 0.97 }}
          >
            <Plus size={14} /> {saving ? "Ukládám…" : "Přidat šablonu"}
          </motion.button>
        </div>
      </form>
    </div>
  );
}

export default function AdminSettings() {
  const shouldReduce = useReducedMotion();
  const { data: remoteSettings, mutate } = useSWR("/system-settings", fetcher);

  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync from API when loaded
  useEffect(() => {
    if (remoteSettings) {
      setSettings((prev) => ({ ...prev, ...remoteSettings }));
    }
  }, [remoteSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.put("/system-settings", settings);
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const Toggle = ({ label, desc, field }: { label: string; desc?: string; field: keyof typeof settings }) => {
    const isOn = settings[field] === "true";
    return (
      <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
          {desc && <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>}
        </div>
        <motion.button
          onClick={() => update(field as string, isOn ? "false" : "true")}
          className={`relative w-12 h-6 rounded-full transition-colors ${isOn ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"}`}
          whileTap={shouldReduce ? undefined : { scale: 0.95 }}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow ${isOn ? "translate-x-7" : "translate-x-1"}`}
          />
        </motion.button>
      </div>
    );
  };

  const Field = ({ label, field, type = "text", placeholder = "" }: {
    label: string; field: keyof typeof settings; type?: string; placeholder?: string;
  }) => (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={settings[field] as string}
        onChange={(e) => update(field, e.target.value)}
        className="input"
        placeholder={placeholder}
      />
    </div>
  );

  const sectionVariants = {
    hidden: {},
    visible: {},
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Nastavení</h1>
            <motion.button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Save size={16} /> {saving ? "Ukládám…" : "Uložit vše"}
            </motion.button>
          </motion.div>

          {/* Saved feedback */}
          <AnimatePresence>
            {saved && (
              <motion.div
                key="saved-banner"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-green-700 dark:text-green-400 text-sm"
              >
                ✓ Nastavení uloženo
              </motion.div>
            )}
          </AnimatePresence>

          {/* Business info */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Building size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Provoz</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Časová zóna</label>
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
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Měna</label>
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
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Jazyk systému</label>
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
          </motion.div>

          {/* Invoices */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Faktury</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prefix čísla faktury" field="invoicePrefix" placeholder="INV" />
              <Field label="Splatnost (dny)" field="dueDays" type="number" placeholder="14" />
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Patička faktury</label>
                <textarea
                  value={settings.invoiceFooter}
                  onChange={(e) => update("invoiceFooter", e.target.value)}
                  className="input min-h-[60px]"
                  placeholder="Firma s.r.o. | IČ: ..."
                />
              </div>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.15 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Bell size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Notifikace</h2>
            </div>
            <Toggle label="Email připomínky" desc="Automatický email před termínem" field="emailReminder" />
            <Toggle label="SMS připomínky" desc="Automatická SMS před termínem (FAYN)" field="smsReminder" />
            <div className="mt-3">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
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
          </motion.div>

          {/* Behavior scoring */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.2 }}
            className="card mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield size={18} className="text-primary-500" />
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Behavior skóre</h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Body se automaticky přičítají/odečítají při událostech (no-show, zrušení, dochvilnost…)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">No-show (penalizace)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.noShowPenalty}
                  onChange={(e) => update("noShowPenalty", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pozdní zrušení</label>
                <input
                  type="number"
                  min="0"
                  value={settings.lateCancelPenalty}
                  onChange={(e) => update("lateCancelPenalty", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dochvilnost (bonus)</label>
                <input
                  type="number"
                  min="0"
                  value={settings.goodBehaviorBonus}
                  onChange={(e) => update("goodBehaviorBonus", e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </motion.div>

          {/* Appointment templates */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.25 }}
          >
            <AppointmentTemplatesSection />
          </motion.div>

          {/* Emergency contacts */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.3 }}
            className="mb-6"
          >
            <EmergencyContactsSection />
          </motion.div>

          {/* Email test */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.35 }}
            className="mb-6"
          >
            <EmailTestSection />
          </motion.div>

          {/* System info */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.4 }}
            className="card bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
          >
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Systémové info</h2>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-gray-500 dark:text-gray-400">Verze</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">2.0.0</span>
              <span className="text-gray-500 dark:text-gray-400">Databáze</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">SQLite</span>
              <span className="text-gray-500 dark:text-gray-400">Celkem termínů</span>
              <span className="text-gray-900 dark:text-gray-100">—</span>
              <span className="text-gray-500 dark:text-gray-400">Celkem klientů</span>
              <span className="text-gray-900 dark:text-gray-100">—</span>
            </div>
          </motion.div>

        </div>
      </Layout>
    </RouteGuard>
  );
}
