"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { ShoppingBag, Package, CheckCircle } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientPackagesPage() {
  const shouldReduce = useReducedMotion();
  const { user } = useAuth();
  const { data: packages } = useSWR<any[]>("/packages", fetcher);
  const { data: myPackages, mutate: mutateMy } = useSWR<any[]>(
    user ? `/clients/${user.id}/packages` : null,
    fetcher
  );
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const handlePurchase = async (pkgId: number) => {
    setPurchasing(pkgId);
    setMessage("");
    try {
      const res = await api.post<any>(`/packages/${pkgId}/purchase`, {});
      setMessage(res.message ?? "Balíček zakoupen!");
      await mutateMy();
    } catch (e: any) {
      setMessage(e.message ?? "Chyba při nákupu");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-3 mb-6"
          >
            <ShoppingBag size={28} className="text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Balíčky sezení</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Zakupte předplacený balíček a ušetřete</p>
            </div>
          </motion.div>

          {/* Purchase message */}
          <AnimatePresence>
            {message && (
              <motion.div
                key="message"
                initial={shouldReduce ? {} : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduce ? {} : { opacity: 0, y: -6 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="card mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-center gap-2"
              >
                <CheckCircle size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                <p className="text-green-700 dark:text-green-300 text-sm">{message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Available packages */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.05 }}
            className="mb-8"
          >
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <Package size={16} className="text-primary-500" />
              Dostupné balíčky
            </h2>
            {packages === undefined ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Načítám…</p>
            ) : packages.length === 0 ? (
              <motion.p
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-gray-500 dark:text-gray-400 text-sm"
              >
                Momentálně nejsou k dispozici žádné balíčky.
              </motion.p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map((pkg, i) => (
                  <motion.div
                    key={pkg.id}
                    initial={shouldReduce ? {} : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.08 + i * 0.06 }}
                    className="card flex flex-col gap-3"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{pkg.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {pkg.sessionsCount ?? pkg.sessions_count} sezení
                      </span>
                      <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                        {formatCurrency(pkg.price)}
                      </span>
                    </div>
                    <motion.button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchasing === pkg.id}
                      className="btn-primary w-full"
                      whileTap={shouldReduce ? undefined : { scale: 0.97 }}
                    >
                      {purchasing === pkg.id ? "Zpracovávám…" : "Koupit"}
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* My packages */}
          <motion.div
            initial={shouldReduce ? {} : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 28, delay: 0.12 }}
          >
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">Moje balíčky</h2>
            {myPackages === undefined ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Načítám…</p>
            ) : myPackages.length === 0 ? (
              <motion.p
                initial={shouldReduce ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="text-gray-500 dark:text-gray-400 text-sm"
              >
                Zatím žádné zakoupené balíčky.
              </motion.p>
            ) : (
              <div className="space-y-3">
                {myPackages.map((cp, i) => (
                  <motion.div
                    key={cp.id}
                    initial={shouldReduce ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.15 + i * 0.05 }}
                    className="card flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{cp.package_name}</p>
                      {cp.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cp.description}</p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        Zakoupeno: {new Date(cp.purchased_at).toLocaleDateString("cs-CZ")}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{cp.sessions_remaining}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">zbývá sezení</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">z {cp.sessions_total} celkem</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
