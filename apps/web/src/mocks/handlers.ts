import { http, HttpResponse } from "msw";

/**
 * Výchozí handlery pro Vitest (Node). Rozšiřuj podle route, které komponenta volá.
 * Glob pattern v http.get zachytí libovolný host včetně 127.0.0.1.
 */
export const handlers = [
  // Health
  http.get("*/api/health", () =>
    HttpResponse.json({ status: "ok", service: "mock" }, { status: 200 }),
  ),

  // Auth
  http.get("*/api/auth/me", () =>
    HttpResponse.json({
      id: 5,
      email: "klient@pristav.cz",
      name: "Martin Svoboda",
      role: "CLIENT",
    }),
  ),

  http.post("*/api/auth/login", () =>
    HttpResponse.json({
      accessToken: "mock-token-123",
      user: { id: 5, role: "CLIENT" },
    }),
  ),

  http.post("*/api/auth/logout", () =>
    HttpResponse.json({ ok: true }),
  ),

  http.post("*/api/auth/refresh", () =>
    HttpResponse.json({ accessToken: "mock-token-refreshed" }),
  ),

  // Services
  http.get("*/api/services", () =>
    HttpResponse.json([
      { id: 1, name: "Individuální terapie", durationMinutes: 50, priceCzk: 1500, category: "THERAPY" },
      { id: 2, name: "Skupinová terapie", durationMinutes: 90, priceCzk: 800, category: "THERAPY" },
      { id: 3, name: "Neurorehabilitace", durationMinutes: 60, priceCzk: 1200, category: "REHAB" },
    ]),
  ),

  // Credits
  http.get("*/api/credits/balance", () =>
    HttpResponse.json({ balance: 4300 }),
  ),

  // Notifications
  http.get("*/api/notifications", () =>
    HttpResponse.json([
      {
        id: 1,
        title: "Připomínka sezení",
        message: "Zítra máte sezení v 10:00",
        isRead: false,
        createdAt: "2024-01-15T08:00:00.000Z",
      },
      {
        id: 2,
        title: "Faktura vystavena",
        message: "Byla vystavena faktura č. 2024-042",
        isRead: false,
        createdAt: "2024-01-14T14:30:00.000Z",
      },
    ]),
  ),

  http.get("*/api/notifications/unread-count", () =>
    HttpResponse.json({ count: 2 }),
  ),
];
