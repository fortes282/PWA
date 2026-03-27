/**
 * Pure helpers for {@link OnboardingChecklist} — unit-tested so API shape / field renames don’t silently break UX.
 */

export function appointmentListFromApi(data: unknown): unknown[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (
    typeof data === "object" &&
    data !== null &&
    "items" in data &&
    Array.isArray((data as { items: unknown[] }).items)
  ) {
    return (data as { items: unknown[] }).items;
  }
  return [];
}

export function isHealthRecordCompleteForOnboarding(record: unknown): boolean {
  if (!record || typeof record !== "object") return false;
  const r = record as { allergies?: string | null; primaryDiagnosis?: string | null };
  const a = (r.allergies ?? "").trim();
  const d = (r.primaryDiagnosis ?? "").trim();
  return Boolean(a || d);
}

/** API returns `*Reminders`; legacy checklist used `*Enabled` — accept both. */
export function areNotificationsEnabledForOnboarding(prefs: unknown): boolean {
  if (!prefs || typeof prefs !== "object") return false;
  const p = prefs as {
    emailReminders?: boolean;
    smsReminders?: boolean;
    pushReminders?: boolean;
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    pushEnabled?: boolean;
  };
  return Boolean(
    p.emailReminders ||
      p.smsReminders ||
      p.pushReminders ||
      p.emailEnabled ||
      p.smsEnabled ||
      p.pushEnabled
  );
}
