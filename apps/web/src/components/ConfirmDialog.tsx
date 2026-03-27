"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Potvrdit",
  cancelLabel = "Zrušit",
  destructive = false,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            className="bg-white dark:bg-gray-900 dialog-surface-sm p-6"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {/* Drag handle indicator */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" aria-hidden="true" />
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 sm:gap-4 min-w-0 pr-6">
              {destructive && (
                <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2 dialog-text">{title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm dialog-text">{message}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 mt-6 sm:flex-row sm:justify-end sm:flex-wrap">
              <button
                onClick={onCancel}
                disabled={loading}
                className="btn-secondary"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={destructive ? "btn-danger" : "btn-primary"}
              >
                {loading ? "Zpracovávám…" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ConfirmDialog;
