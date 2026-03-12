"use client";

import { api } from "@/lib/api";
import useSWR from "swr";
import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";

const fetcher = (url: string) => api.get<any[]>(url);

export default function NotificationBell() {
  const { data: notifications, mutate } = useSWR("/notifications", fetcher, {
    refreshInterval: 30000,
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = (notifications ?? []).filter((n: any) => !n.isRead).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleReadAll = async () => {
    await api.post("/notifications/read-all", {});
    mutate();
  };

  const handleRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`, {});
    mutate();
  };

  const TYPE_LABELS: Record<string, string> = {
    APPOINTMENT_CONFIRMED: "Termín potvrzen",
    APPOINTMENT_REMINDER: "Připomínka termínu",
    APPOINTMENT_CANCELLED: "Termín zrušen",
    WAITLIST_AVAILABLE: "Volný termín",
    INVOICE: "Faktura",
    GENERAL: "Zpráva",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Notifikace"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notifikace</h3>
            {unread > 0 && (
              <button
                onClick={handleReadAll}
                className="text-xs text-primary-600 hover:text-primary-800"
              >
                Označit vše přečteno
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {(notifications ?? []).length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                Žádné notifikace
              </div>
            )}
            {(notifications ?? [])
              .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 20)
              .map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.isRead) handleRead(n.id); }}
                  className={`flex gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.isRead ? "bg-blue-50" : ""
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.isRead ? "bg-blue-500" : "bg-gray-200"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </p>
                    <p className="text-xs text-gray-900 font-medium truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString("cs-CZ", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
