import { describe, it, expect } from "vitest";

/** Ověří, že MSW v Vitestu zachytí fetch (viz `src/mocks/handlers.ts`). */
describe("MSW + fetch", () => {
  it("GET /api/health vrací mock z handleru", async () => {
    const res = await fetch("http://127.0.0.1/api/health");
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { status?: string };
    expect(data.status).toBe("ok");
  });
});
