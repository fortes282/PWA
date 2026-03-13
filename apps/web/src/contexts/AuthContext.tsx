"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setAccessToken } from "@/lib/api";
import { ROLE_DEFAULT_ROUTES } from "@pristav/shared";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: "CLIENT" | "RECEPTION" | "EMPLOYEE" | "ADMIN";
}

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
      await refreshUser();
      setIsLoading(false);
    };
    init();
  }, [refreshUser]);

  // Auto-refresh every 12 minutes
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(refreshUser, 12 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await api.post<{ accessToken: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    setLocalToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
    router.push(ROLE_DEFAULT_ROUTES[data.user.role]);
  };

  const logout = async () => {
    await api.post("/auth/logout", {});
    setUser(null);
    setLocalToken(null);
    setAccessToken(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
