/**
 * Public booking flow — no authentication required.
 * Tests the /booking page (slot selection, contact form, API validation).
 */
import { test, expect } from "@playwright/test";
import { navigateTo, waitForLoaded } from "./helpers";

test.describe("Public booking flow", () => {
  test.setTimeout(60_000);

  test("Page loads with main content and slot/service selection visible", async ({ page }) => {
    await navigateTo(page, "/booking");
    await waitForLoaded(page);

    // Main content area is visible
    const main = page.locator("main").first();
    await expect(main).toBeVisible({ timeout: 15_000 });

    // Some form of heading or title is present
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Slot buttons or service-selection elements are visible
    const slotButtons = page.locator("button").filter({ hasText: /\d{1,2}:\d{2}/ });
    const serviceCards = page.locator("[class*=card], [class*=rounded]").first();
    const hasSlots = await slotButtons.first().isVisible().catch(() => false);
    const hasCards = await serviceCards.isVisible().catch(() => false);
    expect(hasSlots || hasCards).toBeTruthy();
  });

  test("Slot selection — date/time elements and clickable slots exist", async ({ page }) => {
    await navigateTo(page, "/booking");
    await waitForLoaded(page);

    // Date labels should be rendered (Czech locale day names or date strings)
    const dateLabels = page.locator("text=/\\d{1,2}\\./");
    const hasDateLabels = await dateLabels.first().isVisible().catch(() => false);

    // Time slot buttons (e.g. "09:00", "10:30")
    const timeButtons = page.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ });
    const timeCount = await timeButtons.count();

    // At least one of these should exist
    expect(hasDateLabels || timeCount > 0).toBeTruthy();

    if (timeCount > 0) {
      // Verify slots are clickable — click the first one
      const firstSlot = timeButtons.first();
      await expect(firstSlot).toBeEnabled();
      await firstSlot.click();

      // After clicking a slot, either a form or next step should appear
      const formOrNext = page.locator("form, input, [class*=form]").first();
      await expect(formOrNext).toBeVisible({ timeout: 10_000 });
    }
  });

  test("Contact form validation — empty submit shows errors, fields exist", async ({ page }) => {
    await navigateTo(page, "/booking");
    await waitForLoaded(page);

    // Click a time slot to get to the form step
    const timeButtons = page.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ });
    const slotCount = await timeButtons.count();

    if (slotCount > 0) {
      await timeButtons.first().click();
      await page.waitForTimeout(500);
    }

    // Look for form fields
    const nameInput = page.locator("input[autocomplete='name'], input[placeholder*='ov'], input[placeholder*='mén']").first();
    const emailInput = page.locator("input[type='email'], input[autocomplete='email']").first();
    const phoneInput = page.locator("input[type='tel'], input[autocomplete='tel']").first();

    const hasName = await nameInput.isVisible().catch(() => false);
    const hasEmail = await emailInput.isVisible().catch(() => false);
    const hasPhone = await phoneInput.isVisible().catch(() => false);

    // Name and email fields must exist
    expect(hasName).toBeTruthy();
    expect(hasEmail).toBeTruthy();
    // Phone is optional
    if (hasPhone) {
      await expect(phoneInput).toBeVisible();
    }

    // Try submitting empty — find the submit button
    const submitBtn = page.locator("button[type='submit'], button").filter({ hasText: /odeslat|rezerv|submit|book/i }).first();
    const hasSubmit = await submitBtn.isVisible().catch(() => false);

    if (hasSubmit) {
      // Clear any pre-filled values
      if (hasName) await nameInput.fill("");
      if (hasEmail) await emailInput.fill("");

      await submitBtn.click();
      await page.waitForTimeout(500);

      // Validation should prevent submission or show an error
      // Check for browser-native validation, custom error text, or still on form page
      const errorMsg = page.locator("[class*=error], [class*=red], [role='alert']").first();
      const hasError = await errorMsg.isVisible().catch(() => false);

      // HTML5 required attribute prevents submission — form should still be visible
      const formStillVisible = await page.locator("form").first().isVisible().catch(() => false);

      expect(hasError || formStillVisible).toBeTruthy();
    }
  });

  test("API: POST /booking/public with empty body returns 400", async ({ page }) => {
    // Navigate first to establish baseURL context for page.request
    await navigateTo(page, "/booking");

    const res = await page.request.post("/api/booking/public", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });

    // Should reject with 400 (validation error) — not 500
    expect(res.status()).toBe(400);

    const body = await res.json().catch(() => null);
    expect(body).toBeTruthy();
    expect(body.error).toBeTruthy();
  });

  test("API: POST /booking/public with invalid data returns 400", async ({ page }) => {
    await navigateTo(page, "/booking");

    const res = await page.request.post("/api/booking/public", {
      data: {
        slotDate: "not-a-date",
        slotTime: "99:99",
        name: "",
        email: "not-an-email",
      },
      headers: { "Content-Type": "application/json" },
    });

    // Empty name or invalid email should be rejected
    expect(res.status()).toBe(400);

    const body = await res.json().catch(() => null);
    expect(body).toBeTruthy();
    expect(body.error).toBeTruthy();
  });

  test("Rate limiting awareness — endpoint returns proper errors for bad data", async ({ page }) => {
    await navigateTo(page, "/booking");

    // Verify the endpoint exists and responds (not 404/405)
    const res = await page.request.post("/api/booking/public", {
      data: { slotDate: "", slotTime: "", name: "", email: "" },
      headers: { "Content-Type": "application/json" },
    });

    // Should be a client error (400), not a server error (5xx) or not-found (404)
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);

    const body = await res.json().catch(() => null);
    expect(body).not.toBeNull();
  });
});
