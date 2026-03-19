const CACHE_NAME = "pristav-v3";
const API_CACHE_NAME = "pristav-api-v3";
const OFFLINE_URL = "/offline";
const STATIC_ASSETS = [
  "/",
  "/offline",
  "/login",
  "/client",
  "/client/booking",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// ──────────────────────────────────────────
// Install: precache key pages + static assets
// ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(STATIC_ASSETS).catch(() => {
          // If some assets fail (e.g. authenticated pages), ignore
        })
      )
  );
  self.skipWaiting();
});

// ──────────────────────────────────────────
// Activate: clean up old caches
// ──────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ──────────────────────────────────────────
// Fetch strategy
// ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (POST/PUT/DELETE go through normally)
  if (request.method !== "GET") return;

  // Skip chrome-extension and non-http requests
  if (!url.protocol.startsWith("http")) return;

  // ── API calls: Network-first, fallback to API cache ──
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname !== self.location.hostname
  ) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // ── Navigation: Network-first, fallback to cached page, then /offline ──
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // ── Static assets: Cache-first ──
  event.respondWith(cacheFirstStatic(request));
});

async function networkFirstAPI(request) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline", offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Cache navigated page for later offline use
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offlinePage = await caches.match(OFFLINE_URL);
    return offlinePage || new Response("Offline", { status: 503 });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

// ──────────────────────────────────────────
// Background Sync: replay queued actions
// ──────────────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "pristav-offline-queue") {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  // Open IndexedDB and replay pending requests
  const db = await openDB();
  const actions = await getAllActions(db);

  for (const action of actions) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: { "Content-Type": "application/json", ...action.headers },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      if (response.ok) {
        await deleteAction(db, action.id);
        // Notify all clients that sync completed
        const clients = await self.clients.matchAll();
        clients.forEach((client) =>
          client.postMessage({ type: "SYNC_COMPLETE", action })
        );
      }
    } catch {
      // Will retry on next sync event
    }
  }
}

// ──────────────────────────────────────────
// Minimal IndexedDB helpers (in SW context)
// ──────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("pristav-offline", 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("queue")) {
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllActions(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const req = tx.objectStore("queue").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deleteAction(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readwrite");
    const req = tx.objectStore("queue").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ──────────────────────────────────────────
// Push notifications
// ──────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Přístav Radosti", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
