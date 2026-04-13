import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/server";
import { api, apiFetch, setAccessToken } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset in-memory access token before each test to avoid state leakage. */
beforeEach(() => {
  setAccessToken(null);
});

// ---------------------------------------------------------------------------
// api.get — GET request
// ---------------------------------------------------------------------------

describe("api.get", () => {
  it("vrátí parsované JSON pro úspěšný GET", async () => {
    server.use(
      http.get("*/api/services", () =>
        HttpResponse.json([{ id: 1, name: "Terapie" }]),
      ),
    );

    const data = await api.get<{ id: number; name: string }[]>("/services");
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe(1);
    expect(data[0].name).toBe("Terapie");
  });

  it("nastaví hlavičku Content-Type: application/json", async () => {
    let capturedContentType: string | null = null;

    server.use(
      http.get("*/api/services", ({ request }) => {
        capturedContentType = request.headers.get("content-type");
        return HttpResponse.json([]);
      }),
    );

    await api.get("/services");
    expect(capturedContentType).toBe("application/json");
  });

  it("nastaví Authorization header, pokud je accessToken nastavený", async () => {
    setAccessToken("mock-token-123");
    let capturedAuth: string | null = null;

    server.use(
      http.get("*/api/services", ({ request }) => {
        capturedAuth = request.headers.get("authorization");
        return HttpResponse.json([]);
      }),
    );

    await api.get("/services");
    expect(capturedAuth).toBe("Bearer mock-token-123");
  });

  it("nenastaví Authorization header, když není token", async () => {
    let capturedAuth: string | null = "present";

    server.use(
      http.get("*/api/services", ({ request }) => {
        capturedAuth = request.headers.get("authorization");
        return HttpResponse.json([]);
      }),
    );

    await api.get("/services");
    expect(capturedAuth).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// api.post — POST request
// ---------------------------------------------------------------------------

describe("api.post", () => {
  it("vrátí parsované JSON pro úspěšný POST", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json({
          accessToken: "mock-token-123",
          user: { id: 5, role: "CLIENT" },
        }),
      ),
    );

    const data = await api.post<{ accessToken: string }>("/auth/login", {
      email: "klient@pristav.cz",
      password: "heslo",
    });

    expect(data.accessToken).toBe("mock-token-123");
  });

  it("nastaví Content-Type: application/json na POST", async () => {
    let capturedContentType: string | null = null;

    server.use(
      http.post("*/api/auth/login", ({ request }) => {
        capturedContentType = request.headers.get("content-type");
        return HttpResponse.json({ accessToken: "t", user: { id: 1, role: "CLIENT" } });
      }),
    );

    await api.post("/auth/login", { email: "x@x.cz", password: "pass" });
    expect(capturedContentType).toBe("application/json");
  });

  it("odešle správné tělo požadavku jako JSON", async () => {
    let capturedBody: unknown = null;

    server.use(
      http.post("*/api/auth/login", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ accessToken: "t", user: { id: 1, role: "CLIENT" } });
      }),
    );

    await api.post("/auth/login", { email: "test@test.cz", password: "tajne" });
    expect(capturedBody).toEqual({ email: "test@test.cz", password: "tajne" });
  });
});

// ---------------------------------------------------------------------------
// 401 auto-refresh
// ---------------------------------------------------------------------------

describe("apiFetch — 401 auto-refresh", () => {
  it("pokusí se o refresh při 401 odpovědi", async () => {
    let refreshCalled = false;
    let requestCount = 0;

    server.use(
      // First call → 401, second call (after refresh) → 200
      http.get("*/api/credits/balance", () => {
        requestCount++;
        if (requestCount === 1) {
          return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ balance: 4300 });
      }),
      http.post("*/api/auth/refresh", () => {
        refreshCalled = true;
        return HttpResponse.json({ accessToken: "mock-token-refreshed" });
      }),
    );

    const data = await apiFetch<{ balance: number }>("/credits/balance");

    expect(refreshCalled).toBe(true);
    expect(data.balance).toBe(4300);
  });

  it("vyhodí chybu, když refresh selže a původní odpověď je 401", async () => {
    server.use(
      http.get("*/api/credits/balance", () =>
        // Return a 401 with an explicit error body; the api throws body.error
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
      http.post("*/api/auth/refresh", () =>
        HttpResponse.json({ error: "Session expired" }, { status: 401 }),
      ),
    );

    // When refresh fails (newToken === null), the code retries with the original
    // response which had body.error === "Unauthorized".  The fallback message
    // "Neplatné přihlašovací údaje" is only used when the body has no error/message
    // field.  So the actual thrown text is the value from body.error.
    await expect(apiFetch("/credits/balance")).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("apiFetch — chybové stavy", () => {
  it("vyhodí chybu s textem z pole error v těle odpovědi", async () => {
    server.use(
      http.get("*/api/services", () =>
        HttpResponse.json(
          { error: "Nemáte oprávnění" },
          { status: 403 },
        ),
      ),
    );

    await expect(api.get("/services")).rejects.toThrow("Nemáte oprávnění");
  });

  it("vyhodí chybu s textem z pole message v těle odpovědi", async () => {
    server.use(
      http.get("*/api/services", () =>
        HttpResponse.json(
          { message: "Zdroj nenalezen" },
          { status: 404 },
        ),
      ),
    );

    await expect(api.get("/services")).rejects.toThrow("Zdroj nenalezen");
  });

  it("vyhodí fallback chybu HTTP 500", async () => {
    server.use(
      http.get("*/api/services", () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    );

    await expect(api.get("/services")).rejects.toThrow("HTTP 500");
  });

  it("vyhodí správnou hlášku pro 429 Too Many Requests", async () => {
    server.use(
      http.get("*/api/services", () =>
        HttpResponse.json({}, { status: 429 }),
      ),
    );

    await expect(api.get("/services")).rejects.toThrow(
      "Příliš mnoho pokusů. Zkuste to později.",
    );
  });
});
