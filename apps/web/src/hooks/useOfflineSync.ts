"use client";

import { useEffect, useState, useCallback } from "react";
import { enqueueAction, getAllQueued, type OfflineAction } from "@/lib/offlineQueue";
import { api } from "@/lib/api";

/**
 * Hook for offline-aware API calls with background sync queue.
 * - When online: executes immediately
 * - When offline: saves to IndexedDB queue, retries on reconnect
 */
export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const items = await getAllQueued();
      setPendingCount(items.length);
    } catch {
      // ignore
    }
  }, []);

  // Replay queue when back online
  const replayQueue = useCallback(async () => {
    setSyncing(true);
    try {
      const items = await getAllQueued();
      if (items.length === 0) {
        setSyncing(false);
        return;
      }

      for (const item of items) {
        try {
          // We re-use the api helper to benefit from auth headers
          if (item.method === "POST") {
            await api.post(item.url.replace(/^\/api/, ""), item.body);
          } else if (item.method === "PUT") {
            await api.put(item.url.replace(/^\/api/, ""), item.body);
          } else if (item.method === "DELETE") {
            await api.delete(item.url.replace(/^\/api/, ""));
          }
          // On success, remove from queue via IndexedDB delete by id
          await deleteById(item.id!);
        } catch {
          // Keep in queue for next attempt
        }
      }
    } finally {
      setSyncing(false);
      refreshCount();
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    const handleOnline = () => replayQueue();

    window.addEventListener("online", handleOnline);

    // Listen for SW sync complete messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (e) => {
        if (e.data?.type === "SYNC_COMPLETE") {
          refreshCount();
        }
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [refreshCount, replayQueue]);

  /**
   * Submit an action - immediately if online, or queue for later.
   */
  const submitOrQueue = useCallback(
    async (action: Omit<OfflineAction, "id" | "createdAt">): Promise<{ queued: boolean }> => {
      if (navigator.onLine) {
        // Online: execute now
        return { queued: false };
      }
      // Offline: enqueue
      await enqueueAction(action);
      refreshCount();
      return { queued: true };
    },
    [refreshCount]
  );

  return { pendingCount, syncing, submitOrQueue };
}

async function deleteById(id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const dbReq = indexedDB.open("pristav-offline", 1);
    dbReq.onsuccess = (e) => {
      const idb = (e.target as IDBOpenDBRequest).result;
      const tx = idb.transaction("queue", "readwrite");
      const req = tx.objectStore("queue").delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    };
    dbReq.onerror = () => reject(dbReq.error);
  });
}
