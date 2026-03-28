"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
  info: "bg-blue-600",
  warning: "bg-yellow-500 text-gray-900",
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_DURATION = 4000;

function ToastItem({ toast: t, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [t.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.93 }}
      animate={shouldReduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.95 }}
      transition={shouldReduce ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
      className={`pointer-events-auto overflow-hidden rounded-lg shadow-lg text-white text-sm max-w-sm ${TYPE_STYLES[t.type]}`}
      role="alert"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="font-bold">{TYPE_ICONS[t.type]}</span>
        <span className="flex-1">{t.message}</span>
        <button
          onClick={() => onDismiss(t.id)}
          className="opacity-70 hover:opacity-100 ml-2"
          aria-label="Zavřít"
        >
          ×
        </button>
      </div>
      {/* Progress bar — shrinks from 100% to 0 over TOAST_DURATION */}
      <motion.div
        className="h-0.5 bg-white/40"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: TOAST_DURATION / 1000, ease: "linear" }}
        style={{ transformOrigin: "left" }}
      />
    </motion.div>
  );
}
