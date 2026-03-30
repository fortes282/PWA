/**
 * Pure helpers for {@link OnboardingChecklist}.
 *
 * The checklist now only cares about push notification permission.
 * These helpers are kept for backward compatibility with any tests
 * referencing them, but the component itself handles permission checks inline.
 */

/** Check if push notifications are enabled (permission granted in the browser). */
export function isPushPermissionGranted(): boolean {
  if (typeof globalThis.Notification === "undefined") return false;
  return globalThis.Notification.permission === "granted";
}
