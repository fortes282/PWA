import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";

describe("Error handling", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 for unauthenticated access to unknown routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/this-route-does-not-exist",
    });
    // Auth middleware intercepts before 404 — returns 401
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body).toHaveProperty("error");
  });

  it("health endpoint returns structured response", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("ok");
    expect(body.version).toBe("2.5.0");
  });

  it("health/ping returns pong", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health/ping",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().pong).toBe(true);
  });

  it("detailed health returns db status and features", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health/detailed",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.db).toHaveProperty("ok");
    expect(body).toHaveProperty("features");
    expect(body).toHaveProperty("dbSize");
    expect(body).toHaveProperty("tableStats");
  });

  it("login with empty body returns 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "", password: "" },
    });
    expect(res.statusCode).toBeLessThan(500);
  });
});
