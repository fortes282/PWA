"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Settings, LogOut } from "lucide-react";
import { haptics } from "@/lib/haptics";
import type { NavItem, TabItem } from "./types";
import { TAB_H } from "./nav-data";

export interface ClientTabBarProps {
  pathname: string;
  clientTabs: TabItem[];
  clientMoreItems: NavItem[];
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  isMoreRouteActive: boolean;
  onLogout: () => void;
}

export default function ClientTabBar({
  pathname,
  clientTabs,
  clientMoreItems,
  moreOpen,
  onMoreOpenChange,
  isMoreRouteActive,
  onLogout,
}: ClientTabBarProps) {
  const shouldReduce = useReducedMotion();
  const isTabActive = (tab: TabItem) => {
    if (tab.href === "/client") return pathname === "/client";
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix);
    return false;
  };

  return (
    <>
      <nav
        aria-label="Mobilní navigace"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-t-3xl shadow-[0_-4px_40px_rgba(22,28,36,0.05)] z-[55]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-stretch" style={{ height: `${TAB_H}px` }}>
          {clientTabs.map((tab) => {
            if (tab.href === "#more") {
              const active = moreOpen || isMoreRouteActive;
              return (
                <button
                  key="more"
                  onClick={() => { haptics.light(); onMoreOpenChange(!moreOpen); }}
                  className="flex-1 flex flex-col items-center justify-center gap-1"
                >
                  <motion.div
                    className={cn(
                      "rounded-2xl px-3 py-1.5 flex items-center justify-center transition-colors",
                      active ? "bg-primary-100 dark:bg-primary-900/40" : ""
                    )}
                    whileTap={shouldReduce ? undefined : { scale: 0.82 }}
                    transition={shouldReduce ? undefined : { type: "spring", stiffness: 500, damping: 22 }}
                  >
                    <span className={active ? "text-primary dark:text-primary-300" : "text-slate-400 dark:text-gray-500"}>
                      {tab.icon}
                    </span>
                  </motion.div>
                  <span className={cn(
                    "text-[10px] leading-tight text-center max-w-[4.25rem] line-clamp-2 px-0.5",
                    active ? "text-primary dark:text-primary-300 font-medium" : "text-slate-400 dark:text-gray-400"
                  )}>
                    {tab.label}
                  </span>
                </button>
              );
            }
            const active = isTabActive(tab);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => { if (!active) haptics.light(); onMoreOpenChange(false); }}
                className="flex-1 flex flex-col items-center justify-center gap-1"
              >
                <motion.div
                  className={cn(
                    "rounded-2xl px-3 py-1.5 flex items-center justify-center transition-colors",
                    active ? "bg-primary-100 dark:bg-primary-900/40" : ""
                  )}
                  whileTap={shouldReduce ? undefined : { scale: 0.82 }}
                  transition={shouldReduce ? undefined : { type: "spring", stiffness: 500, damping: 22 }}
                >
                  <span className={active ? "text-primary dark:text-primary-300" : "text-slate-400 dark:text-gray-500"}>
                    {tab.icon}
                  </span>
                </motion.div>
                <span className={cn(
                  "text-[10px] leading-tight text-center max-w-[4.25rem] line-clamp-2 px-0.5",
                  active ? "text-primary dark:text-primary-300 font-medium" : "text-slate-400 dark:text-gray-400"
                )}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* "Více" bottom sheet */}
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div
              className="md:hidden fixed inset-0 bg-black/25 backdrop-blur-sm z-[45]"
              style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => onMoreOpenChange(false)}
            />
            <motion.div
              data-testid="more-sheet"
              className="md:hidden fixed left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-t-2xl shadow-atmospheric-lg border-t border-on-surface/5 max-h-[60vh] overflow-y-auto"
              style={{ bottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` }}
              initial={shouldReduce ? { opacity: 0 } : { y: "100%" }}
              animate={shouldReduce ? { opacity: 1 } : { y: 0 }}
              exit={shouldReduce ? { opacity: 0 } : { y: "100%" }}
              transition={shouldReduce ? { duration: 0.15 } : { type: "spring", stiffness: 320, damping: 32, mass: 0.85 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80) { haptics.light(); onMoreOpenChange(false); } }}
            >
              <div className="p-4">
                <div className="w-10 h-1 bg-on-surface/10 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                <div className="space-y-1">
                  {clientMoreItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onMoreOpenChange(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] min-h-[52px]",
                        pathname === item.href || pathname.startsWith(item.href + "/")
                          ? "bg-surface-container-low dark:bg-primary-900/30 text-primary dark:text-primary-300 font-medium"
                          : "text-on-surface-variant dark:text-gray-300 active:bg-surface-container-low/50 dark:active:bg-gray-800"
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="min-w-0 break-words leading-snug">{item.label}</span>
                    </Link>
                  ))}
                  <div className="border-t border-on-surface/5 my-2" />
                  <Link
                    href="/settings"
                    onClick={() => onMoreOpenChange(false)}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] text-on-surface-variant dark:text-gray-300 active:bg-surface-container-low/50 dark:active:bg-gray-800 min-h-[52px]"
                  >
                    <Settings size={18} />
                    Nastavení účtu
                  </Link>
                  <button
                    onClick={() => { onMoreOpenChange(false); onLogout(); }}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] text-red-500 w-full min-h-[52px] active:bg-red-50 dark:active:bg-red-950/20"
                  >
                    <LogOut size={18} />
                    Odhlásit se
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
