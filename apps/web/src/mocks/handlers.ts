import { http, HttpResponse } from "msw";

/**
 * Výchozí handlery pro Vitest (Node). Rozšiřuj podle route, které komponenta volá.
 * Glob pattern v http.get zachytí libovolný host včetně 127.0.0.1.
 */
export const handlers = [
  http.get("*/api/health", () =>
    HttpResponse.json({ status: "ok", service: "mock" }, { status: 200 }),
  ),
];
