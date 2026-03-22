import { test, expect } from "@playwright/test";
import { USERS, RECEPTION_AUTH_FILE, EMPLOYEE_AUTH_FILE, ADMIN_AUTH_FILE } from "./helpers";

test.describe("Messages — přímé zprávy", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("RECEPTION vidí /messages stránku s Inbox záložkou", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByText(/inbox|doručené/i).first()).toBeVisible();
  });

  test("Messages stránka má Compose / Napsat tlačítko", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByRole("button", { name: /compose|napsat|nová zpráva/i })).toBeVisible();
  });
});

test.describe("Employee clients", () => {
  test.use({ storageState: EMPLOYEE_AUTH_FILE });

  test("EMPLOYEE vidí /employee/clients stránku", async ({ page }) => {
    await page.goto("/employee/clients");
    await expect(page).toHaveURL(/\/employee\/clients/);
    // Page should load without error
    await expect(page.locator("main, [data-testid=main]").first()).toBeVisible();
  });
});

test.describe("iCal export button", () => {
  test.use({ storageState: RECEPTION_AUTH_FILE });

  test("Recepce vidí iCal tlačítko v termínech", async ({ page }) => {
    await page.goto("/reception/appointments");
    await expect(page.getByText(/ical|\.ics/i)).toBeVisible();
  });
});

test.describe("Admin Audit Log", () => {
  test.use({ storageState: ADMIN_AUTH_FILE });

  test("Admin vidí v /admin/background záložku s auditem", async ({ page }) => {
    await page.goto("/admin/background");
    // Should have some log/audit related tab or section — scope to main to avoid sidebar
    await expect(page.locator("main").getByText(/audit|log/i).first()).toBeVisible();
  });
});
