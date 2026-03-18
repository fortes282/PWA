"use client";

import { useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  execute: (url: string, options?: ApiOptions) => Promise<T | null>;
}

/**
 * Reusable API mutation hook with loading/error state.
 */
export function useApiMutation<T = unknown>(): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async (url: string, options?: ApiOptions): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${url}`, {
        method: options?.method || "POST",
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        credentials: "include",
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errBody.message || `HTTP ${res.status}`);
      }

      const json = await res.json() as T;
      setData(json);
      return json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznámá chyba";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, execute };
}

/**
 * Format API errors for display.
 */
export function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Neočekávaná chyba";
}
