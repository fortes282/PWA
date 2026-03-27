import { rawSqlite } from "../db/index.js";

export const CLIENT_SELF_CANCEL_ALLOWED_KEY = "clientSelfCancelAllowed";
export const CLIENT_SELF_CANCEL_MIN_HOURS_KEY = "clientSelfCancelMinHours";
export const CLIENT_SELF_CANCEL_LATE_REASON_HOURS_KEY = "clientSelfCancelLateReasonHours";

export type ClientSelfCancelPolicy = {
  allowed: boolean;
  /** Klient nesmí sám zrušit, pokud zbývá méně než tolik hodin do začátku. */
  minHoursBeforeStart: number;
  /** Pod tuto hranici (ale stále ≥ minHoursBeforeStart) je povinný textový důvod (min. 10 znaků). */
  lateReasonWithinHours: number;
};

/** Pro unit testy — mapuje klíč → hodnota (např. z DB). */
export function parseClientSelfCancelPolicy(get: (key: string) => string | undefined): ClientSelfCancelPolicy {
  const allowedVal = get(CLIENT_SELF_CANCEL_ALLOWED_KEY);
  const allowed = allowedVal === undefined || (allowedVal !== "false" && allowedVal !== "0");
  const rawMin = get(CLIENT_SELF_CANCEL_MIN_HOURS_KEY);
  const minHoursBeforeStart = rawMin === undefined ? 48 : Math.max(0, parseInt(rawMin, 10) || 0);
  const rawLate = get(CLIENT_SELF_CANCEL_LATE_REASON_HOURS_KEY);
  const lateReasonWithinHours = rawLate === undefined ? 24 : Math.max(0, parseInt(rawLate, 10) || 24);
  return {
    allowed,
    minHoursBeforeStart,
    lateReasonWithinHours,
  };
}

export function loadClientSelfCancelPolicyFromDb(): ClientSelfCancelPolicy {
  const get = (key: string): string | undefined => {
    const row = rawSqlite.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  };
  return parseClientSelfCancelPolicy(get);
}

export function validateClientSelfCancellation(
  policy: ClientSelfCancelPolicy,
  params: {
    role: string;
    appointmentStartMs: number;
    nowMs: number;
    cancellationReason: string | null | undefined;
  }
): { ok: true } | { ok: false; code: 400 | 403; message: string } {
  const { role, appointmentStartMs, nowMs, cancellationReason } = params;
  if (role !== "CLIENT") return { ok: true };

  if (!policy.allowed) {
    return {
      ok: false,
      code: 403,
      message:
        "Samoobslužné rušení termínu je vypnuto. Pro zrušení kontaktujte prosím recepci nebo administrátora.",
    };
  }

  const hoursUntil = (appointmentStartMs - nowMs) / (1000 * 60 * 60);
  if (hoursUntil <= 0) {
    return { ok: false, code: 400, message: "Termín už proběhl nebo právě probíhá." };
  }

  if (hoursUntil < policy.minHoursBeforeStart) {
    return {
      ok: false,
      code: 403,
      message: `Tento termín už nelze zrušit online — zbývá méně než ${policy.minHoursBeforeStart} h do začátku. Kontaktujte prosím recepci.`,
    };
  }

  if (hoursUntil < policy.lateReasonWithinHours) {
    const r = (cancellationReason ?? "").trim();
    if (r.length < 10) {
      return {
        ok: false,
        code: 400,
        message: "Zrušení v krátké době před termínem vyžaduje zdravotní důvod (alespoň 10 znaků).",
      };
    }
  }

  return { ok: true };
}

/** Spojení data a času slotu (bookings-v2) do epoch ms v lokálním významu `Date`. */
export function openSlotStartMs(dateYmd: string, timeHmOrHms: string): number {
  const t = timeHmOrHms.length === 5 ? `${timeHmOrHms}:00` : timeHmOrHms;
  return new Date(`${dateYmd}T${t}`).getTime();
}
