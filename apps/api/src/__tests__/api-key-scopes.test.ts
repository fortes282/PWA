import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "crypto";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server.js";
import { rawSqlite } from "../db/index.js";

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CLIENT',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    prefix TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '[]',
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER REFERENCES users(id)
  );
`;

let app: FastifyInstance;

function keyHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

beforeAll(async () => {
  rawSqlite.exec(MIGRATION_SQL);
  rawSqlite.prepare("INSERT INTO users (id, email, password_hash, name, role, is_active) VALUES (1, ?, ?, ?, ?, 1)")
    .run("admin@test.cz", "x", "Admin", "ADMIN");

  rawSqlite.prepare(`
    INSERT INTO api_keys (name, key_hash, prefix, scopes, is_active, created_by)
    VALUES (?, ?, ?, ?, 1, 1)
  `).run("no-scope", keyHash("k_no_scope"), "pr_live_n", JSON.stringify(["admin:backup:read"]));

  rawSqlite.prepare(`
    INSERT INTO api_keys (name, key_hash, prefix, scopes, is_active, created_by)
    VALUES (?, ?, ?, ?, 1, 1)
  `).run("read-scope", keyHash("k_read_scope"), "pr_live_r", JSON.stringify(["admin:api-keys:read"]));

  app = await buildApp({ logger: false });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("API key scope guard", () => {
  it("returns 403 for missing scope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-keys",
      headers: { "x-api-key": "k_no_scope" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("allows request with required scope", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/api-keys",
      headers: { "x-api-key": "k_read_scope" },
    });
    expect(res.statusCode).toBe(200);
  });
});
