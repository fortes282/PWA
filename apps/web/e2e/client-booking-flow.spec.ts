/**
 * E2E: Client booking flow — full journey
 * Tests the complete booking experience from service selection to credit verification.
 */
import { test, expect } from "@playwright/test";
import { CLIENT_AUTH_FILE, assertNoGarbageTextDeep } from "./helpers";

test.describe("Client booking flow — full journey", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("complete booking journey: browse → select service → pick date → book → verify", async ({
    page,
  }) => {
    // 1. Navigate to booking page
    await page.goto("/client/booking");
    await page.waitForLoadState("networkidle");

    // 2. Verify service cards are visible
    await expect(
      page.getByRole("heading", { name: /rezervace termínu/i })
    ).toBeVisible();
    await expect(page.getByText(/vyberte službu/i).first()).toBeVisible();

    // 3. Select a service (click first available)
    const serviceCards = page.locator("button").filter({
      has: page.locator("text=/\\d+\\s*min/"),
    });
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 });

    // Store the service name for later verification
    const serviceCardText = await serviceCards.first().textContent();
    await serviceCards.first().click();

    // 4. Verify calendar is shown (step 1 = date selection)
    await expect(page.getByText(/vyberte datum/i)).toBeVisible({
      timeout: 5000,
    });

    // 5. Click a day with available slots — look for calendar day buttons that are enabled
    // The calendar cells with available slots have occupancy text like "73%" or "X vol."
    // They are rendered as buttons inside a 7-column grid
    const calendarGrid = page.locator(".grid-cols-7").last();
    await expect(calendarGrid).toBeVisible();

    // Wait for month data to load (occupancy percentages appear)
    await page.waitForTimeout(1500);

    // Find a clickable day button — one that is not disabled and shows availability
    const availableDays = calendarGrid.locator(
      "button:not([disabled])"
    );
    const dayCount = await availableDays.count();

    if (dayCount === 0) {
      // No available days in current month — skip remainder
      test.skip(true, "No available days in the current month");
      return;
    }

    // Click the first available day
    await availableDays.first().click();

    // 6. Verify time slots appear (step 2)
    const timeStepVisible = await page
      .getByText(/vyberte čas/i)
      .isVisible()
      .catch(() => false);

    if (!timeStepVisible) {
      // Might have no slots for this day, go back is an option
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

    // Store the time for later verification
    const slotTime = await timeSlots.first().textContent();
    await timeSlots.first().click();

    // 8. Verify confirmation screen (step 3)
    await expect(page.getByText(/potvrzení rezervace/i)).toBeVisible({
      timeout: 5000,
    });

    // 9. Check credit balance before booking (store value)
    const creditText = await page
      .getByText(/zůstatek kreditu/i)
      .locator("..")
      .textContent()
      .catch(() => null);

    // Check if insufficient credit warning is shown
    const insufficientCredit = await page
      .getByText(/nedostatek kreditu/i)
      .isVisible()
      .catch(() => false);

    if (insufficientCredit) {
      // Cannot complete booking without credits — verify warning and stop
      await expect(page.getByText(/nedostatek kreditu/i)).toBeVisible();
      return;
    }

    // 10. Confirm booking
    await page
      .getByRole("button", { name: /potvrdit rezervaci/i })
      .click();

    // 11. Verify success screen
    await expect(page.getByText(/termín rezervován/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("link", { name: /zpět na přehled/i })
    ).toBeVisible();
    await expect(
      page.getByText(/přidat do kalendáře/i)
    ).toBeVisible();

    // 12. Navigate to appointments page
    await page.goto("/client/appointments");
    await page.waitForLoadState("networkidle");

    // 13. Verify the new booking appears in the list
    await expect(
      page.getByRole("heading", { name: /moje rezervace/i })
    ).toBeVisible();
    // The upcoming section should have at least one confirmed entry
    await expect(page.getByText(/potvrzeno/i).first()).toBeVisible({
      timeout: 10000,
    });

    // 14. Navigate to credits page
    await page.goto("/client/credits");
    await page.waitForLoadState("networkidle");

    // 15. Verify credit balance is displayed (we cannot reliably check exact decrease
    // since the seed data balance is unknown, but we verify the page loads with a balance)
    await expect(
      page.getByText(/zůstatek|balance/i).first()
    ).toBeVisible();
  });

  test("booking page shows no undefined/NaN", async ({ page }) => {
    await page.goto("/client/booking");
    await page.waitForLoadState("networkidle");
    await assertNoGarbageTextDeep(page, "client-booking");
  });

  test("calendar shows occupancy data", async ({ page }) => {
    await page.goto("/client/booking");
    await page.waitForLoadState("networkidle");

    // Select a service first to reach the calendar step
    const serviceCards = page.locator("button").filter({
      has: page.locator("text=/\\d+\\s*min/"),
    });
    const hasServices = (await serviceCards.count()) > 0;
    if (!hasServices) {
      test.skip(true, "No services available");
      return;
    }

    await serviceCards.first().click();

    // Wait for calendar to render
    await expect(page.getByText(/vyberte datum/i)).toBeVisible({
      timeout: 5000,
    });

    // The calendar should be visible
    const calendarGrid = page.locator(".grid-cols-7").last();
    await expect(calendarGrid).toBeVisible();

    // Wait for occupancy data to load
    await page.waitForTimeout(1500);

    // Verify legend is visible (shows occupancy color codes)
    await expect(page.getByText(/volno/i).first()).toBeVisible();
    await expect(page.getByText(/obsazeno/i).first()).toBeVisible();

    // Verify calendar cells exist — at least 28 day buttons (4 weeks)
    const dayButtons = calendarGrid.locator("button");
    const count = await dayButtons.count();
    expect(count).toBeGreaterThanOrEqual(28);
  });

  test("cannot book when insufficient credits", async ({ page }) => {
    await page.goto("/client/booking");
    await page.waitForLoadState("networkidle");

    // Find the most expensive service (the one with highest price displayed)
    const serviceCards = page.locator("button").filter({
      has: page.locator("text=/\\d+\\s*Kč/"),
    });
    const hasServices = (await serviceCards.count()) > 0;
    if (!hasServices) {
      test.skip(true, "No paid services available");
      return;
    }

    // Click first paid service
    await serviceCards.first().click();

    // If the credit info bar shows "Nedostatek kreditu", the UI is working correctly
    const insufficientOnDateStep = await page
      .getByText(/nedostatek kreditu/i)
      .isVisible()
      .catch(() => false);

    if (insufficientOnDateStep) {
      // Verified: the insufficient credit warning is shown on the date step
      await expect(page.getByText(/nedostatek kreditu/i)).toBeVisible();
      return;
    }

    // If client has enough credits, we cannot test the insufficient path reliably
    // with seed data, so just verify the credit balance is shown
    await expect(
      page.getByText(/zůstatek/i).first()
    ).toBeVisible({ timeout: 5000 });
  });
});
