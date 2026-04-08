"use client";

import Image from "next/image";
import Link from "next/link";
import { cn, getInitials } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Menu, X, Settings, LogOut, ChevronDown } from "lucide-react";
import AnimatedLogo from "@/components/ui/AnimatedLogo";
import GlobalSearch from "@/components/GlobalSearch";
import NotificationBell from "@/components/NotificationBell";
import type { NavSection, UserInfo, Role } from "./types";

export interface MobileHeaderProps {
  user: UserInfo;
  pathname: string;
  isClient: boolean;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  grouped: NavSection[];
  collapsedGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  onLogout: () => void;
}

export default function MobileHeader({
  user,
  pathname,
  isClient,
  mobileOpen,
  onMobileOpenChange,
  grouped,
  collapsedGroups,
  onToggleGroup,
  onLogout,
}: MobileHeaderProps) {
  const shouldReduce = useReducedMotion();

  return (
    <>
      {/* ── Mobile header (safe-area-top: viewport-fit=cover + translucent status bar) ── */}
      <header className="md:hidden flex-shrink-0 bg-surface/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-on-surface/5 safe-area-top">
        <div className="h-14 flex items-center px-3 gap-2">
          {/* Hamburger (non-CLIENT) */}
          {!isClient && (
            <button
              onClick={() => onMobileOpenChange(true)}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-on-surface-variant dark:text-gray-400 active:bg-surface-container-low dark:active:bg-gray-800 flex-shrink-0 -ml-1"
              aria-label="Otevřít menu"
              aria-expanded={mobileOpen}
            >
              <Menu size={30} strokeWidth={2.25} />
            </button>
          )}

          {/* Brand */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <AnimatedLogo size={20} />
            </div>
            <span className="font-bold text-primary dark:text-primary-100 text-sm tracking-tighter">Přístav Radosti</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center flex-shrink-0">
            <NotificationBell size="lg" />
          </div>
        </div>
      </header>

      {/* ═══ Non-CLIENT Mobile Drawer (left slide-in) ═══ */}
      {!isClient && (
        <AnimatePresence>
          {mobileOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[59]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => onMobileOpenChange(false)}
              />

              {/* Drawer panel */}
              <motion.aside
                aria-label="Mobilní navigace"
                className="md:hidden fixed inset-y-0 left-0 w-[288px] bg-white dark:bg-gray-900 z-[60] flex flex-col shadow-atmospheric-lg rounded-r-2xl"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.85 }}
              >
                {/* Drawer header — primary with user info */}
                <div className="relative bg-gradient-to-br from-primary to-primary-800 px-5 pb-5 pt-10 safe-area-top flex-shrink-0 rounded-tr-2xl">
                  <button
                    onClick={() => onMobileOpenChange(false)}
                    className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm"
                    aria-label="Zavřít menu"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center overflow-hidden flex-shrink-0 backdrop-blur-sm">
                      {user.avatarUrl ? (
                        <Image src={`/api${user.avatarUrl}`} alt={user.name} width={48} height={48} unoptimized className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">{getInitials(user.name)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-base truncate">{user.name}</p>
                      <p className="text-white/60 text-xs truncate">{user.email}</p>
                    </div>
                  </div>
                </div>

                {(["ADMIN", "RECEPTION", "EMPLOYEE"] as Role[]).includes(user.role) && (
                  <div className="flex-shrink-0 px-4 py-3 border-b border-on-surface/5 bg-white dark:bg-gray-900">
                    <GlobalSearch />
                  </div>
                )}

                {/* Nav items */}
                <nav className="flex-1 overflow-y-auto py-2">
                  {grouped.map((section, idx) => {
                    const isCollapsible = (["ADMIN", "RECEPTION"] as Role[]).includes(user.role) && !!section.group;
                    const isCollapsed = isCollapsible && collapsedGroups.has(section.group!);
                    return (
                      <div key={section.group ?? `d-${idx}`}>
                        {section.group && (
                          isCollapsible ? (
                            <button
                              type="button"
                              onClick={() => onToggleGroup(section.group!)}
                              className="flex items-center justify-between w-full px-5 py-2 text-[11px] font-semibold text-on-surface-variant/60 dark:text-gray-500 uppercase tracking-wider gap-2"
                            >
                              <span className="min-w-0 break-words text-left">{section.group}</span>
                              <motion.span
                                animate={shouldReduce ? {} : { rotate: isCollapsed ? -90 : 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ display: "inline-flex" }}
                              >
                                <ChevronDown size={12} />
                              </motion.span>
                            </button>
                          ) : (
                            <p className="px-5 py-2 text-[11px] font-semibold text-on-surface-variant/60 dark:text-gray-500 uppercase tracking-wider">
                              {section.group}
                            </p>
                          )
                        )}
                        {!isCollapsed && section.items.map((item) => {
                          const isActive = pathname === item.href || (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname.startsWith(item.href + "/"));
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => onMobileOpenChange(false)}
                              className={cn(
                                "flex items-center gap-4 px-5 py-3.5 text-[15px] min-h-[52px] transition-colors",
                                isActive
                                  ? "bg-surface-container-low dark:bg-primary-900/20 text-primary dark:text-primary-300 font-medium border-l-[3px] border-primary"
                                  : "text-on-surface-variant dark:text-gray-300 active:bg-surface-container-low/50 dark:active:bg-gray-800 border-l-[3px] border-transparent"
                              )}
                            >
                              <span className={cn("shrink-0", isActive ? "text-primary dark:text-primary-300" : "text-on-surface-variant/50 dark:text-gray-500")}>
                                {item.icon}
                              </span>
                              <span className="min-w-0 break-words leading-snug">{item.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </nav>

                {/* Drawer footer */}
                <div className="flex-shrink-0 border-t border-on-surface/5 p-4 safe-area-bottom space-y-1">
                  <div className="flex items-center px-1 mb-2">
                    <NotificationBell />
                  </div>
                  <Link
                    href="/settings"
                    onClick={() => onMobileOpenChange(false)}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-[15px] text-on-surface-variant dark:text-gray-300 active:bg-surface-container-low dark:active:bg-gray-800 min-h-[52px]"
                  >
                    <Settings size={18} className="text-on-surface-variant/50" />
                    Nastavení
                  </Link>
                  <button
                    onClick={() => { onMobileOpenChange(false); onLogout(); }}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl text-[15px] text-red-500 w-full min-h-[52px] active:bg-red-50 dark:active:bg-red-950/20"
                  >
                    <LogOut size={18} />
                    Odhlásit se
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}
    </>
  );
}
