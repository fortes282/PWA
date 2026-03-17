"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

/**
 * Displays a banner when the browser goes offline.
 * Automatically hides when the connection is restored.
 */
export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine);

    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 3000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [wasOffline]);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
        isOffline
          ? "bg-red-500 text-white"
          : "bg-green-500 text-white"
      }`}
      role="alert"
    >
      {isOffline ? (
        <>
          <WifiOff size={15} />
          <span>Jste offline. Některé funkce nemusejí fungovat.</span>
        </>
      ) : (
        <>
          <span>✓</span>
          <span>Připojení obnoveno.</span>
        </>
      )}
    </div>
  );
}
