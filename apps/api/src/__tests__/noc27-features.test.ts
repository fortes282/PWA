/**
 * NOC 27 — Env validation, metrics, backup, version 2.10.0.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../server.js";
import type { FastifyInstance } from "fastify";
import { validateEnv } from "../utils/env-validation.js";
import { metrics } from "../utils/metrics.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ── Env Validation ──────────────────────────────────────────────────────

describe("NOC 27 — Env Validation", () => {
  it("returns errors for missing JWT_SECRET", () => {
    const orig = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    const result = validateEnv();
    expect(result.errors.some((e) => e.includes("JWT_SECRET"))).toBe(true);
    process.env.JWT_SECRET = orig;
  });

  it("warns about short secrets", () => {
    const orig = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "short";
    const result = validateEnv();
    expect(result.warnings.some((w) => w.includes("shorter than"))).toBe(true);
    process.env.JWT_SECRET = orig;
  });

  it("detects known default secrets", () => {
    const orig = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "changeme";
    const result = validateEnv();
    expect(result.errors.some((e) => e.includes("known default"))).toBe(true);
    process.env.JWT_SECRET = orig;
  });
});

// ── Metrics ─────────────────────────────────────────────────────────────

describe("NOC 27 — Metrics", () => {
  it("GET /metrics returns Prometheus text format", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("pristav_uptime_seconds");
    expect(res.body).toContain("pristav_memory_rss_bytes");
  });

  it("GET /health/metrics returns JSON summary", async () => {
    const res = await app.inject({ method: "GET", url: "/health/metrics" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("uptimeSeconds");
    expect(body).toHaveProperty("totalRequests");
    expect(body).toHaveProperty("memory");
    expect(body.memory).toHaveProperty("rss");
    expect(body.memory).toHaveProperty("heapUsed");
  });

  it("metrics collector tracks requests", () => {
    metrics.incrementRequest("GET", 200);
    metrics.incrementRequest("POST", 201);
    metrics.recordDuration("GET", "/test", 0.05);
    const json = metrics.toJSON();
    expect(json.totalRequests).toBeGreaterThan(0);
    const prom = metrics.toPrometheus();
    expect(prom).toContain("pristav_http_requests_total");
  });
});

// ── Backup Endpoints ────────────────────────────────────────────────────

describe("NOC 27 — Backup Endpoints", () => {
  it("POST /admin/backup requires auth", async () => {
    const res = await app.inject({ method: "POST", url: "/admin/backup" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /admin/backups requires auth", async () => {
    const res = await app.inject({ method: "GET", url: "/admin/backups" });
    expect(res.statusCode).toBe(401);
  });
});

// ── Version ─────────────────────────────────────────────────────────────

describe("NOC 27 — Version 2.10.0", () => {
  it("health endpoint reports v2.10.0", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json().version).toBe("2.10.0");
  });

  it("OpenAPI spec reports v2.10.0", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });
    expect(res.json().info.version).toBe("2.10.0");
  });
});
