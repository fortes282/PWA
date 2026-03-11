"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace(ROLE_DEFAULT_ROUTES[user.role]);
      } else {
        router.replace("/login");
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-4 animate-pulse" />
        <p className="text-gray-500 text-sm">Načítání…</p>
      </div>
    </div>
  );
}
