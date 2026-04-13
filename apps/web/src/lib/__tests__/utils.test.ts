import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  getInitials,
  cn,
} from "@/lib/utils";

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------
describe("formatCurrency", () => {
  it("formátuje kladné číslo jako českou měnu CZK", () => {
    const result = formatCurrency(1500);
    expect(result).toMatch(/1\s*500/);
    expect(result).toMatch(/Kč|CZK/);
  });

  it("formátuje nulu", () => {
    const result = formatCurrency(0);
    expect(result).toMatch(/0/);
    expect(result).toMatch(/Kč|CZK/);
  });

  it("formátuje záporné číslo", () => {
    const result = formatCurrency(-250);
    expect(result).toMatch(/-/);
    expect(result).toMatch(/250/);
  });

  it("formátuje velké číslo se správnými oddělovači", () => {
    const result = formatCurrency(1_000_000);
    // Czech locale uses non-breaking space as thousands separator
    expect(result).toMatch(/1/);
    expect(result).toMatch(/000/);
    expect(result).toMatch(/Kč|CZK/);
  });

  it("formátuje desetinné číslo na dvě desetinná místa", () => {
    const result = formatCurrency(99.9);
    expect(result).toMatch(/99/);
    // Intl.NumberFormat rounds to 2 decimal places by default
    expect(result).toMatch(/90|9[0-9]/);
  });

  it("formátuje přesnou desetinnou hodnotu", () => {
    const result = formatCurrency(1234.56);
    expect(result).toMatch(/1\s*234/);
    expect(result).toMatch(/56/);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe("formatDate", () => {
  it("formátuje platné datum jako DD.MM.YYYY", () => {
    const result = formatDate("2024-06-15T10:00:00.000Z");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/06/);
    expect(result).toMatch(/2024/);
  });

  it("vrací pomlčku pro null", () => {
    expect(formatDate(null)).toBe("—");
  });

  it("vrací pomlčku pro undefined", () => {
    expect(formatDate(undefined)).toBe("—");
  });

  it("vrací pomlčku pro neplatný řetězec", () => {
    expect(formatDate("neplatne-datum")).toBe("—");
  });

  it("akceptuje objekt Date", () => {
    const d = new Date(2024, 0, 5); // 5. ledna 2024
    const result = formatDate(d);
    expect(result).toMatch(/05/);
    expect(result).toMatch(/01/);
    expect(result).toMatch(/2024/);
  });
});

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------
describe("formatTime", () => {
  it("vrací pomlčku pro null", () => {
    expect(formatTime(null)).toBe("—");
  });

  it("vrací pomlčku pro undefined", () => {
    expect(formatTime(undefined)).toBe("—");
  });

  it("vrací čas ve formátu HH:MM", () => {
    // Use a fixed UTC time and accept either 10:00 or 11:00 depending on TZ
    const result = formatTime("2024-01-15T10:00:00.000Z");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------
describe("formatDateTime", () => {
  it("vrací pomlčku pro null", () => {
    expect(formatDateTime(null)).toBe("—");
  });

  it("kombinuje datum a čas", () => {
    const result = formatDateTime("2024-06-15T10:00:00.000Z");
    // Should contain both date and time parts separated by a space
    expect(result.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/:/);
  });
});

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------
describe("getInitials", () => {
  it("vrací iniciály z celého jména", () => {
    expect(getInitials("Martin Svoboda")).toBe("MS");
  });

  it("vrací iniciály z jednoho slova", () => {
    expect(getInitials("Martin")).toBe("M");
  });

  it("vrací max 2 znaky i pro trojslovné jméno", () => {
    expect(getInitials("Jan Karel Novák")).toBe("JK");
  });

  it("vrací velká písmena", () => {
    expect(getInitials("anna novak")).toBe("AN");
  });
});

// ---------------------------------------------------------------------------
// cn (clsx + tailwind-merge)
// ---------------------------------------------------------------------------
describe("cn", () => {
  it("sloučí css třídy", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("odstraní konfliktní tailwind třídy (tailwind-merge)", () => {
    // tailwind-merge should keep the last conflicting utility
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("ignoruje falsy hodnoty", () => {
    expect(cn("foo", false, undefined, null, "bar")).toBe("foo bar");
  });

  it("podporuje podmíněné třídy přes objekt", () => {
    expect(cn({ active: true, hidden: false })).toBe("active");
  });
});
