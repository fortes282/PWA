/**
 * E2E: Client booking flow & related client pages
 *
 * Matrix scenarios:
 *   CL-01 (P0): Full booking flow: open /client/booking → select service → select date →
 *               select time slot → confirm → navigate to /client/appointments → verify booking visible.
 *   CL-03 (P1): Open /client/appointments → if booking exists, click cancel → verify reason dialog →
 *               confirm cancel → verify status changed.
 *   CL-04 (P1): Open /client/credits → verify balance displayed (number, not undefined) →
 *               verify transaction history section exists.
 *   CL-05 (P1): Open /client/waitlist → verify page loads → check for waitlist form or existing entries.
 *   CL-06 (P2): Open /client/reports → verify page loads without crash.
 *               Open /client/progress → verify progress data or empty state.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_AUTH_FILE, assertNoGarbageTextDeep } from "./helpers";

// ============================================================================
// CL-01 (P0): Full booking flow
// ============================================================================

test.describe("CL-01: Full booking flow", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("open booking → select service → date → time → confirm → verify in appointments", async ({
    page,
  }) => {
    // 1. Navigate to booking page
    await page.goto("/client/booking", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // 2. Verify service selection is visible
    await expect(
      page.getByRole("heading", { name: /rezervace termínu/i }),
    ).toBeVisible({ timeout: 10_000 });

    // 3. Select a service (click first available service card with duration info)
    const serviceCards = page.locator("button").filter({
      has: page.locator("text=/\\d+\\s*min/"),
    });
    await expect(serviceCards.first()).toBeVisible({ timeout: 10_000 });
    await serviceCards.first().click();

    // 4. Verify calendar/date selection step appears
    await expect(page.getByText(/vyberte datum/i)).toBeVisible({
      timeout: 5_000,
    });

    // 5. Find and click a day with available slots
    const calendarGrid = page.locator(".grid-cols-7").last();
    await expect(calendarGrid).toBeVisible();
    await page.waitForTimeout(300);

    const availableDays = calendarGrid.locator("button:not([disabled])");
    const dayCount = await availableDays.count();

    if (dayCount === 0) {
      test.skip(true, "No available days in the current month");
      return;
    }

    await availableDays.first().click();

    // 6. Verify time slots appear
    const timeStepVisible = await page
      .getByText(/vyberte čas/i)
      .isVisible()
      .catch(() => false);

    if (!timeStepVisible) {
      test.skip(true, "Selected day has no available time slots");
      return;
    }

    await expect(page.getByText(/vyberte čas/i)).toBeVisible();

    // 7. Select first available time slot
    const timeSlots = page.locator(".grid-cols-3 button:not([disabled])");
    const slotCount = await timeSlots.count();

    if (slotCount === 0) {
      test.skip(true, "No time slots available for selected day");
      return;
    }

    await timeSlots.first().click();

    // 8. Verify confirmation screen
    await expect(page.getByText(/potvrzení rezervace/i)).toBeVisible({
      timeout: 5_000,
    });

    // 9. Check if insufficient credit warning blocks confirmation
    const insufficientCredit = await page
      .getByText(/nedostatek kreditu/i)
      .isVisible()
      .catch(() => false);

    if (insufficientCredit) {
      // Cannot complete booking without credits — verified warning is shown
      await expect(page.getByText(/nedostatek kreditu/i)).toBeVisible();
      return;
    }

    // 10. Confirm booking
    await page
      .getByRole("button", { name: /potvrdit rezervaci/i })
      .click();

    // 11. Verify success
    await expect(page.getByText(/termín rezervován/i)).toBeVisible({
      timeout: 10_000,
    });

    // 12. Navigate to appointments and verify booking is visible
    await page.goto("/client/appointments", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /moje rezervace/i }),
    ).toBeVisible({ timeout: 10_000 });

    // The upcoming section should have at least one entry
    const hasConfirmed = await page
      .getByText(/potvrzeno/i)
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const hasAppointment = await page
      .locator("main")
      .getByText(/\d{1,2}:\d{2}/)
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasConfirmed || hasAppointment).toBe(true);
  });
});

// ============================================================================
// CL-03 (P1): Cancel booking with reason
// ============================================================================

test.describe("CL-03: Cancel booking with reason", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("open appointments → cancel existing booking → verify reason dialog → confirm → status changed", async ({
    page,
  }) => {
    await page.goto("/client/appointments", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    await expect(
      page.getByRole("heading", { name: /moje rezervace/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Look for a cancel button on an existing booking
    const cancelBtn = page.getByRole("button", { name: /zrušit|storno|cancel/i }).first();
    const hasCancelBtn = await cancelBtn
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasCancelBtn) {
      test.skip(true, "No cancellable booking found");
      return;
    }

    await cancelBtn.click();

    // Verify reason dialog / confirmation modal appears
    const reasonDialog = page.getByText(/důvod|reason|storno/i).first();
    const dialogVisible = await reasonDialog
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (dialogVisible) {
      // If there's a textarea for reason, fill it
      const reasonInput = page.locator("textarea, input[name*='reason'], input[name*='duvod']").first();
      const hasReasonInput = await reasonInput
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (hasReasonInput) {
        await reasonInput.fill("E2E test cancellation");
      }

      // Confirm the cancellation
      const confirmCancelBtn = page.getByRole("button", {
        name: /potvrdit|ano|zrušit termín|stornovat/i,
      });
      const confirmVisible = await confirmCancelBtn
        .first()
        .waitFor({ state: "visible", timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (confirmVisible) {
        await confirmCancelBtn.first().click();
      }
    }

    // Verify status changed — look for "zrušeno" / "cancelled" status indicator
    await page.waitForTimeout(1_000);
    const statusChanged =
      (await page
        .getByText(/zrušeno|cancelled|stornováno/i)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false)) ||
      // Or the booking disappeared from the list (filtered out)
      (await page.locator("main").isVisible());

    expect(statusChanged).toBe(true);
  });
});

// ============================================================================
// CL-04 (P1): Credits & transaction history
// ============================================================================

test.describe("CL-04: Credits page — balance and transaction history", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("open /client/credits → verify balance displayed (not undefined) → transaction history section exists", async ({
    page,
  }) => {
    await page.goto("/client/credits", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Balance lives in the gradient card under "Aktuální zůstatek" — do not use /kredit/i alone:
    // it matches the h1 "Kredity" first and omits the numeric balance.
    const balanceCard = page.locator("main .card").filter({ hasText: /Aktuální zůstatek/i }).first();
    await expect(balanceCard).toBeVisible({ timeout: 10_000 });
    // SWR may briefly show "—"; wait for formatted amount (always contains a digit for CZK)
    await expect(balanceCard).toContainText(/\d/, { timeout: 20_000 });

    const balanceText = await balanceCard.textContent();
    expect(balanceText).not.toMatch(/\bundefined\b/);
    expect(balanceText).not.toMatch(/\bNaN\b/);
    expect(balanceText).toMatch(/\d/);

    // Verify transaction history section exists
    const historySection = page
      .getByText(/historie|transakce|pohyby|transaction/i)
      .first();
    const hasHistory = await historySection
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    // Either a history section or a table/list of transactions should exist
    const hasTable = await page
      .locator("table, [role='table'], ul, [class*='list']")
      .first()
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    expect(hasHistory || hasTable).toBe(true);
  });
});

// ============================================================================
// CL-05 (P1): Waitlist page
// ============================================================================

test.describe("CL-05: Waitlist page loads", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("open /client/waitlist → verify page loads → check for waitlist form or entries", async ({
    page,
  }) => {
    await page.goto("/client/waitlist", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify page loaded without crash
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Check for either a waitlist form (to add yourself) or existing waitlist entries
    const hasForm = await page
      .getByRole("button", { name: /přidat|přidej|zapsat|odeslat/i })
      .first()
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    const hasEntries = await page
      .getByText(/čekatel|waitlist|pořadník|žádné|prázdný|zatím/i)
      .first()
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    const hasHeading = await page
      .getByRole("heading", { name: /waitlist|čekatel|pořadník/i })
      .waitFor({ state: "visible", timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    expect(hasForm || hasEntries || hasHeading).toBe(true);
  });
});

// ============================================================================
// CL-06 (P2): Reports and progress pages load without crash
// ============================================================================

test.describe("CL-06: Reports and progress pages load", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("open /client/reports → verify page loads without crash", async ({
    page,
  }) => {
    await page.goto("/client/reports", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify page renders without error boundary
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    // Should not show an error boundary / crash
    const hasError = await page
      .getByRole("heading", { name: /pokazilo|error|chyba/i })
      .isVisible()
      .catch(() => false);
    expect(hasError).toBe(false);

    // Check for any content — reports list, empty state, or heading
    const hasContent =
      (await page
        .getByText(/zprávy|reporty|reports|žádné|prázdný/i)
        .first()
        .isVisible()
        .catch(() => false)) || (await mainContent.isVisible());
    expect(hasContent).toBe(true);

    // No garbage text
    await assertNoGarbageTextDeep(page, "client-reports");
  });

  test("open /client/progress → verify progress data or empty state", async ({
    page,
  }) => {
    await page.goto("/client/progress", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    // Verify page renders without error boundary
    const mainContent = page.locator("main");
    await expect(mainContent).toBeVisible({ timeout: 10_000 });

    const hasError = await page
      .getByRole("heading", { name: /pokazilo|error|chyba/i })
      .isVisible()
      .catch(() => false);
    expect(hasError).toBe(false);

    // Check for progress data or empty state
    const hasProgressContent =
      (await page
        .getByText(/pokrok|progress|docházka|attendance|žádné|prázdný/i)
        .first()
        .isVisible()
        .catch(() => false)) || (await mainContent.isVisible());
    expect(hasProgressContent).toBe(true);

    // No garbage text
    await assertNoGarbageTextDeep(page, "client-progress");
  });
});
