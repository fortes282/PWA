import { describe, it, expect, vi } from "vitest";
import { isPushPermissionGranted } from "./onboarding-checklist-logic";

describe("isPushPermissionGranted", () => {
  it("returns false when Notification API is unavailable", () => {
    // In a test environment Notification is typically not defined
    const original = (globalThis as any).Notification;
    delete (globalThis as any).Notification;
    expect(isPushPermissionGranted()).toBe(false);
    if (original) (globalThis as any).Notification = original;
  });

  it("returns true when permission is granted", () => {
    const original = (globalThis as any).Notification;
    (globalThis as any).Notification = { permission: "granted" };
    expect(isPushPermissionGranted()).toBe(true);
    if (original) {
      (globalThis as any).Notification = original;
    } else {
      delete (globalThis as any).Notification;
    }
  });

  it("returns false when permission is default", () => {
    const original = (globalThis as any).Notification;
    (globalThis as any).Notification = { permission: "default" };
    expect(isPushPermissionGranted()).toBe(false);
    if (original) {
      (globalThis as any).Notification = original;
    } else {
      delete (globalThis as any).Notification;
    }
  });

  it("returns false when permission is denied", () => {
    const original = (globalThis as any).Notification;
    (globalThis as any).Notification = { permission: "denied" };
    expect(isPushPermissionGranted()).toBe(false);
    if (original) {
      (globalThis as any).Notification = original;
    } else {
      delete (globalThis as any).Notification;
    }
  });
});
