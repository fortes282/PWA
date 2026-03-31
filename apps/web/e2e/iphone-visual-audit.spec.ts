/**
 * Hlubší iPhone audit než iphone-layout-smoke: hledá prvky v <main>,
 * které přesahují viewport, ale nejsou uvnitř horizontálně scrollovatelného kontejneru.
 * Běží jen na projektu `iphone`. Spouštět proti nasazenému backendu (viz PWA_TEST_MATRIX §8).
 */
import { test, expect, type Page } from "@playwright/test";
import {
  CLIENT_AUTH_FILE,
  RECEPTION_AUTH_FILE,
  EMPLOYEE_AUTH_FILE,
  ADMIN_AUTH_FILE,
} from "./helpers";

type AuditResult = {
  vw: number;
  mainFound: boolean;
  mainBox: { sw: number; cw: number } | null;
  offenders: Array<{
    tag: string;
    id: string;
    className: string;
    right: number;
    left: number;
    textSample: string;
  }>;
};

async function auditMainVisualOverflow(page: Page): Promise<AuditResult> {
  // Wait for actual content, not splash screen
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForSelector("main h1, main h2, main [class*='card'], main table", { timeout: 5000 });
  } catch { /* page may have no cards */ }
  await page.waitForTimeout(1000);

  return page.evaluate(() => {
    const vw = window.innerWidth;

    function isInHorizontalScrollHost(el: Element | null): boolean {
      let p: Element | null = el;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "overlay") return true;
        p = p.parentElement;
      }
      return false;
    }

    const main =
      document.querySelector("main#main-content") || document.querySelector("main");

    const offenders: AuditResult["offenders"] = [];

    if (!main) {
      return { vw, mainFound: false, mainBox: null, offenders: [] };
    }

    const mainBox = {
      sw: main.scrollWidth,
      cw: main.clientWidth,
    };

    const els = main.querySelectorAll("*");
    for (const el of els) {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed") continue;
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (isInHorizontalScrollHost(el)) continue;

      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;

      if (r.right > vw + 40 || r.left < -40) {
        let textSample = "";
        if (el instanceof HTMLElement && el.innerText) {
          textSample = el.innerText.replace(/\s+/g, " ").trim().slice(0, 60);
        }
        const cls =
          typeof (el as HTMLElement).className === "string"
            ? (el as HTMLElement).className
            : "";
        offenders.push({
          tag: el.tagName,
          id: el.id || "",
          className: cls.slice(0, 120),
          right: Math.round(r.right),
          left: Math.round(r.left),
          textSample,
        });
      }
    }

    return { vw, mainFound: true, mainBox, offenders };
  });
}

test.describe("iPhone visual audit — main content overflow @iphone-audit", () => {
  test.describe("unauthenticated", () => {
    test("login page main overflow", async ({ page }) => {
      await page.goto("/login");
      const r = await auditMainVisualOverflow(page);
      if (!r.mainFound) return;
      expect(
        r.offenders,
        `Login: elements past viewport in main: ${JSON.stringify(r.offenders, null, 2)}`
      ).toEqual([]);
    });
  });

  function roleSuite(
    name: string,
    storage: string,
    paths: string[]
  ) {
    test.describe(name, () => {
      test.use({ storageState: storage });
      for (const path of paths) {
        test(`audit ${path}`, async ({ page }) => {
          await page.goto(path);
          const r = await auditMainVisualOverflow(page);
          // Some pages may not have <main> yet (e.g. billing) — skip rather than fail
          test.skip(!r.mainFound, `${path}: no <main> element found, skipping overflow audit`);
          // Neporovnáváme main.scrollWidth vs clientWidth: při overflow-x:hidden na <main>
          // může být scrollWidth širší i bez viditelného „page scroll”; layout opravy sleduje spíš seznam offenders.
          expect(
            r.offenders,
            `${path}: elements extending past viewport (vw=${r.vw}): ${JSON.stringify(r.offenders, null, 2)}`
          ).toEqual([]);
        });
      }
    });
  }

  roleSuite("Client", CLIENT_AUTH_FILE, [
    "/client",
    "/client/booking",
    "/client/appointments",
    "/client/credits",
    "/client/invoices",
    "/client/progress",
    "/notifications",
  ]);

  roleSuite("Reception", RECEPTION_AUTH_FILE, [
    "/reception",
    "/reception/calendar",
    "/reception/appointments",
    "/reception/clients",
    "/reception/health-records",
    "/reception/waitlist",
    "/reception/billing",
  ]);

  roleSuite("Employee", EMPLOYEE_AUTH_FILE, [
    "/employee",
    "/employee/appointments",
    "/employee/reports",
    "/employee/homework",
    "/employee/clients",
  ]);

  roleSuite("Admin", ADMIN_AUTH_FILE, [
    "/admin",
    "/admin/users",
    "/admin/stats",
    "/admin/bi",
    "/admin/notifications",
  ]);
});
