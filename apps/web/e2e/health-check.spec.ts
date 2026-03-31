/**
 * Comprehensive page health check -- navigates to EVERY page as each role,
 * detects error boundaries, blank pages, JS console errors, HTTP 500/404,
 * and garbage text (undefined, NaN, [object Object]).
 *
 * This is the GATE test: if any page crashes here, downstream tests are skipped.
 *
 * Run against live site:
 *   cd /tmp/PWA/apps/web && BASE_URL=http://109.123.243.52 \
 *     pnpm exec playwright test e2e/health-check.spec.ts --project=health-gate
 */
import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";
import {
  ADMIN_AUTH_FILE,
  CLIENT_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
} from "./helpers";

// ---------------------------------------------------------------------------
// Page registry per role
// ---------------------------------------------------------------------------

const CLIENT_PAGES = [
  "/client",
  "/client/booking",
  "/client/appointments",
  "/client/credits",
  "/client/credit-request",
  "/client/invoices",
  "/client/packages",
  "/client/progress",
  "/client/reports",
  "/client/questionnaires",
  "/client/health-record",
  "/client/homework",
  "/client/waitlist",
  "/client/intensive-blocks",
  "/client/groups",
  "/client/achievements",
  "/client/erasure-request",
  "/client/settings",
  "/notifications",
  "/messages",
  "/settings",
  "/settings/security",
  "/settings/notifications",
  "/settings/2fa",
];

const RECEPTION_PAGES = [
  "/reception",
  "/reception/calendar",
  "/reception/appointments",
  "/reception/schedule",
  "/reception/working-hours",
  "/reception/clients",
  "/reception/health-records",
  "/reception/waitlist",
  "/reception/billing",
  "/reception/credit-requests",
  "/notifications",
  "/messages",
  "/settings",
];

const EMPLOYEE_PAGES = [
  "/employee",
  "/employee/appointments",
  "/employee/reports",
  "/employee/therapy-reports",
  "/employee/homework",
  "/employee/clients",
  "/employee/colleagues",
  "/employee/session-templates",
  "/employee/exercise-library",
  "/employee/wellbeing",
  "/employee/groups",
  "/employee/schedule",
  "/notifications",
  "/messages",
  "/settings",
];

