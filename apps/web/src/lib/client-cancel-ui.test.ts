import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseClientSelfCancelFromPublicSettings,
  clientMayUseSelfCancelForAppointment,
  clientNeedsLateHealthReasonForAppointment,
} from "./client-cancel-ui";

describe("client-cancel-ui", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("parseClientSelfCancelFromPublicSettings defaults", () => {
    const p = parseClientSelfCancelFromPublicSettings(undefined);
    expect(p.allowed).toBe(true);
    expect(p.minHoursBeforeStart).toBe(48);
    expect(p.lateReasonWithinHours).toBe(24);
  });

  it("48h min blocks cancel inside window", () => {
    const p = parseClientSelfCancelFromPublicSettings({
      clientSelfCancelMinHours: "48",
      clientSelfCancelLateReasonHours: "24",
    });
    expect(clientMayUseSelfCancelForAppointment(p, "2030-01-16T12:00:00.000Z")).toBe(false);
    expect(clientMayUseSelfCancelForAppointment(p, "2030-01-20T12:00:00.000Z")).toBe(true);
  });

  it("late reason when between min and late window", () => {
    const p = parseClientSelfCancelFromPublicSettings({
      clientSelfCancelMinHours: "0",
      clientSelfCancelLateReasonHours: "72",
    });
    expect(clientNeedsLateHealthReasonForAppointment(p, "2030-01-16T12:00:00.000Z")).toBe(true);
    expect(clientNeedsLateHealthReasonForAppointment(p, "2030-01-20T12:00:00.000Z")).toBe(false);
  });
});
