"use client";

import RouteGuard from "@/components/RouteGuard";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import useSWR from "swr";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

const TYPE_LABELS: Record<string, string> = {
  APPOINTMENT_CONFIRMED: "Termín potvrzen",
  APPOINTMENT_REMINDER: "Připomínka termínu",
  APPOINTMENT_CANCELLED: "Termín zrušen",
  WAITLIST_AVAILABLE: "Volný termín",
  INVOICE: "Faktura",
  GENERAL: "Zpráva",
};

const TYPE_COLORS: Record<string, string> = {
  APPOINTMENT_CONFIRMED: "bg-green-100 text-green-700",
  APPOINTMENT_REMINDER: "bg-yellow-100 text-yellow-700",
  APPOINTMENT_CANCELLED: "bg-red-100 text-red-700",
  WAITLIST_AVAILABLE: "bg-blue-100 text-blue-700",
  INVOICE: "bg-purple-100 text-purple-700",
  GENERAL: "bg-gray-100 text-gray-700",
};

export default function NotificationsPage() {
  const { data: notifications, mutate } = useSWR("/notifications", fetcher, {
    refreshInterval: 30000,
  });

  const unread = (notifications ?? []).filter((n: any) => !n.isRead);
  const sorted = [...(notifications ?? [])].sort(
    (a: any, b: any) => b.createdAt.localeCompare(a.createdAt)
  );

  const handleReadAll = async () => {
    await api.post("/notifications/read-all", {});
    mutate();
  };

  const handleRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`, {});
    mutate();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/notifications/${id}`);
    mutate();
  };

  return (
    <RouteGuard allowedRoles={["CLIENT", "RECEPTION", "EMPLOYEE", "ADMIN"]}>
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Notifikace</h1>
              {unread.length > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unread.length}
                </span>
              )}
            </div>
            {unread.length > 0 && (
              <button
                onClick={handleReadAll}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <CheckCheck size={16} />
                Označit vše přečteno
              </button>
            )}
          </div>

          {sorted.length === 0 && (
            <div className="card text-center py-12">
              <Bell size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">Žádné notifikace</p>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((n: any) => (
              <div
                key={n.id}
                className={`card flex gap-4 transition-colors ${
                  !n.isRead ? "border-blue-200 bg-blue-50" : ""
                }`}
              >
                {/* Unread dot */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className={`w-2 h-2 rounded-full mt-1 ${
                      !n.isRead ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          TYPE_COLORS[n.type] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {TYPE_LABELS[n.type] ?? n.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(n.createdAt).toLocaleDateString("cs-CZ", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!n.isRead && (
                        <button
                          onClick={() => handleRead(n.id)}
                          title="Označit přečteno"
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        title="Smazat"
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    </RouteGuard>
  );
}
