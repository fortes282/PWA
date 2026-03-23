"use client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { useState } from "react";
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, RefreshCw } from "lucide-react";

const fetcher = (url: string) => api.get<any>(url);

export default function AdminApiKeys() {
  const shouldReduce = useReducedMotion();
  const { data: keys, mutate: mutateKeys } = useSWR<any[]>("/admin/api-keys", fetcher as any);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number | "">(90);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const result = await api.post<any>("/admin/api-keys", {
        name: name.trim(),
        scopes: ["read"],
        expiresInDays: expiresInDays || undefined,
      });
      setNewKey(result.key);
      setName("");
      setExpiresInDays(90);
      mutateKeys();
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleRevoke = async (id: number, keyName: string) => {
    if (!confirm(`Opravdu chcete zrušit API klíč "${keyName}"?`)) return;
    try {
      await api.delete(`/admin/api-keys/${id}`);
      mutateKeys();
    } catch { /* ignore */ }
  };

  const handleCopy = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <Key className="inline mr-2" size={24} />
              API Klíče
            </h1>
            <motion.button
              onClick={() => { setShowCreate(!showCreate); setNewKey(null); }}
              className="btn-primary flex items-center gap-2"
              whileTap={shouldReduce ? undefined : { scale: 0.97 }}
            >
              <Plus size={14} /> Nový klíč
            </motion.button>
          </motion.div>

          {/* New key created — show once */}
          <AnimatePresence>
            {newKey && (
              <motion.div
                key="new-key-banner"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0" size={20} />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                      Klíč vytvořen — uložte si ho, nebude znovu zobrazen!
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="bg-white dark:bg-gray-800 px-3 py-2 rounded border font-mono text-sm break-all flex-1">
                        {newKey}
                      </code>
                      <motion.button
                        onClick={handleCopy}
                        className="btn-secondary flex items-center gap-1 flex-shrink-0"
                        whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? "Zkopírováno" : "Kopírovat"}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Create form */}
          <AnimatePresence>
            {showCreate && !newKey && (
              <motion.div
                key="create-form"
                initial={shouldReduce ? {} : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-6"
              >
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Vytvořit nový API klíč</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label">Název</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="např. Monitoring, Webhook..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Platnost (dny)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="90"
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : "")}
                      min={1}
                      max={365}
                    />
                  </div>
                </div>
                <motion.button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  className="btn-primary flex items-center gap-2"
                  whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                >
                  {creating ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                  Vytvořit
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Keys list */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.1 }}
            className="card"
          >
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Existující klíče</h2>
            {keys && keys.length > 0 ? (
              <div className="space-y-3">
                {keys.map((k: any, i: number) => (
                  <motion.div
                    key={k.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: i * 0.04 }}
                    className={`flex items-center justify-between p-3 rounded-lg border ${k.isActive ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 opacity-60"}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{k.name}</span>
                        {!k.isActive && (
                          <span className="badge-danger text-xs">Zrušený</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span className="font-mono">{k.prefix}…</span>
                        {k.expiresAt && (
                          <span className="ml-3">
                            Vyprší: {new Date(k.expiresAt).toLocaleDateString("cs")}
                          </span>
                        )}
                        {k.lastUsedAt && (
                          <span className="ml-3">
                            Naposledy: {new Date(k.lastUsedAt).toLocaleDateString("cs")}
                          </span>
                        )}
                      </div>
                    </div>
                    {k.isActive && (
                      <motion.button
                        onClick={() => handleRevoke(k.id, k.name)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 ml-4"
                        title="Zrušit klíč"
                        whileTap={shouldReduce ? undefined : { scale: 0.92 }}
                      >
                        <Trash2 size={16} />
                      </motion.button>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Žádné API klíče</p>
            )}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