const ADMIN_PAGES = [
  "/admin",
  "/admin/bi",
  "/admin/stats",
  "/admin/users",
  "/admin/services",
  "/admin/rooms",
  "/admin/packages",
  "/admin/questionnaires",
  "/admin/groups",
  "/admin/vouchers",
  "/admin/corporate",
  "/admin/heatmap",
  "/admin/off-peak",
  "/admin/invoices",
  "/admin/fio",
  "/admin/insurance",
  "/admin/insurance/billing",
  "/admin/insurance/procedures",
  "/admin/ai-waitlist",
  "/admin/background",
  "/admin/monitoring",
  "/admin/sessions",
  "/admin/api-keys",
  "/admin/gdpr",
  "/admin/audit",
  "/admin/medical-reports",
  "/admin/notifications",
  "/admin/notification-settings",
  "/admin/settings",
  "/admin/staff-wellbeing",
  "/admin/intensive-blocks",
  "/admin/schedule",
  "/reception/appointments",
  "/reception/schedule",
  "/reception/working-hours",
  "/reception/credit-requests",
  "/notifications",
  "/messages",
  "/settings",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageIssue {
  role: string;
  path: string;
  issues: string[];
}

// ---------------------------------------------------------------------------
// Checker
// ---------------------------------------------------------------------------

const ERROR_BOUNDARY_PATTERNS = [
  "Neco se pokazilo",
  "Something went wrong",
  "Application error",
  "Unhandled Runtime Error",
  "Internal Server Error",
  "Server Error",
  "Error: ",
  "error.tsx",
  "Nastala chyba",
  "Chyba aplikace",
];

async function checkPage(
  page: Page,
  role: string,
  path: string,
): Promise<PageIssue | null> {
  const issues: string[] = [];
  const consoleErrors: string[] = [];
  const apiErrors: string[] = [];

  // Collect console errors
  const onConsole = (msg: ConsoleMessage) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Skip noisy/benign browser errors
      if (
        text.includes("favicon") ||
        text.includes("manifest") ||
        text.includes("service-worker") ||
        text.includes("net::ERR_") ||
        text.includes("Failed to load resource") ||
        text.includes("ResizeObserver") ||
        text.includes("Download the React DevTools")
      ) {
        return;
      }
      consoleErrors.push(text.slice(0, 200));
    }
  };
  page.on("console", onConsole);

  // Collect API 500/404 responses
  const onResponse = (response: { url: () => string; status: () => number }) => {
    const status = response.status();
    const url = response.url();
    if ((status === 500 || status === 404) && url.includes("/api")) {
      apiErrors.push(`HTTP ${status}: ${url.split("?")[0]}`);
    }
  };
  page.on("response", onResponse);

  // Collect uncaught page errors
  const pageErrors: string[] = [];
  const onPageError = (err: Error) => {
    pageErrors.push(err.message.slice(0, 200));
  };
  page.on("pageerror", onPageError);

  try {
    const response = await page.goto(path, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });

    // Check main response status
    if (response) {
      const status = response.status();
      if (status >= 400) {
        issues.push(`Page returned HTTP ${status}`);
      }
    }

    // Wait for hydration
    await page.waitForTimeout(500);

    // Check if redirected to login (auth issue)
    const currentUrl = page.url();
    if (currentUrl.includes("/login")) {
      issues.push("Redirected to /login -- auth may have expired");
      return issues.length > 0 ? { role, path, issues } : null;
    }

    // Check for error boundary text
    const bodyText = await page.locator("body").textContent().catch(() => "");
    for (const pattern of ERROR_BOUNDARY_PATTERNS) {
      if (bodyText && bodyText.includes(pattern)) {
        // Grab surrounding context
        const idx = bodyText.indexOf(pattern);
        const context = bodyText.slice(Math.max(0, idx - 30), idx + pattern.length + 50).trim();
        issues.push(`Error boundary: "${context.slice(0, 120)}"`);
        break;
      }
    }

    // Check for blank/empty page
    const mainContent = await page.locator("main").textContent().catch(() => null);
    if (mainContent !== null && mainContent.trim().length < 20) {
      issues.push(`Blank/empty page -- main content is only ${mainContent.trim().length} chars: "${mainContent.trim()}"`);
    }
    // If no <main>, try body minus nav/header
    if (mainContent === null) {
      const bodyOnly = await page.evaluate(() => {
        const main = document.querySelector("main");
        if (main) return main.textContent?.trim() ?? "";
        // Fallback: body without nav/header/footer
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("nav, header, footer, script, style").forEach((el) => el.remove());
        return clone.textContent?.trim() ?? "";
      });
      if (bodyOnly.length < 20) {
        issues.push(`Blank/empty page (no <main>) -- content is only ${bodyOnly.length} chars`);
      }
    }

    // Check for "undefined", "NaN", "[object Object]" in visible text
    const garbageHits = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const el = node.parentElement;
            if (!el) return NodeFilter.FILTER_REJECT;
            const tag = el.tagName;
            if (["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT"].includes(tag)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (el.offsetParent === null && el.tagName !== "BODY") {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );

      const hits: string[] = [];
      while (walker.nextNode()) {
        const txt = walker.currentNode.textContent?.trim() ?? "";
        if (!txt) continue;
        if (/\bundefined\b/i.test(txt)) {
          hits.push(`"undefined" found: "${txt.slice(0, 80)}"`);
        }
        if (/\bNaN\b/.test(txt)) {
          hits.push(`"NaN" found: "${txt.slice(0, 80)}"`);
        }
        if (txt.includes("[object Object]")) {
          hits.push(`"[object Object]" found: "${txt.slice(0, 80)}"`);
        }
      }
      return hits;
    });
    if (garbageHits.length > 0) {
      issues.push(...garbageHits.slice(0, 5));
    }

    // Record console errors
    if (consoleErrors.length > 0) {
      issues.push(
        ...consoleErrors.slice(0, 5).map((e) => `Console error: ${e}`),
      );
    }

    // Record uncaught page errors
    if (pageErrors.length > 0) {
      issues.push(
        ...pageErrors.slice(0, 3).map((e) => `Page error (uncaught): ${e}`),
      );
    }

    // Record API errors
    if (apiErrors.length > 0) {
      // Dedupe
      const unique = [...new Set(apiErrors)];
      issues.push(...unique.slice(0, 5));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push(`Navigation failed: ${msg.slice(0, 200)}`);
  } finally {
    page.removeListener("console", onConsole);
    page.removeListener("response", onResponse);
    page.removeListener("pageerror", onPageError);
  }

  return issues.length > 0 ? { role, path, issues } : null;
}

// ---------------------------------------------------------------------------
// Test suites per role
// ---------------------------------------------------------------------------

function makeRoleSuite(
  roleName: string,
  authFile: string,
  pages: string[],
) {
  test.describe(`Health check -- ${roleName}`, () => {
    test.use({ storageState: authFile });
    test.describe.configure({ mode: "parallel" });
    // Per-test timeout: fast fail instead of 45s default
    test.setTimeout(20_000);

    for (const pagePath of pages) {
      test(`${roleName}: ${pagePath}`, async ({ page }) => {
        const result = await checkPage(page, roleName, pagePath);
        if (result) {
          // Log broken page for CI output
          console.log(
            `\nBROKEN [${roleName}] ${pagePath}:\n` +
              result.issues.map((i) => `   - ${i}`).join("\n"),
          );
          // Fail the individual test so the report shows it
          expect.soft(
            result.issues,
            `Page ${pagePath} has issues`,
          ).toEqual([]);
        }
      });
    }
  });
}

makeRoleSuite("CLIENT", CLIENT_AUTH_FILE, CLIENT_PAGES);
makeRoleSuite("RECEPTION", RECEPTION_AUTH_FILE, RECEPTION_PAGES);
makeRoleSuite("EMPLOYEE", EMPLOYEE_AUTH_FILE, EMPLOYEE_PAGES);
makeRoleSuite("ADMIN", ADMIN_AUTH_FILE, ADMIN_PAGES);
