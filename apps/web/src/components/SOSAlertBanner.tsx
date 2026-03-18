"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { api } from "@/lib/api";

interface SOSLog {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  created_at: string;
  ip_address?: string;
}

export default function SOSAlertBanner() {
  const [alerts, setAlerts] = useState<SOSLog[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await api.get<{ logs: SOSLog[] }>("/emergency/sos-log?limit=5");
        if (res.logs?.length) {
          // Show only activations from last 24h
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const recent = res.logs.filter(
            (l) => new Date(l.created_at).getTime() > cutoff
          );
          setAlerts(recent);
        }
      } catch { /* ignore */ }
    };
    fetchAlerts();
    const timer = setInterval(fetchAlerts, 60_000);
    return () => clearInterval(timer);
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (!visible.length) return null;

  return (
    <div className="space-y-2 mb-4">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          role="alert"
        >
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">
              Klient {alert.user_name ?? `#${alert.user_id}`} aktivoval SOS
            </p>
            <p className="text-xs opacity-80">
              {new Date(alert.created_at).toLocaleString("cs-CZ")}
              {alert.user_email && ` — ${alert.user_email}`}
            </p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 flex-shrink-0"
            aria-label="Skrýt upozornění"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
