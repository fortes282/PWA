"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import useSWR from "swr";
import { FileText } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function ClientReports() {
  const { data: reports } = useSWR("/medical-reports", fetcher);

  return (
    <RouteGuard allowedRoles={["CLIENT"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Terapeutické zprávy</h1>

          <div className="space-y-4">
            {reports?.map((r: any) => (
              <div key={r.id} className="card">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{r.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(r.createdAt)}</p>
                    {r.diagnosis && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">Diagnóza:</span> {r.diagnosis}
                      </p>
                    )}
                    {r.recommendations && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Doporučení:</span> {r.recommendations}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {reports?.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">Žádné zprávy</p>
            )}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
