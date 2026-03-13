/**
 * Shared helpers for Playwright E2E tests.
 */
import { Page, expect } from "@playwright/test";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Demo credentials matching seed data
export const USERS = {
  admin: { email: "admin@pristav.cz", password: "Admin123!" },
  reception: { email: "recepce@pristav.cz", password: "Recepce123!" },
  employee: { email: "terapeut@pristav.cz", password: "Terapeut123!" },
  client: { email: "klient@pristav.cz", password: "Klient123!" },
};

/**
 * Login via the login page and wait for redirect to dashboard.
 */
export async function login(page: Page, role: keyof typeof USERS) {
  const { email, password } = USERS[role];
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/heslo/i).fill(password);
  await page.getByRole("button", { name: /přihlásit/i }).click();
  // Wait for redirect away from /login
  await expect(page).not.toHaveURL(/\/login/);
}
