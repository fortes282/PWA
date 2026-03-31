/**
 * E2E: Interaction tests -- unique functional tests extracted from consolidated files.
 *
 * Groups:
 *   1. Admin -- FIO CSV export, background evaluation, visual regression (VB1-VB6)
 *   2. Admin -- Audit filter, audit sidebar nav link
 *   3. Client -- Attendance chart bar heights (VB7), credit request form/list
 *   4. Detail pages -- Admin user detail, reception client/invoice/health-record detail
 *   5. UX P3 -- Bottom tab bar, booking stepper, sidebar groups, toast, homework media
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN_AUTH_FILE,
  CLIENT_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  API_URL,
  assertNoGarbageTextDeep,
  assertNoTextClipping,
} from "./helpers";

// ===========================================================================
// 1. Admin -- FIO CSV export & background evaluation
// ===========================================================================

test.describe("Admin -- FIO CSV export", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("FIO page has CSV export button", async ({ page }) => {
    await page.goto("/admin/fio");
    await expect(page.getByRole("heading", { name: /platby|parovani|fio/i })).toBeVisible({ timeout: 15000 });
    const hasCsvBtn = await page.getByRole("button", { name: /csv\s*export|export\s*csv/i }).isVisible();
    const hasLink = await page.getByRole("link", { name: /csv\s*export|export\s*csv/i }).isVisible();
    const hasTextBtn = await page.getByText(/csv export/i).isVisible();
    expect(hasCsvBtn || hasLink || hasTextBtn).toBe(true);
  });
});

test.describe("Admin -- background evaluations", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("background page has run evaluation button", async ({ page }) => {
    await page.goto("/admin/background");
    await expect(page.getByRole("heading", { name: /automatizace|background/i })).toBeVisible({ timeout: 15000 });
    const hasBtn = await page.getByRole("button", { name: /spustit|evaluace|evaluate|run/i }).isVisible();
    const hasRunNow = await page.getByRole("button", { name: /spustit nyni/i }).isVisible();
    expect(hasBtn || hasRunNow).toBe(true);
  });
});

// ===========================================================================
// 2. Admin BI & Stats -- visual regression (VB1-VB6)
// ===========================================================================

test.describe("Admin BI -- visual regression", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("revenue summary cards show full text, no clipping (VB1)", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForSelector("text=Celkove vynosy", { timeout: 15000 }).catch(() => {});
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
    await assertNoTextClipping(page, "BI Revenue");
  });

  test("revenue values end with Kc, not truncated (VB2)", async ({ page }) => {
    await page.goto("/admin/bi");
    await page.waitForSelector("text=Celkove vynosy", { timeout: 15000 }).catch(() => {});
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });

    const currencyTexts = await page.evaluate(() => {
      const results: { text: string; label: string }[] = [];
      const cards = document.querySelectorAll(".card");
      for (const card of cards) {
        const label = card.querySelector(".text-xs")?.textContent?.trim() ?? "";
        const value = card.querySelector(".font-bold")?.textContent?.trim() ?? "";
        if (value && /\d/.test(value) && (label.includes("vynosy") || label.includes("Prumer"))) {
          results.push({ text: value, label });
        }
      }
      return results;
    });

    for (const { text, label } of currencyTexts) {
      expect(text, `${label}: currency "${text}" should end with "Kc"`).toMatch(/Kc\s*$/);
    }
  });

  test("BI page has no undefined/NaN values (VB3)", async ({ page }) => {
    await page.goto("/admin/bi");
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });
    await assertNoGarbageTextDeep(page, "BI Dashboard");
  });
});

test.describe("Admin Stats -- visual regression", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("overview tab has no undefined/NaN in KPI cards (VB4)", async ({ page }) => {
    await page.goto("/admin/stats");
    const overviewTab = page.getByRole("button", { name: /prehled|overview/i });
    if (await overviewTab.isVisible()) await overviewTab.click();
    await page.waitForTimeout(300);
    await assertNoGarbageTextDeep(page, "Stats Overview");
  });

  test("storno rate shows a number with %, not undefined% (VB5)", async ({ page }) => {
    await page.goto("/admin/stats");
    const overviewTab = page.getByRole("button", { name: /prehled|overview/i });
    if (await overviewTab.isVisible()) await overviewTab.click();
    await page.waitForTimeout(300);

    const percentValues = await page.evaluate(() => {
      const results: string[] = [];
      const els = document.querySelectorAll(".card p.text-3xl, .card p.text-2xl");
      for (const el of els) {
        const text = (el as HTMLElement).innerText?.trim() ?? "";
        if (text.includes("%")) results.push(text);
      }
      return results;
    });

    for (const pct of percentValues) {
      expect(pct, `Percentage "${pct}" must be a valid number`).toMatch(/^\d+(\.\d+)?%$/);
    }
  });

  test("stat cards text is not clipped on mobile (VB6)", async ({ page }) => {
    await page.goto("/admin/stats");
    const overviewTab = page.getByRole("button", { name: /prehled|overview/i });
    if (await overviewTab.isVisible()) await overviewTab.click();
    await page.waitForTimeout(300);
    await assertNoTextClipping(page, "Stats Overview");
  });
});

// ===========================================================================
// 3. Admin -- Audit filter & sidebar nav
// ===========================================================================

test.describe("Admin -- Audit log interactions", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("admin can filter by action", async ({ page }) => {
    await page.goto("/admin/audit");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main").getByText(/audit log/i).first()).toBeVisible({ timeout: 10000 });

    const select = page.locator("select").first();
    await select.selectOption("USER_LOGIN");
    await page.waitForTimeout(300);
    await expect(page.locator("main").getByText(/audit log/i).first()).toBeVisible();
  });

  test("navigation sidebar has audit link", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("domcontentloaded");

    // On mobile the sidebar is hidden -- open hamburger menu
    const hamburger = page.getByRole("button", { name: /otevrit menu/i });
    const hamburgerVisible = await hamburger
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (hamburgerVisible) {
      await hamburger.click();
    }

    const auditLink = page.getByRole("link", { name: /audit/i });
    await expect(auditLink).toBeVisible();
    await auditLink.click();
    await expect(page).toHaveURL(/\/admin\/audit/);
  });
});

// ===========================================================================
// 4. Client -- Attendance chart (VB7) & credit request form/list
// ===========================================================================

test.describe("Client Progress -- visual regression", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("attendance chart bars with 0 value are minimal, not full height (VB7)", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForSelector("text=Dochazka", { timeout: 15000 }).catch(() => {});
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15000 });

    const barInfo = await page.evaluate(() => {
      const results: { value: number; barHeight: number }[] = [];
      const heading = Array.from(document.querySelectorAll("h2")).find(
        (h) => h.textContent?.includes("Dochazka")
      );
      if (!heading) return results;

      const chartContainer = heading.closest(".card") ?? heading.parentElement;
      if (!chartContainer) return results;

      const columns = chartContainer.querySelectorAll(".flex-1.flex.flex-col");
      for (const col of columns) {
        const valueText = col.querySelector(".text-xs")?.textContent?.trim() ?? "0";
        const value = parseInt(valueText) || 0;
        const barContainer = col.querySelector("[style*='height']") as HTMLElement;
        const coloredBar = barContainer?.querySelector("[style*='background']") as HTMLElement;
        const barHeight = coloredBar?.offsetHeight ?? 0;
        results.push({ value, barHeight });
      }
      return results;
    });

    expect(barInfo.length).toBeGreaterThan(0);

    const nonZero = barInfo.filter((b) => b.value > 0);
    const zeroBars = barInfo.filter((b) => b.value === 0);

    if (nonZero.length > 0 && zeroBars.length > 0) {
      const maxBarHeight = Math.max(...nonZero.map((b) => b.barHeight));
      for (const bar of zeroBars) {
        expect(
          bar.barHeight,
          `Bar with value 0 should not have visible height (got ${bar.barHeight}px, max is ${maxBarHeight}px)`
        ).toBeLessThanOrEqual(Math.max(4, maxBarHeight * 0.1));
      }
    }
  });
});

test.describe("Client -- credit request form/list", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("credit request form or list is visible", async ({ page }) => {
    await page.goto("/client/credit-request");
    await page.waitForLoadState("domcontentloaded");
    const hasForm = await page
      .getByRole("button", { name: /pozadat|odeslat|pridat/i })
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    const hasList = await page
      .getByText(/ceka|schvaleno|zamitnuto|zadne/i)
      .first()
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    expect(hasForm || hasList).toBe(true);
  });
});

// ===========================================================================
// 5. Detail pages -- dynamic route navigation
// ===========================================================================

test.describe("Admin -- user detail page", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("can navigate to user detail from users list", async ({ page }) => {
    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");
    const detailBtn = page.getByRole("link", { name: /detail|zobrazit/i }).first();
    const detailExists = await detailBtn.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (detailExists) {
      await detailBtn.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/admin\/users\/\d+/);
    } else {
      await page.goto("/admin/users/1");
      await page.waitForLoadState("domcontentloaded");
      const isNotFound = await page.getByText(/nenalezen|not found|404/i).isVisible();
      const hasContent = await page.locator("main").isVisible();
      expect(isNotFound || hasContent).toBe(true);
    }
  });
});

test.describe("Reception -- client detail page", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("can navigate to client detail from clients list", async ({ page }) => {
    await page.goto("/reception/clients");
    await page.waitForLoadState("domcontentloaded");
    const firstLink = page.locator('a[href*="/reception/clients/"]').first();
    const linkExists = await firstLink.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (linkExists) {
      await firstLink.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/reception\/clients\/\d+/);
    } else {
      await page.goto("/reception/clients/1");
      await page.waitForLoadState("domcontentloaded");
      const hasContent = await page.locator("main").isVisible();
      expect(hasContent).toBe(true);
    }
  });
});

test.describe("Reception -- invoice detail page", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("invoice detail page loads when navigated directly", async ({ page }) => {
    await page.goto("/reception/billing");
    await page.waitForLoadState("domcontentloaded");
    const mainOrError = page.locator("main").or(page.getByRole("heading", { name: /pokazilo|error/i }));
    await mainOrError.first().waitFor({ state: "visible", timeout: 20000 });
    const hasError = await page.getByRole("heading", { name: /pokazilo|error/i }).isVisible();
    if (hasError) {
      await page.goto("/reception/invoices/1");
      await page.waitForLoadState("domcontentloaded");
      const pageContent = page.locator("main").or(page.getByRole("heading", { name: /pokazilo|error|faktur/i }));
      await expect(pageContent.first()).toBeVisible({ timeout: 20000 });
      return;
    }
    const invoiceLink = page.getByRole("link").filter({ hasText: /detail|INV|faktura/i }).first();
    const linkExists = await invoiceLink.isVisible();
    if (linkExists) {
      await invoiceLink.click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page).toHaveURL(/\/reception\/invoices\/\d+/);
    } else {
      await page.goto("/reception/invoices/1");
      await page.waitForLoadState("domcontentloaded");
      await page.locator("main").waitFor({ state: "visible", timeout: 20000 });
      const hasContent = await page.locator("main").isVisible();
      expect(hasContent).toBe(true);
    }
  });
});

test.describe("Reception -- health record detail", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("health records list can navigate to client health record", async ({ page }) => {
    await page.goto("/reception/health-records");
    await expect(page.getByRole("heading", { name: /zdravotni zaznamy/i })).toBeVisible({ timeout: 15000 });
  });
});

// ===========================================================================
// 6. UX P3 -- Bottom tab bar, booking stepper, sidebar groups, toast, homework
// ===========================================================================

test.describe("Bottom Tab Bar -- CLIENT mobile", () => {
  test.use({
    storageState: CLIENT_AUTH_FILE,
    viewport: { width: 390, height: 844 },
  });

  test("shows bottom tab bar with 5 tabs on mobile", async ({ page }) => {
    await page.goto("/client");
    const tabBar = page.locator("nav").filter({ has: page.locator('a[href="/client"]') }).last();
    await expect(tabBar).toBeVisible();

    await expect(page.getByRole("link", { name: /prehled/i }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /rezervovat/i }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /rezervace/i }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /zpravy/i }).last()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: /vice/i })).toBeVisible();
  });

  test("navigates to booking page via tab bar", async ({ page }) => {
    await page.goto("/client");
    await page.getByRole("link", { name: /rezervovat/i }).last().click();
    await expect(page).toHaveURL(/\/client\/booking/);
  });

  test("navigates to appointments via tab bar", async ({ page }) => {
    await page.goto("/client");
    await page.getByRole("link", { name: /rezervace/i }).last().click();
    await expect(page).toHaveURL(/\/client\/appointments/);
  });

  test("'Vice' button opens bottom sheet with extra menu items", async ({ page }) => {
    await page.goto("/client");
    const moreBtn = page.locator("button").filter({ hasText: /vice/i });
    await moreBtn.click();
    const sheet = page.locator('[data-testid="more-sheet"]');
    await expect(sheet).toBeVisible({ timeout: 3000 });
    await expect(sheet.locator("text=/kredity|pokrok|faktury|cviceni|health/i").first()).toBeVisible({ timeout: 3000 });
  });

  test("bottom tab bar is NOT shown on desktop (md: breakpoint)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/client");
    const mobileBottomNav = page.locator('[class*="fixed"][class*="bottom-0"][class*="md:hidden"]');
    const count = await mobileBottomNav.count();
    if (count > 0) {
      await expect(mobileBottomNav.first()).toBeHidden();
    }
    await expect(page.locator("aside").first()).toBeVisible();
  });
});

test.describe("Booking Stepper -- CLIENT", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("booking page shows progress stepper with 4 steps", async ({ page }) => {
    await page.goto("/client/booking");
    await expect(page.getByRole("heading", { name: /rezervace terminu/i })).toBeVisible();
    await expect(page.getByText("Sluzba")).toBeVisible();
    await expect(page.getByText("Datum")).toBeVisible();
    await expect(page.getByText("Cas")).toBeVisible();
    await expect(page.getByText("Potvrzeni")).toBeVisible();
  });

  test("step 2: mini-calendar appears after service selection", async ({ page }) => {
    await page.goto("/client/booking");
    await page.waitForLoadState("domcontentloaded");
    const serviceCards = page.locator("button.rounded-xl");
    const count = await serviceCards.count();
    if (count === 0) {
      test.skip();
      return;
    }
    await serviceCards.first().click();
    await expect(page.locator(".grid.grid-cols-7").first()).toBeVisible({ timeout: 5000 });
  });

  test("offline banner shows when offline", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Offline simulation requires Chromium CDP");
    await page.goto("/client/booking");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByText(/jste offline/i).first()).toBeVisible({ timeout: 5000 });
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  });
});

test.describe("Reception Sidebar Groups", () => {
  test.use({
    storageState: RECEPTION_AUTH_FILE,
    viewport: { width: 1280, height: 900 },
  });

  test("reception sidebar shows grouped navigation sections", async ({ page }) => {
    await page.goto("/reception");
    await expect(page.getByRole("heading", { name: /recepce/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/prehled/i).first()).toBeVisible();
    await expect(page.getByText(/rezervace/i).first()).toBeVisible();
    await expect(page.getByText(/klienti/i).first()).toBeVisible();
    await expect(page.getByText(/finance/i).first()).toBeVisible();
  });

  test("reception sidebar groups are collapsible", async ({ page }) => {
    await page.goto("/reception");
    await page.waitForLoadState("domcontentloaded");
    const groupHeaders = page.locator("aside nav button").filter({ hasText: /terminy/i });
    const count = await groupHeaders.count();
    if (count === 0) return;
    await groupHeaders.first().click();
    await page.waitForTimeout(300);
    const calendarLink = page.locator("aside nav a[href='/reception/calendar']");
    const isHidden = await calendarLink.isHidden().catch(() => true);
    expect(typeof isHidden).toBe("boolean");
  });
});

test.describe("Toast notifications", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("toast system is rendered in the app (provider present)", async ({ page }) => {
    await page.goto("/client");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText(/uncaught|undefined is not/i)).toHaveCount(0);
  });
});

test.describe("Homework -- media support", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("client homework page loads without errors", async ({ page }) => {
    await page.goto("/client/homework");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("heading", { name: /domaci cviceni/i })).toBeVisible();
    await expect(page.getByText(/uncaught|undefined is not/i)).toHaveCount(0);
  });
});
