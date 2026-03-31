"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAccessToken } from "@/lib/api";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";
import { useRouter } from "next/navigation";

const API_BASE = "/api";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";
  avatarUrl?: string | null;
}

export interface TwoFARequired {
  requires2FA: true;
  pendingToken: string;
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void | TwoFARequired>;
  complete2FA: (pendingToken: string, totpCode: string) => Promise<void>;
  useBackupCode: (pendingToken: string, backupCode: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setLocalToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        setUser(null);
        setLocalToken(null);
        setAccessToken(null);
        return;
      }
      const data = await res.json();
      setLocalToken(data.accessToken);
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch {
      setUser(null);
      setLocalToken(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Cookie-based refresh is the only persisted auth mechanism.
      await refreshUser();
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  // Auto-refresh every 12 minutes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      await refreshUser();
    }, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const login = async (email: string, password: string): Promise<void | TwoFARequired> => {
    const data = await api.post<{ accessToken: string; user: AuthUser } | TwoFARequired>("/auth/login", {
      email,
      password,
    });
    if ("requires2FA" in data && data.requires2FA) {
      // Return pending state — caller handles 2FA step
      return data;
    }
    const authData = data as { accessToken: string; user: AuthUser };
    setLocalToken(authData.accessToken);
    setAccessToken(authData.accessToken);
    setUser(authData.user);
    // Increment login count for push notification prompt
    try {
      const lc = parseInt(localStorage.getItem("pristav-login-count") || "0", 10);
      localStorage.setItem("pristav-login-count", String(lc + 1));
    } catch { /* ignore */ }
    router.push(ROLE_DEFAULT_ROUTES[authData.user.role]);
  };

  const complete2FA = async (pendingToken: string, totpCode: string): Promise<void> => {
    const data = await api.post<{ accessToken: string; user: AuthUser }>("/auth/2fa/verify", {
      pendingToken,
      token: totpCode,
    });
    setLocalToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    router.push(ROLE_DEFAULT_ROUTES[data.user.role]);
  };

  const useBackupCode = async (pendingToken: string, backupCode: string): Promise<void> => {
    const data = await api.post<{ accessToken: string; user: AuthUser }>("/auth/2fa/use-backup", {
      pendingToken,
      backupCode,
    });
    setLocalToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    router.push(ROLE_DEFAULT_ROUTES[data.user.role]);
  };

  const logout = async () => {
    try { await api.post("/auth/logout", {}); } catch { /* best-effort */ }
    setUser(null);
    setLocalToken(null);
    setAccessToken(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, complete2FA, useBackupCode, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
