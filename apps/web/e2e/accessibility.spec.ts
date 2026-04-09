import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigateTo } from "./helpers";

/**
 * Accessibility audit (axe-core) — scans every page for critical/serious WCAG violations.
 */

async function assertNoA11yViolations(page: import("@playwright/test").Page, path: string) {
  await navigateTo(page, path);
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    critical,
    `A11y violations on ${path}: ${JSON.stringify(critical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })))}`,
  ).toEqual([]);
}

test.describe("Accessibility (axe-core)", () => {
  // ── Public pages (no login) ──────────────────────────────────────

  test.describe("Public pages", () => {
    test("/login", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/login");
    });

    test("/booking", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/booking");
    });
  });

  // ── Client pages ─────────────────────────────────────────────────

  test.describe("Client pages", () => {
    test.beforeEach(async ({ page }) => {
      await login(page, "client");
    });

    test("/client (dashboard)", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/client");
    });

    test("/client/credits", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/client/credits");
    });

    test("/client/appointments", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/client/appointments");
    });

    test("/client/booking", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/client/booking");
    });

    test("/settings", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/settings");
    });
  });

  // ── Reception pages ──────────────────────────────────────────────

  test.describe("Reception pages", () => {
    test.beforeEach(async ({ page }) => {
      await login(page, "reception");
    });

    test("/reception (dashboard)", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/reception");
    });

    test("/reception/clients", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/reception/clients");
    });

    test("/reception/appointments", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/reception/appointments");
    });
  });

  // ── Employee pages ───────────────────────────────────────────────

  test.describe("Employee pages", () => {
    test.beforeEach(async ({ page }) => {
      await login(page, "employee");
    });

    test("/employee (dashboard)", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/employee");
    });

    test("/employee/clients", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/employee/clients");
    });
  });

  // ── Admin pages ──────────────────────────────────────────────────

  test.describe("Admin pages", () => {
    test.beforeEach(async ({ page }) => {
      await login(page, "admin");
    });

    test("/admin (dashboard)", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/admin");
    });

    test("/admin/users", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/admin/users");
    });

    test("/admin/services", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/admin/services");
    });

    test("/admin/rooms", async ({ page }) => {
      test.setTimeout(60_000);
      await assertNoA11yViolations(page, "/admin/rooms");
    });
  });
});
