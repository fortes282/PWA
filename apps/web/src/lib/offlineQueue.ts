/**
 * Offline action queue backed by IndexedDB.
 * Actions queued here are replayed by the Service Worker via Background Sync.
 */

export interface OfflineAction {
  id?: number;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  label?: string; // human-readable description
  createdAt: number;
}

const DB_NAME = "pristav-offline";
const DB_VERSION = 1;
const STORE = "queue";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueAction(action: Omit<OfflineAction, "id" | "createdAt">): Promise<void> {
  const db = await openDB();
  const payload: OfflineAction = { ...action, createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).add(payload);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Request background sync if supported
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync.register("pristav-offline-queue");
    } catch {
      // Not supported or denied — SW will retry on next load
    }
  }
}

export async function getAllQueued(): Promise<OfflineAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as OfflineAction[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
