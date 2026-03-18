"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => api.get<any>(url);

export default function ClientPackagesPage() {
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Balíčky sezení</h1>

          {message && (
            <div className="card mb-4 bg-green-50 border-green-200">
              <p className="text-green-700 text-sm">{message}</p>
            </div>
          )}

          {/* Available packages */}
          <div className="mb-8">
            <h2 className="font-semibold text-gray-800 mb-3">Dostupné balíčky</h2>
            {packages === undefined ? (
              <p className="text-gray-400 text-sm">Načítám…</p>
            ) : packages.length === 0 ? (
              <p className="text-gray-400 text-sm">Momentálně nejsou k dispozici žádné balíčky.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="card flex flex-col gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{pkg.name}</p>
                      {pkg.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{pkg.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {pkg.sessionsCount ?? pkg.sessions_count} sezení
                      </span>
                      <span className="text-lg font-bold text-primary-600">
                        {formatCurrency(pkg.price)}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={purchasing === pkg.id}
                      className="btn-primary w-full"
                    >
                      {purchasing === pkg.id ? "Zpracovávám…" : "Koupit"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My packages */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Moje balíčky</h2>
            {myPackages === undefined ? (
              <p className="text-gray-400 text-sm">Načítám…</p>
            ) : myPackages.length === 0 ? (
              <p className="text-gray-400 text-sm">Zatím žádné zakoupené balíčky.</p>
            ) : (
              <div className="space-y-3">
                {myPackages.map((cp) => (
                  <div key={cp.id} className="card flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{cp.package_name}</p>
                      {cp.description && (
                        <p className="text-sm text-gray-500 mt-0.5">{cp.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Zakoupeno: {new Date(cp.purchased_at).toLocaleDateString("cs-CZ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary-600">{cp.sessions_remaining}</p>
                      <p className="text-xs text-gray-500">zbývá sezení</p>
                      <p className="text-xs text-gray-400">
                        z {cp.sessions_total} celkem
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
