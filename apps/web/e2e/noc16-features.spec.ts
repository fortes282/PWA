import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Messages — přímé zprávy", () => {
  test("RECEPTION vidí /messages stránku s Inbox záložkou", async ({ page }) => {
    await login(page, "reception");
    await page.goto("/messages");
    await expect(page.getByText(/inbox|doručené/i).first()).toBeVisible();
  });

  test("Messages stránka má Compose / Napsat tlačítko", async ({ page }) => {
    await login(page, "reception");
    await page.goto("/messages");
    await expect(page.getByRole("button", { name: /compose|napsat|nová zpráva/i })).toBeVisible();
  });
});

test.describe("Employee clients", () => {
  test("EMPLOYEE vidí /employee/clients stránku", async ({ page }) => {
    await login(page, "employee");
    await page.goto("/employee/clients");
    await expect(page).toHaveURL(/\/employee\/clients/);
    // Page should load without error
    await expect(page.locator("main, [data-testid=main]").first()).toBeVisible();
  });
});

test.describe("iCal export button", () => {
  test("Recepce vidí iCal tlačítko v termínech", async ({ page }) => {
    await login(page, "reception");
    await page.goto("/reception/appointments");
    await expect(page.getByText(/ical|\.ics/i)).toBeVisible();
  });
});

test.describe("Admin Audit Log", () => {
  test("Admin vidí v /admin/background záložku s auditem", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/background");
    // Should have some log/audit related tab or section
    await expect(page.getByText(/audit|log/i).first()).toBeVisible();
  });
});
