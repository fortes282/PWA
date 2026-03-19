"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import useSWR from "swr";
import { useState } from "react";
import { FileText, Search, Download } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const fetcher = (url: string) => api.get<any[]>(url);
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function AdminMedicalReports() {
  const { data: reports } = useSWR("/medical-reports", fetcher);
  const { data: users } = useSWR("/users", fetcher);

  const [search, setSearch] = useState("");

  const userMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u.name]));

  const filtered = (reports ?? []).filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.diagnosis?.toLowerCase().includes(q) ||
      userMap[r.clientId]?.toLowerCase().includes(q) ||
      userMap[r.employeeId]?.toLowerCase().includes(q)
    );
  });

  // Sort newest first
  const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <RouteGuard allowedRoles={["ADMIN"]}>
      <Layout>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Lékařské zprávy</h1>
            <span className="text-sm text-gray-500">{sorted.length} zpráv</span>
          </div>

          {/* Search */}
          <div className="card mb-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Hledat dle nadpisu, diagnózy, klienta nebo terapeuta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
          </div>

          {/* Reports list */}
          {sorted.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} className="text-gray-300" />}
              title="Žádné lékařské zprávy"
              description={search ? "Žádné zprávy neodpovídají hledání." : "Zatím nebyly vytvořeny žádné lékařské zprávy."}
            />
          ) : (
            <div className="space-y-3">
              {sorted.map((r: any) => (
                <div key={r.id} className="card hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{r.title}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                          <span>
                            <span className="font-medium text-gray-600">Klient:</span>{" "}
                            {userMap[r.clientId] ?? `#${r.clientId}`}
                          </span>
                          <span>
                            <span className="font-medium text-gray-600">Terapeut:</span>{" "}
                            {userMap[r.employeeId] ?? `#${r.employeeId}`}
                          </span>
                          <span>{formatDateTime(r.createdAt)}</span>
                        </div>
                        {r.diagnosis && (
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="font-medium">Diagnóza:</span> {r.diagnosis}
                          </p>
                        )}
                        {r.content && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.content}</p>
                        )}
                      </div>
                    </div>

                    {/* Download buttons */}
                    <div className="flex gap-2 flex-shrink-0">
                      {r.pdfPath && (
                        <a
                          href={`${API_BASE}/pdf/medical/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1.5 rounded-lg transition"
                          title="Stáhnout PDF"
                        >
                          <Download size={12} /> PDF
                        </a>
                      )}
                      {r.docxPath && (
                        <a
                          href={`${API_BASE}/pdf/docx/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1.5 rounded-lg transition"
                          title="Stáhnout DOCX"
                        >
                          <Download size={12} /> DOCX
                        </a>
                      )}
                      {!r.pdfPath && !r.docxPath && (
                        <span className="text-xs text-gray-500 py-1">Bez souboru</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </RouteGuard>
  );
}
