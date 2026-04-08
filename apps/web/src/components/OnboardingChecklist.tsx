"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Simplified onboarding checklist — only asks the user to enable push notifications.
 * Once push permission is granted (or was already granted), the card never shows again.
 */
export default function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [requesting, setRequesting] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Check if notifications API is available
    if (!("Notification" in window)) {
      setPermissionState("unsupported");
      return;
    }

    setPermissionState(Notification.permission);

    // Only show the card if permission has not been granted and user hasn't dismissed
    if (Notification.permission !== "granted") {
      const d = localStorage.getItem("pristav-onboarding-dismissed");
      if (!d) setDismissed(false);
    }
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      setPermissionState(result);
      if (result === "granted") {
        // Register push subscription if service worker is available
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          }).catch(() => {
            // Subscription may fail but permission was granted — still hide the card
          });
        }
        setDismissed(true);
        localStorage.setItem("pristav-onboarding-dismissed", "true");
      }
    } catch {
      // Permission request failed — keep card visible
    } finally {
      setRequesting(false);
    }
  }, [requesting]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem("pristav-onboarding-dismissed", "true");
  }, []);

  // Don't render if already granted, unsupported, or dismissed
  if (dismissed || permissionState === "granted" || permissionState === "unsupported") {
    return null;
  }

  return (
    <motion.div
      data-testid="onboarding-checklist"
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="card border-2 border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/20 mb-6 relative"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-primary dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Povolit notifikace</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Budeme vás informovat o termínech a novinkach.
            </p>
          </div>
        </div>
        <motion.button
          onClick={handleDismiss}
          whileTap={shouldReduceMotion ? {} : { scale: 0.85 }}
          className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          aria-label="Zavrit"
        >
          <X size={16} />
        </motion.button>
      </div>

      <motion.button
        onClick={handleEnableNotifications}
        disabled={requesting}
        whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
        className="btn-primary w-full text-sm"
      >
        {requesting ? "Povolování..." : "Povolit notifikace"}
      </motion.button>
    </motion.div>
  );
}
