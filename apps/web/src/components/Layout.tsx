"use client";

import { useAuth } from "@/contexts/AuthContext";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useMemo, useCallback } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import Breadcrumbs from "@/components/Breadcrumbs";
import PageTransition from "@/components/PageTransition";
import SOSButton from "@/components/SOSButton";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";

import { DesktopSidebar } from "@/components/navigation";
import { MobileHeader } from "@/components/navigation";
import { ClientTabBar } from "@/components/navigation";
import {
  NAV_ITEMS,
  CLIENT_TABS,
  CLIENT_MORE_ITEM_HREFS,
  TAB_H,
  groupItems,
} from "@/components/navigation";

// ── Component ──────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const shortcuts = useMemo(
    () => [
      {
        key: "k",
        meta: true,
        handler: () => {
          const input = document.querySelector<HTMLInputElement>('[placeholder="Hledat..."]');
          input?.focus();
        },
      },
      {
        key: "Escape",
        global: true,
        handler: () => {
          setMobileOpen(false);
          setMoreOpen(false);
        },
      },
    ],
    []
  );
  useKeyboardShortcuts(shortcuts);

  if (!user) return null;

  const myNavItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const grouped = groupItems(myNavItems);
  const isClient = user.role === "CLIENT";

  const clientMoreItems = isClient
    ? myNavItems.filter((item) => CLIENT_MORE_ITEM_HREFS.includes(item.href))
    : [];

  const isMoreRouteActive = CLIENT_MORE_ITEM_HREFS.some((href) =>
    pathname === href || pathname.startsWith(href + "/")
  );

  return (
    // h-[100dvh] + overflow-hidden = fixed shell, only <main> scrolls
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-950 overflow-hidden">

      {/* ═══ Desktop Sidebar ═══ */}
      <DesktopSidebar
        user={user}
        pathname={pathname}
        grouped={grouped}
        collapsedGroups={collapsedGroups}
        onToggleGroup={toggleGroup}
        onLogout={logout}
      />

      {/* ═══ Main content column ═══ */}
      <div
        className={cn("flex-1 flex flex-col min-w-0 overflow-hidden md:ml-64")}
        style={isClient ? { paddingBottom: `calc(${TAB_H}px + env(safe-area-inset-bottom, 0px))` } : undefined}
      >
        {/* ── Mobile header + drawer ── */}
        <MobileHeader
          user={user}
          pathname={pathname}
          isClient={isClient}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
          grouped={grouped}
          collapsedGroups={collapsedGroups}
          onToggleGroup={toggleGroup}
          onLogout={logout}
        />

        {/* ── Page content ── */}
        <main
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-6"
          tabIndex={-1}
        >
          <Breadcrumbs />
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* ═══ CLIENT Mobile Bottom Tab Bar ═══ */}
      {isClient && (
        <ClientTabBar
          pathname={pathname}
          clientTabs={CLIENT_TABS}
          clientMoreItems={clientMoreItems}
          moreOpen={moreOpen}
          onMoreOpenChange={setMoreOpen}
          isMoreRouteActive={isMoreRouteActive}
          onLogout={logout}
        />
      )}

      <SOSButton aboveTabBar={isClient} />
      <PWAInstallBanner />
      <PushNotificationPrompt />
    </div>
  );
}
