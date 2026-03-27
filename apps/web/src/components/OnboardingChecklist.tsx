"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle, Circle, X } from "lucide-react";
import { api } from "@/lib/api";
import useSWR from "swr";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  appointmentListFromApi,
  areNotificationsEnabledForOnboarding,
  isHealthRecordCompleteForOnboarding,
} from "@/lib/onboarding-checklist-logic";

interface ChecklistItem {
  id: string;
  label: string;
  href: string;
  check: () => boolean;
}

const fetcher = (url: string) => api.get<unknown>(url).catch(() => null);

const CONFETTI_EMOJIS = ["🎉", "🌟", "✨", "🎊", "🎈", "💫"];

function ConfettiBurst() {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {CONFETTI_EMOJIS.map((emoji, i) => (
        <motion.span
          key={i}
          className="absolute text-lg select-none"
          style={{
            left: `${15 + i * 14}%`,
            top: "50%",
          }}
          initial={{ opacity: 1, y: 0, scale: 0.5 }}
          animate={{
            opacity: 0,
            y: -60,
            x: (i % 2 === 0 ? 1 : -1) * (10 + i * 5),
            scale: 1.2,
          }}
          transition={{ duration: 1.2, delay: i * 0.08, ease: "easeOut" }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
}

export default function OnboardingChecklist() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [prevCompleted, setPrevCompleted] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const { data: healthRecord } = useSWR(user ? `/health-records/${user.id}` : null, fetcher);
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
      check: () => isHealthRecordCompleteForOnboarding(healthRecord),
    },
    {
      id: "notifications",
      label: "Povolte notifikace o termínech",
      href: "/client/settings",
      check: () => areNotificationsEnabledForOnboarding(notifPrefs),
    },
    {
      id: "booking",
      label: "Rezervujte první termín",
      href: "/client/booking",
      check: () => appointmentListFromApi(appointments).length > 0,
    },
  ];

  const completed = items.filter((i) => i.check()).length;
  const allDone = completed === items.length;
  const percent = (completed / items.length) * 100;

  // Trigger confetti when all items completed
  useEffect(() => {
    if (completed === items.length && prevCompleted < items.length && !dismissed) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 1500);
      return () => clearTimeout(t);
    }
    setPrevCompleted(completed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pristav-onboarding-dismissed", "true");
  };

  return (
    <div
      data-testid="onboarding-checklist"
      className="card border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20 mb-6 relative"
    >
      {showConfetti && <ConfettiBurst />}

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Vítejte! 👋</h3>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Dokončete nastavení pro lepší zážitek ({completed} ze {items.length})
          </p>
        </div>
        <motion.button
          onClick={handleDismiss}
          whileTap={shouldReduceMotion ? {} : { scale: 0.85 }}
          className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          aria-label="Zavřít"
        >
          <X size={16} />
        </motion.button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
        <motion.div
          className="h-full bg-primary-500 rounded-full"
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
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
              <AnimatePresence mode="wait">
                {done ? (
                  <motion.span
                    key="done"
                    initial={shouldReduceMotion ? {} : { scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="flex-shrink-0"
                  >
                    <CheckCircle size={18} className="text-green-500" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="pending"
                    initial={shouldReduceMotion ? {} : { scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="flex-shrink-0"
                  >
                    <Circle size={18} className="text-gray-300 dark:text-gray-600" />
                  </motion.span>
                )}
              </AnimatePresence>
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
