"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import AnimatedLogo from "@/components/ui/AnimatedLogo";
import GlobalSearch from "@/components/GlobalSearch";
import UserPanel from "./UserPanel";
import type { NavSection, UserInfo, Role } from "./types";

export interface DesktopSidebarProps {
  user: UserInfo;
  pathname: string;
  grouped: NavSection[];
  collapsedGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  onLogout: () => void;
}

export default function DesktopSidebar({
  user,
  pathname,
  grouped,
  collapsedGroups,
  onToggleGroup,
  onLogout,
}: DesktopSidebarProps) {
  const shouldReduce = useReducedMotion();

  return (
    <aside
      aria-label="Postranní navigace"
      className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed inset-y-0 left-0"
    >
      {/* Brand */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <AnimatedLogo size={28} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Přístav Radosti</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Neurorehabilitace</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Hlavní navigace" className="flex-1 p-4 space-y-1 overflow-y-auto">
        {(["ADMIN", "RECEPTION", "EMPLOYEE"] as Role[]).includes(user.role) && (
          <div className="mb-3"><GlobalSearch /></div>
        )}
        {grouped.map((section, idx) => {
          const isCollapsible = (["ADMIN", "RECEPTION"] as Role[]).includes(user.role) && !!section.group;
          const isCollapsed = isCollapsible && collapsedGroups.has(section.group!);
          return (
            <div key={section.group ?? `ungrouped-${idx}`}>
              {section.group && (
                isCollapsible ? (
                  <button
                    type="button"
                    onClick={() => onToggleGroup(section.group!)}
                    className="flex items-center justify-between w-full text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-1 px-3 hover:text-gray-600 dark:hover:text-gray-300 transition-colors gap-2"
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
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-1 px-3">
                    {section.group}
                  </p>
                )
              )}
              {!isCollapsed && section.items.map((item) => {
                const isActive = pathname === item.href || (item.matchPrefix ? pathname.startsWith(item.matchPrefix) : pathname.startsWith(item.href + "/"));
                return (
                  <motion.div
                    key={item.href}
                    className="relative"
                    whileHover={shouldReduce ? {} : { x: 2 }}
                    transition={{ duration: 0.15 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute inset-0 bg-primary-50 dark:bg-primary-900/30 rounded-lg"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors min-h-[44px]",
                        isActive
                          ? "text-primary-700 dark:text-primary-400 font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                      )}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className="min-w-0 break-words leading-snug">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User panel */}
      <UserPanel user={user} onLogout={onLogout} />
    </aside>
  );
}
