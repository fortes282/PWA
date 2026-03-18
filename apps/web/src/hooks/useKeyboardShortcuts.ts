"use client";

import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  /** If true, preventDefault even if no modifier is pressed */
  global?: boolean;
}

/**
 * Register keyboard shortcuts. Ignores events from input/textarea/select.
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input (unless global)
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      for (const s of shortcuts) {
        const metaOrCtrl = s.meta ? (e.metaKey || e.ctrlKey) : s.ctrl ? e.ctrlKey : false;
        const shiftOk = s.shift ? e.shiftKey : !e.shiftKey;
        const keyOk = e.key.toLowerCase() === s.key.toLowerCase();

        if (keyOk && metaOrCtrl && shiftOk) {
          e.preventDefault();
          s.handler();
          return;
        }

        // Non-modifier shortcuts (like Escape) — skip if in input unless global
        if (!s.meta && !s.ctrl && keyOk && shiftOk) {
          if (isInput && !s.global) continue;
          s.handler();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
