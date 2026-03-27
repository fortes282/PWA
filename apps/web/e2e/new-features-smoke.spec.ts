/**
 * E2E: Smoke testy pro nové a refaktorované stránky
 * Ověřuje, že každá stránka renderuje skutečný obsah (ne prázdnou stránku).
 *
 * Strategie: navigate → networkidle → assert <main> has 20+ chars → assert specific heading/element
 */
import { test, expect } from "@playwright/test";
import { ADMIN_AUTH_FILE, EMPLOYEE_AUTH_FILE, CLIENT_AUTH_FILE } from "./helpers";

// ---------------------------------------------------------------------------
// Helper: ověří, že <main> obsahuje neprázdný textový obsah (min 20 znaků)
// Polluje až 15s — čeká na client-side hydrataci
// ---------------------------------------------------------------------------
async function assertMainHasContent(page: import("@playwright/test").Page) {
  await expect(async () => {
    const mainContent = await page.locator("main").textContent();
    expect(mainContent?.trim().length).toBeGreaterThan(20);
  }).toPass({ timeout: 15000 });
}

// ---------------------------------------------------------------------------
// ADMIN stránky
// ---------------------------------------------------------------------------
test.describe("Admin — nové stránky", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("vouchery — stránka zobrazuje správce dárkových voucherů", async ({ page }) => {
    await page.goto("/admin/vouchers");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /dárkové vouchery|vouchery/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /nový voucher/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("heatmap — stránka zobrazuje vytíženost místností", async ({ page }) => {
    await page.goto("/admin/heatmap");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /vytíženost|místností/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("off-peak — stránka zobrazuje slevy mimo špičku", async ({ page }) => {
    await page.goto("/admin/off-peak");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /slevy|mimo špičku/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("corporate — stránka zobrazuje firemní wellness", async ({ page }) => {
    await page.goto("/admin/corporate");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /firemní|wellness/i })
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// EMPLOYEE stránky
// ---------------------------------------------------------------------------
test.describe("Employee — nové stránky", () => {
  test.use({ storageState: EMPLOYEE_AUTH_FILE });

  test("session-templates — stránka zobrazuje šablony poznámek", async ({ page }) => {
    await page.goto("/employee/session-templates");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /šablony|poznámek/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("exercise-library — stránka zobrazuje knihovnu cvičení", async ({ page }) => {
    await page.goto("/employee/exercise-library");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /knihovna|cvičení/i })
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// CLIENT stránky
// ---------------------------------------------------------------------------
test.describe("Client — nové stránky", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("achievements — stránka zobrazuje úspěchy klienta", async ({ page }) => {
    await page.goto("/client/achievements");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /úspěchy|achievements/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test("credits — stránka zobrazuje finance a quick-links", async ({ page }) => {
    await page.goto("/client/credits");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByText(/finance|kredit|zůstatek/i).first()
    ).toBeVisible({ timeout: 15000 });
    // Quick-links sekce
    await expect(
      page.getByText(/faktury|balíčky/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("progress — stránka zobrazuje pokrok a quick-links", async ({ page }) => {
    await page.goto("/client/progress");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByText(/pokrok|progres/i).first()
    ).toBeVisible({ timeout: 15000 });
    // Quick-links sekce
    await expect(
      page.getByText(/terapeutické zprávy|dotazníky/i).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// Refaktorované SETTINGS stránky (client role)
// ---------------------------------------------------------------------------
test.describe("Settings — refaktorované stránky", () => {
  test.use({ storageState: CLIENT_AUTH_FILE });

  test("settings — hlavní stránka zobrazuje navigaci", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /nastavení/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/zabezpečení/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/notifikace/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("settings/security — stránka zobrazuje formulář pro změnu hesla", async ({ page }) => {
    await page.goto("/settings/security");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByRole("heading", { name: /zabezpečení/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/změna hesla/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByLabel(/aktuální heslo/i)
    ).toBeVisible({ timeout: 15000 });
  });

  test("settings/notifications — stránka zobrazuje nastavení notifikací", async ({ page }) => {
    await page.goto("/settings/notifications");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);
    await expect(
      page.getByText(/email notifikace|sms notifikace/i).first()
    ).toBeVisible({ timeout: 15000 });
  });
});

// ---------------------------------------------------------------------------
// TOGGLE — vizuální regrese (kulička uvnitř kontejneru, ne přetečení)
// ---------------------------------------------------------------------------
test.describe("Toggle switch — vizuální správnost", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("admin/settings — toggle kulička je uvnitř kontejneru v obou stavech", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");
    await assertMainHasContent(page);

    // Najdi všechny toggle kontejnery (w-12 h-6 rounded-full)
    const toggles = page.locator("button.rounded-full").filter({ has: page.locator("span.rounded-full") });
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const toggle = toggles.nth(i);
      const knob = toggle.locator("span.rounded-full");

      const toggleBox = await toggle.boundingBox();
      const knobBox = await knob.boundingBox();

      if (!toggleBox || !knobBox) continue;

      // Kulička musí být CELÁ uvnitř kontejneru
      expect(knobBox.x).toBeGreaterThanOrEqual(toggleBox.x);
      expect(knobBox.x + knobBox.width).toBeLessThanOrEqual(toggleBox.x + toggleBox.width + 1); // 1px tolerance
      expect(knobBox.y).toBeGreaterThanOrEqual(toggleBox.y);
      expect(knobBox.y + knobBox.height).toBeLessThanOrEqual(toggleBox.y + toggleBox.height + 1);
    }
  });
});
