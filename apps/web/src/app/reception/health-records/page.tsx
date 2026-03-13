"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { Heart, Search, ChevronRight, AlertCircle } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function HealthRecordsList() {
  const { data: records } = useSWR("/health-records", fetcher);
  const { data: clients } = useSWR("/users?role=CLIENT", fetcher);
  const [search, setSearch] = useState("");

  // Clients that don't have a health record yet
  const clientsWithRecord = new Set((records ?? []).map((r: any) => r.clientId));
  const clientsWithoutRecord = (clients ?? []).filter(
    (c: any) => !clientsWithRecord.has(c.id)
  );

  const filteredRecords = (records ?? []).filter((r: any) => {
    const q = search.toLowerCase();
    return (
      (r.clientName ?? "").toLowerCase().includes(q) ||
      (r.clientEmail ?? "").toLowerCase().includes(q) ||
      (r.primaryDiagnosis ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <RouteGuard allowedRoles={["RECEPTION", "ADMIN", "EMPLOYEE"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <Heart size={20} className="text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">Zdravotní záznamy</h1>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Hledat klienta nebo diagnózu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Clients without records */}
          {clientsWithoutRecord.length > 0 && !search && (
            <div className="card mb-6 border-orange-200 bg-orange-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={16} className="text-orange-500" />
                <h2 className="font-semibold text-orange-800">
                  Klienti bez záznamu ({clientsWithoutRecord.length})
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {clientsWithoutRecord.map((c: any) => (
                  <a
                    key={c.id}
                    href={`/reception/health-records/${c.id}`}
                    className="text-xs px-2 py-1 bg-white rounded border border-orange-200 text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    {c.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Records list */}
          <div className="space-y-3">
            {filteredRecords.length === 0 && (
              <div className="card text-center text-gray-500 py-12">
                {search ? "Žádný záznam neodpovídá hledání." : "Zatím nejsou žádné zdravotní záznamy."}
              </div>
            )}
            {filteredRecords.map((r: any) => (
              <a
                key={r.id}
                href={`/reception/health-records/${r.clientId}`}
                className="card flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Heart size={18} className="text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{r.clientName}</p>
                  <p className="text-xs text-gray-500">{r.clientEmail}</p>
                  {r.primaryDiagnosis && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-medium">Diagnóza:</span> {r.primaryDiagnosis}
                    </p>
                  )}
                  {r.allergies && (
                    <p className="text-xs text-red-600 mt-0.5">
                      <span className="font-medium">Alergie:</span> {r.allergies}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">
                    Aktualizováno {formatDate(r.updatedAt)}
                  </p>
                  <ChevronRight size={16} className="text-gray-400 ml-auto mt-1" />
                </div>
              </a>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
