"use client";

import Image from "next/image";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";
import { getInitials } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import type { UserInfo } from "./types";

export interface UserPanelProps {
  user: UserInfo;
  onLogout: () => void;
}

export default function UserPanel({ user, onLogout }: UserPanelProps) {
  return (
    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden bg-primary-100 dark:bg-primary-900/40 flex-shrink-0">
          {user.avatarUrl ? (
            <Image src={`/api${user.avatarUrl}`} alt={user.name} width={32} height={32} unoptimized className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary-700 dark:text-primary-400 text-xs font-bold">{getInitials(user.name)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <NotificationBell />
        <ThemeToggle />
      </div>
      <Link href="/settings" className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2 min-h-[44px]">
        <Settings size={14} />
        Nastavení
      </Link>
      <button onClick={onLogout} className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 w-full min-h-[44px]">
        <LogOut size={14} />
        Odhlásit se
      </button>
    </div>
  );
}
