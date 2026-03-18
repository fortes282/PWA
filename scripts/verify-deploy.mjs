#!/usr/bin/env node

/**
 * Post-deploy smoke verification for staging/production.
 *
 * Default behavior assumes a reverse-proxied deployment where:
 * - BASE_URL points to the public web app (e.g. https://pristav-radosti.cz)
 * - API_URL defaults to `${BASE_URL}/api`
 *
 * It verifies:
 * - public web availability
 * - manifest/offline pages
 * - API health/docs/version endpoints
 * - admin login + auth/me + users/me
 * - refresh token rotation
 *
 * Examples:
 *   node scripts/verify-deploy.mjs \
 *     --base-url=https://staging.pristav-radosti.cz \
 *     --admin-email=admin@pristav.cz \
 *     --admin-password='***' \
 *     --expected-version=2.11.0
 *
 *   BASE_URL=http://127.0.0.1:3000 \
 *   API_URL=http://127.0.0.1:3001 \
 *   ADMIN_EMAIL=admin@pristav.cz \
 *   ADMIN_PASSWORD=Admin123! \
 *   node scripts/verify-deploy.mjs --json
 */

const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "15000", 10);

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq === -1) {
      result[arg.slice(2)] = true;
      continue;
    }
    result[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return result;
}

function normalizeBaseUrl(value, label) {
  if (!value) {
    throw new Error(`${label} is required (use --${label.toLowerCase().replace(/_/g, "-")} or env var)`);
  }
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

function resolveConfig() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage:
  node scripts/verify-deploy.mjs --base-url=<url> --admin-email=<email> --admin-password=<password> [options]

Options:
  --api-url=<url>             Override API URL (default: <base-url>/api)
  --expected-version=<ver>    Assert API version on /health and /health/detailed
  --timeout-ms=<ms>           Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --json                      Print machine-readable JSON summary
  --allow-http                Allow plain HTTP even for non-local hosts
  --help                      Show this help

Env alternatives:
  BASE_URL, API_URL, ADMIN_EMAIL, ADMIN_PASSWORD, EXPECTED_VERSION, SMOKE_TIMEOUT_MS
`);
    process.exit(0);
  }

  const baseUrl = normalizeBaseUrl(args["base-url"] || process.env.BASE_URL, "BASE_URL");
  const apiUrl = normalizeBaseUrl(args["api-url"] || process.env.API_URL || new URL("/api", `${baseUrl}/`).toString(), "API_URL");
  const adminEmail = args["admin-email"] || process.env.ADMIN_EMAIL;
  const adminPassword = args["admin-password"] || process.env.ADMIN_PASSWORD;
  const expectedVersion = args["expected-version"] || process.env.EXPECTED_VERSION || undefined;
  const timeoutMs = Number.parseInt(String(args["timeout-ms"] || DEFAULT_TIMEOUT_MS), 10);
  const json = Boolean(args.json);
  const allowHttp = Boolean(args["allow-http"]);

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  const base = new URL(baseUrl);
  const api = new URL(apiUrl);
  if (!allowHttp) {
    for (const url of [base, api]) {
      if (url.protocol !== "https:" && !localHosts.has(url.hostname)) {
        throw new Error(`Refusing non-HTTPS URL without --allow-http: ${url.toString()}`);
      }
    }
  }

  return { baseUrl, apiUrl, adminEmail, adminPassword, expectedVersion, timeoutMs, json };
}

function joinUrl(baseUrl, pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  return setCookieHeader.split(", ").find((part) => part.startsWith("refreshToken=")) || setCookieHeader.split(";")[0];
}

function truncate(value, max = 180) {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length <= max ? str : `${str.slice(0, max)}…`;
}

async function requestJson(url, options = {}, timeoutMs) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, text, json };
}

async function requestText(url, options = {}, timeoutMs) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  return { response, text };
}

function record(results, name, ok, details) {
  results.push({ name, ok, details });
}

async function main() {
  const config = resolveConfig();
  const results = [];
  let accessToken = null;
  let refreshCookie = null;
  let loggedUser = null;

  try {
    const webRoot = await requestText(joinUrl(config.baseUrl, "/"), {}, config.timeoutMs);
    const webOk = webRoot.response.ok && /text\/html/i.test(webRoot.response.headers.get("content-type") || "");
    record(results, "Web root", webOk, webOk
      ? `HTTP ${webRoot.response.status}, final URL: ${webRoot.response.url}`
      : `HTTP ${webRoot.response.status}, body: ${truncate(webRoot.text)}`);

    const loginPage = await requestText(joinUrl(config.baseUrl, "/login"), {}, config.timeoutMs);
    const loginPageOk = loginPage.response.ok && /Přístav Radosti|Pri?stav Radosti/i.test(loginPage.text);
    record(results, "Login page", loginPageOk, loginPageOk
      ? `HTTP ${loginPage.response.status}, app branding detected`
      : `HTTP ${loginPage.response.status}, body: ${truncate(loginPage.text)}`);

    const manifest = await requestJson(joinUrl(config.baseUrl, "/manifest.json"), {}, config.timeoutMs);
    const manifestOk = manifest.response.ok && Boolean(manifest.json?.name) && Boolean(manifest.json?.theme_color);
    record(results, "PWA manifest", manifestOk, manifestOk
      ? `name=${manifest.json.name}, theme_color=${manifest.json.theme_color}`
      : `HTTP ${manifest.response.status}, body: ${truncate(manifest.text)}`);

    const offlinePage = await requestText(joinUrl(config.baseUrl, "/offline"), {}, config.timeoutMs);
    const offlineOk = offlinePage.response.ok && /offline|bez připojení|Přístav Radosti/i.test(offlinePage.text);
    record(results, "Offline page", offlineOk, offlineOk
      ? `HTTP ${offlinePage.response.status}`
      : `HTTP ${offlinePage.response.status}, body: ${truncate(offlinePage.text)}`);

    const health = await requestJson(joinUrl(config.apiUrl, "/health"), {}, config.timeoutMs);
    const healthVersion = health.json?.version;
    const healthOk = health.response.ok && health.json?.status === "ok" && (!config.expectedVersion || healthVersion === config.expectedVersion);
    record(results, "API /health", healthOk, healthOk
      ? `status=${health.json.status}, version=${healthVersion ?? "n/a"}`
      : `HTTP ${health.response.status}, body: ${truncate(health.json ?? health.text)}`);

    const ping = await requestJson(joinUrl(config.apiUrl, "/health/ping"), {}, config.timeoutMs);
    const pingOk = ping.response.ok && ping.json?.pong === true;
    record(results, "API /health/ping", pingOk, pingOk
      ? "pong=true"
      : `HTTP ${ping.response.status}, body: ${truncate(ping.json ?? ping.text)}`);

    const detailed = await requestJson(joinUrl(config.apiUrl, "/health/detailed"), {}, config.timeoutMs);
    const detailedVersion = detailed.json?.version;
    const detailedDbOk = detailed.json?.db?.ok === true;
    const detailedOk = detailed.response.ok
      && detailed.json?.status === "ok"
      && detailedDbOk
      && (!config.expectedVersion || detailedVersion === config.expectedVersion);
    record(results, "API /health/detailed", detailedOk, detailedOk
      ? `db=${detailedDbOk}, version=${detailedVersion ?? "n/a"}`
      : `HTTP ${detailed.response.status}, body: ${truncate(detailed.json ?? detailed.text)}`);

    const docs = await requestText(joinUrl(config.apiUrl, "/docs"), {}, config.timeoutMs);
    const docsOk = docs.response.ok && /swagger|openapi/i.test(docs.text);
    record(results, "API docs", docsOk, docsOk
      ? `HTTP ${docs.response.status}`
      : `HTTP ${docs.response.status}, body: ${truncate(docs.text)}`);

    const login = await requestJson(joinUrl(config.apiUrl, "/auth/login"), {
      method: "POST",
      body: JSON.stringify({ email: config.adminEmail, password: config.adminPassword }),
    }, config.timeoutMs);
    accessToken = login.json?.accessToken ?? null;
    loggedUser = login.json?.user ?? null;
    refreshCookie = extractCookie(
      typeof login.response.headers.getSetCookie === "function"
        ? login.response.headers.getSetCookie().join("; ")
        : login.response.headers.get("set-cookie"),
    );
    const loginOk = login.response.ok && Boolean(accessToken) && loggedUser?.role === "ADMIN";
    record(results, "Admin login", loginOk, loginOk
      ? `user=${loggedUser.email}, role=${loggedUser.role}`
      : `HTTP ${login.response.status}, body: ${truncate(login.json ?? login.text)}`);

    const authMe = await requestJson(joinUrl(config.apiUrl, "/auth/me"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, config.timeoutMs);
    const authMeOk = authMe.response.ok && authMe.json?.email === config.adminEmail;
    record(results, "API /auth/me", authMeOk, authMeOk
      ? `id=${authMe.json.id}, role=${authMe.json.role}`
      : `HTTP ${authMe.response.status}, body: ${truncate(authMe.json ?? authMe.text)}`);

    const usersMe = await requestJson(joinUrl(config.apiUrl, "/users/me"), {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, config.timeoutMs);
    const usersMeOk = usersMe.response.ok && usersMe.json?.email === config.adminEmail;
    record(results, "API /users/me", usersMeOk, usersMeOk
      ? `name=${usersMe.json.name}, role=${usersMe.json.role}`
      : `HTTP ${usersMe.response.status}, body: ${truncate(usersMe.json ?? usersMe.text)}`);

    const refresh = await requestJson(joinUrl(config.apiUrl, "/auth/refresh"), {
      method: "POST",
      headers: refreshCookie ? { Cookie: refreshCookie } : {},
    }, config.timeoutMs);
    const refreshOk = refresh.response.ok && Boolean(refresh.json?.accessToken);
    record(results, "Refresh token rotation", refreshOk, refreshOk
      ? `new access token issued for ${refresh.json?.user?.email ?? "unknown"}`
      : `HTTP ${refresh.response.status}, body: ${truncate(refresh.json ?? refresh.text)}`);

    const summary = {
      ok: results.every((item) => item.ok),
      baseUrl: config.baseUrl,
      apiUrl: config.apiUrl,
      expectedVersion: config.expectedVersion ?? null,
      executedAt: new Date().toISOString(),
      checks: results,
    };

    if (config.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log(`\nSmoke verification: ${summary.ok ? "PASS" : "FAIL"}`);
      console.log(`Base URL: ${summary.baseUrl}`);
      console.log(`API URL:  ${summary.apiUrl}`);
      if (summary.expectedVersion) {
        console.log(`Expected version: ${summary.expectedVersion}`);
      }
      console.log("");
      for (const item of summary.checks) {
        console.log(`${item.ok ? "✅" : "❌"} ${item.name} — ${item.details}`);
      }
    }

    process.exit(summary.ok ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const summary = {
      ok: false,
      baseUrl: config.baseUrl,
      apiUrl: config.apiUrl,
      executedAt: new Date().toISOString(),
      error: message,
      checks: results,
    };

    if (config.json) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.error("\nSmoke verification: FAIL");
      console.error(message);
      if (results.length > 0) {
        console.error("");
        for (const item of results) {
          console.error(`${item.ok ? "✅" : "❌"} ${item.name} — ${item.details}`);
        }
      }
    }
    process.exit(1);
  }
}

main();
