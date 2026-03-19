"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle, Circle, X } from "lucide-react";
import { api } from "@/lib/api";
import useSWR from "swr";

interface ChecklistItem {
  id: string;
  label: string;
  href: string;
  check: () => boolean;
}

const fetcher = (url: string) => api.get<any>(url).catch(() => null);

export default function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true);

  const { data: healthRecord } = useSWR("/health-record", fetcher);
  const { data: appointments } = useSWR("/appointments?limit=1", fetcher);
  const { data: notifPrefs } = useSWR("/notification-preferences", fetcher);

  useEffect(() => {
    const d = localStorage.getItem("pristav-onboarding-dismissed");
    if (!d) setDismissed(false);
  }, []);

  const items: ChecklistItem[] = [
    {
      id: "health",
      label: "Vyplňte zdravotní kartu",
      href: "/client/health-record",
      check: () => !!(healthRecord && (healthRecord.allergies || healthRecord.primaryDiagnosis)),
    },
    {
      id: "notifications",
      label: "Povolte notifikace o termínech",
      href: "/client/settings",
      check: () => !!(notifPrefs && (notifPrefs.emailEnabled || notifPrefs.smsEnabled || notifPrefs.pushEnabled)),
    },
    {
      id: "booking",
      label: "Rezervujte první termín",
      href: "/client/booking",
      check: () => !!(appointments && (Array.isArray(appointments) ? appointments.length > 0 : false)),
    },
  ];

  const completed = items.filter((i) => i.check()).length;
  const allDone = completed === items.length;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pristav-onboarding-dismissed", "true");
  };

  return (
    <div className="card border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20 mb-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Vítejte! 👋</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Dokončete nastavení pro lepší zážitek ({completed} ze {items.length})
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          aria-label="Zavřít"
        >
          <X size={16} />
        </button>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${(completed / items.length) * 100}%` }}
        />
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const done = item.check();
          return (
            <Link
              key={item.id}
              href={item.href}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-primary-100/50 dark:hover:bg-primary-900/30 transition-colors min-h-[44px]"
            >
              {done ? (
                <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
              ) : (
                <Circle size={18} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              )}
              <span
                className={`text-sm ${
                  done
                    ? "text-gray-500 dark:text-gray-500 line-through"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
