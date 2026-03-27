/**
 * PWA_TEST_MATRIX — automated security IDs (Vitest):
 * SEC-02 (JWT manipulation / invalid bearer), SEC-04 (no internal detail in 5xx when NODE_ENV=production).
 * See PWA_TEST_MATRIX.md §5 for full mapping (SEC-01, SEC-03, AUTH-03, RBAC-02/03 in other files).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("SEC-02 — JWT / bearer rejection", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ":memory:";
    process.env.JWT_SECRET = "test-secret-security-matrix-min64chars!!!!!!!!!!!!!!!";
    process.env.JWT_REFRESH_SECRET = "test-refresh-security-matrix-min64chars!!!!!!!!!!!!";
    app = await buildApp({ logger: false });
    app.get(
      "/__vitest-sec-noop",
      { config: { public: true } as { public?: boolean } },
      async () => ({ ok: true }),
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects non-JWT bearer string with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Bearer not-a-jwt-at-all" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects well-formed JWT with invalid signature (tampered) with 401", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({ id: 1, role: "ADMIN", email: "evil@test.cz" }),
    ).toString("base64url");
    const fake = `${header}.${payload}.invalid-signature-bytes`;
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${fake}` },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("SEC-04 — production error responses omit internal details", () => {
  let app: FastifyInstance;
  const prevNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_PATH = ":memory:";
    process.env.JWT_SECRET = "test-secret-sec04-matrix-min64chars!!!!!!!!!!!!!!!!!!";
    process.env.JWT_REFRESH_SECRET = "test-refresh-sec04-matrix-min64chars!!!!!!!!!!!!!";
    app = await buildApp({ logger: false }, true);
    app.get(
      "/__vitest-sec-500",
      { config: { public: true } as { public?: boolean } },
      async () => {
        const err = new Error("SQLITE_CORRUPT /var/lib/pristav/secret.sqlite: detailed stack path");
        (err as { statusCode?: number }).statusCode = 500;
        throw err;
      },
    );
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = prevNodeEnv;
  });

  it("500 response uses generic message and exposes no stack or path in JSON", async () => {
    const res = await app.inject({ method: "GET", url: "/__vitest-sec-500" });
    expect(res.statusCode).toBe(500);
    const body = res.json() as Record<string, unknown>;
    expect(body.message).toBe("Internal Server Error");
    expect(JSON.stringify(body)).not.toMatch(/SQLITE_CORRUPT/i);
    expect(JSON.stringify(body)).not.toMatch(/\/var\/lib/i);
    expect(body).not.toHaveProperty("stack");
  });
});
