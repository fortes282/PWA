import { describe, it, expect } from "vitest";
import {
  parseClientSelfCancelPolicy,
  validateClientSelfCancellation,
  openSlotStartMs,
} from "./client-cancel-policy.js";

describe("parseClientSelfCancelPolicy", () => {
  it("defaults: allowed, 48 min hours, 24 late reason", () => {
    const p = parseClientSelfCancelPolicy(() => undefined);
    expect(p.allowed).toBe(true);
    expect(p.minHoursBeforeStart).toBe(48);
    expect(p.lateReasonWithinHours).toBe(24);
  });
  it("respects false / 0 for allowed", () => {
    expect(parseClientSelfCancelPolicy((k) => (k === "clientSelfCancelAllowed" ? "false" : undefined)).allowed).toBe(
      false
    );
  });
  it("parses min hours and late reason", () => {
    const p = parseClientSelfCancelPolicy((k) =>
      k === "clientSelfCancelMinHours" ? "48" : k === "clientSelfCancelLateReasonHours" ? "24" : undefined
    );
    expect(p.minHoursBeforeStart).toBe(48);
    expect(p.lateReasonWithinHours).toBe(24);
  });
});

describe("validateClientSelfCancellation", () => {
  const base = { role: "CLIENT" as const, nowMs: 1_000_000_000_000 };
  const policyAllowed = parseClientSelfCancelPolicy((k) =>
    k === "clientSelfCancelMinHours" ? "0" : k === "clientSelfCancelLateReasonHours" ? "24" : undefined
  );

  it("skips for non-CLIENT", () => {
    const r = validateClientSelfCancellation(policyAllowed, {
      ...base,
      role: "RECEPTION",
      appointmentStartMs: base.nowMs + 3600_000,
      cancellationReason: null,
    });
    expect(r.ok).toBe(true);
  });

  it("403 when self-cancel disabled", () => {
    const p = parseClientSelfCancelPolicy((k) => (k === "clientSelfCancelAllowed" ? "false" : undefined));
    const r = validateClientSelfCancellation(p, {
      ...base,
      appointmentStartMs: base.nowMs + 100 * 3600_000,
      cancellationReason: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(403);
  });

  it("403 when inside minHours window (48h policy)", () => {
    const p = parseClientSelfCancelPolicy((k) =>
      k === "clientSelfCancelMinHours" ? "48" : k === "clientSelfCancelLateReasonHours" ? "24" : undefined
    );
    const start = base.nowMs + 36 * 3600_000;
    const r = validateClientSelfCancellation(p, {
      ...base,
      appointmentStartMs: start,
      cancellationReason: "nemoc",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(403);
  });

  it("allows when beyond minHours", () => {
    const p = parseClientSelfCancelPolicy((k) =>
      k === "clientSelfCancelMinHours" ? "48" : k === "clientSelfCancelLateReasonHours" ? "24" : undefined
    );
    const start = base.nowMs + 72 * 3600_000;
    const r = validateClientSelfCancellation(p, {
      ...base,
      appointmentStartMs: start,
      cancellationReason: null,
    });
    expect(r.ok).toBe(true);
  });

  it("400 when late-reason window requires text", () => {
    const p = parseClientSelfCancelPolicy((k) =>
      k === "clientSelfCancelMinHours" ? "0" : k === "clientSelfCancelLateReasonHours" ? "72" : undefined
    );
    const start = base.nowMs + 48 * 3600_000;
    const r = validateClientSelfCancellation(p, {
      ...base,
      appointmentStartMs: start,
      cancellationReason: "krátce",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(400);
  });

  it("allows late cancel with long enough reason", () => {
    const p = parseClientSelfCancelPolicy((k) =>
      k === "clientSelfCancelMinHours" ? "0" : k === "clientSelfCancelLateReasonHours" ? "72" : undefined
    );
    const start = base.nowMs + 48 * 3600_000;
    const r = validateClientSelfCancellation(p, {
      ...base,
      appointmentStartMs: start,
      cancellationReason: "akutní zdravotní problém delší text",
    });
    expect(r.ok).toBe(true);
  });
});

describe("openSlotStartMs", () => {
  it("returns finite timestamp for date + HH:MM", () => {
    const ms = openSlotStartMs("2030-06-15", "14:30");
    expect(Number.isFinite(ms)).toBe(true);
    const d = new Date(ms);
    expect(d.getFullYear()).toBe(2030);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
  });
});
