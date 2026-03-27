"use client";

import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";

export default function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if push notifications are supported and not yet granted
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;

    const dismissed = localStorage.getItem("pristav-push-dismissed") === "true";
    if (dismissed) return;

    // Show after 2nd login — count stored in auth context; here we use login-count key
    const loginCount = parseInt(localStorage.getItem("pristav-login-count") || "0", 10);
    if (loginCount >= 2) {
      // Delay slightly for smooth UX
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAllow = async () => {
    setVisible(false);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Register push subscription if SW is available
        const sw = await navigator.serviceWorker.ready;
        // VAPID key would go here in production
        console.log("Push permission granted, SW:", sw.scope);
      }
    } catch (e) {
      console.error("Push notification error:", e);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("pristav-push-dismissed", "true");
  };

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-slide-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              Zapněte upozornění
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Dostávejte připomínky termínů přímo do prohlížeče.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAllow}
                className="px-4 py-2 bg-primary-600 text-white text-xs font-medium rounded-lg hover:bg-primary-700 transition-colors min-h-[44px]"
              >
                Povolit
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs hover:text-gray-700 dark:hover:text-gray-200 min-h-[44px]"
              >
                Nyní ne
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            aria-label="Zavřít"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
