"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Gift, Plus, X } from "lucide-react";
import { useToast } from "@/app/components/Toast";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any[]>(url);

const AMOUNT_PRESETS = [500, 1000, 2000, 5000];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  REDEEMED: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  EXPIRED: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Aktivní",
  REDEEMED: "Uplatněn",
  EXPIRED: "Expirovaný",
};

function getDefaultExpiry(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

export default function AdminVouchers() {
  const shouldReduce = useReducedMotion();
  const { data: vouchers, mutate } = useSWR("/vouchers", fetcher);
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState<number>(1000);
  const [expiresAt, setExpiresAt] = useState(getDefaultExpiry);
  const [message, setMessage] = useState("");

  const resetForm = () => {
    setRecipientName("");
    setRecipientEmail("");
    setAmount(1000);
    setExpiresAt(getDefaultExpiry());
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !amount) return;
    setSubmitting(true);
    try {
      await api.post("/vouchers", {
        recipientName,
        recipientEmail: recipientEmail || undefined,
        amount,
        expiresAt,
        message: message || undefined,
      });
      toast("success", "Voucher byl vytvořen.");
      resetForm();
      setShowForm(false);
      mutate();
    } catch {
      toast("error", "Chyba při vytváření voucheru.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Gift size={24} className="text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dárkové vouchery</h1>
            </div>
            <motion.button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors min-h-[44px] text-sm font-medium"
              whileTap={shouldReduce ? undefined : { scale: 0.95 }}
            >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Zavřít" : "Nový voucher"}
            </motion.button>
          </motion.div>

          {/* Create form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                key="voucher-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card"
              >
                <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Nový voucher</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Jméno příjemce *
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      E-mail příjemce
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Hodnota *
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {AMOUNT_PRESETS.map((preset) => (
                        <motion.button
                          key={preset}
                          type="button"
                          onClick={() => setAmount(preset)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                            amount === preset
                              ? "bg-primary-600 text-white"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                          }`}
                          whileTap={shouldReduce ? undefined : { scale: 0.95 }}
                        >
                          {preset.toLocaleString("cs-CZ")} Kč
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Platnost do
                    </label>
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Zpráva
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Osobní zpráva pro příjemce..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={submitting || !recipientName}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors min-h-[44px] text-sm font-medium"
                    whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                  >
                    {submitting ? "Vytvářím..." : "Vytvořit voucher"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Voucher list */}
          <AnimatePresence mode="wait">
            {!vouchers ? (
              <motion.p
                key="loading"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                Načítám vouchery...
              </motion.p>
            ) : vouchers.length === 0 ? (
              <motion.div
                key="empty"
                initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: 8 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="card text-center py-8"
              >
                <Gift size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Zatím nebyly vytvořeny žádné vouchery</p>
              </motion.div>
            ) : (
              <motion.div
                key="voucher-list"
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={shouldReduce ? {} : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {/* Table header - desktop */}
                <div className="hidden md:grid md:grid-cols-5 gap-4 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <span>Kód</span>
                  <span>Příjemce</span>
                  <span>Hodnota</span>
                  <span>Status</span>
                  <span>Vytvořeno</span>
                </div>
                {vouchers.map((v: any, i: number) => (
                  <motion.div
                    key={v.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className="card"
                  >
                    {/* Desktop */}
                    <div className="hidden md:grid md:grid-cols-5 gap-4 items-center">
                      <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{v.code}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{v.recipientName}</p>
                        {v.recipientEmail && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{v.recipientEmail}</p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {Number(v.amount).toLocaleString("cs-CZ")} Kč
                      </span>
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium w-fit ${STATUS_BADGE[v.status] ?? STATUS_BADGE.EXPIRED}`}>
                        {STATUS_LABEL[v.status] ?? v.status}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(v.createdAt).toLocaleDateString("cs-CZ")}
                      </span>
                    </div>
                    {/* Mobile */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{v.code}</span>
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[v.status] ?? STATUS_BADGE.EXPIRED}`}>
                          {STATUS_LABEL[v.status] ?? v.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-800 dark:text-gray-200">{v.recipientName}</p>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {Number(v.amount).toLocaleString("cs-CZ")} Kč
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(v.createdAt).toLocaleDateString("cs-CZ")}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Layout>
    </RouteGuard>
  );
}
