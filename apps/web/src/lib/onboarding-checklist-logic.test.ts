import { describe, it, expect } from "vitest";
import {
  appointmentListFromApi,
  isHealthRecordCompleteForOnboarding,
  areNotificationsEnabledForOnboarding,
} from "./onboarding-checklist-logic";

describe("appointmentListFromApi", () => {
  it("returns [] for null", () => {
    expect(appointmentListFromApi(null)).toEqual([]);
  });
  it("passes through arrays", () => {
    expect(appointmentListFromApi([{ id: 1 }])).toHaveLength(1);
  });
  it("unwraps paginated { items } from GET /appointments?limit=", () => {
    expect(appointmentListFromApi({ items: [{ id: 1 }], pagination: {} })).toHaveLength(1);
  });
});

describe("isHealthRecordCompleteForOnboarding", () => {
  it("false when empty or missing fields", () => {
    expect(isHealthRecordCompleteForOnboarding(null)).toBe(false);
    expect(isHealthRecordCompleteForOnboarding({})).toBe(false);
    expect(isHealthRecordCompleteForOnboarding({ allergies: "  ", primaryDiagnosis: "" })).toBe(false);
  });
  it("true when allergies or primaryDiagnosis non-empty", () => {
    expect(isHealthRecordCompleteForOnboarding({ allergies: "penicilin" })).toBe(true);
    expect(isHealthRecordCompleteForOnboarding({ primaryDiagnosis: "X" })).toBe(true);
  });
});

describe("areNotificationsEnabledForOnboarding", () => {
  it("matches API *Reminders fields", () => {
    expect(areNotificationsEnabledForOnboarding({ emailReminders: true })).toBe(true);
    expect(areNotificationsEnabledForOnboarding({ smsReminders: false, pushReminders: true })).toBe(true);
    expect(areNotificationsEnabledForOnboarding({ emailReminders: false, smsReminders: false, pushReminders: false })).toBe(
      false
    );
  });
  it("still accepts legacy *Enabled", () => {
    expect(areNotificationsEnabledForOnboarding({ emailEnabled: true })).toBe(true);
  });
});
