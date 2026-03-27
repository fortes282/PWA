/**
 * Klient: zda zobrazit samoobslužné zrušení — musí odpovídat API (`client-cancel-policy` na serveru).
 */

export type ClientSelfCancelUiPolicy = {
  allowed: boolean;
  minHoursBeforeStart: number;
  lateReasonWithinHours: number;
};

const DEFAULT_POLICY: ClientSelfCancelUiPolicy = {
  allowed: true,
  minHoursBeforeStart: 48,
  lateReasonWithinHours: 24,
};

export function parseClientSelfCancelFromPublicSettings(
  data: Record<string, string> | undefined
): ClientSelfCancelUiPolicy {
  if (!data) return DEFAULT_POLICY;
  const allowed = data.clientSelfCancelAllowed !== "false" && data.clientSelfCancelAllowed !== "0";
  const minRaw = data.clientSelfCancelMinHours;
  const minHoursBeforeStart =
    minRaw === undefined ? 48 : Math.max(0, parseInt(minRaw, 10) || 0);
  const lateRaw = data.clientSelfCancelLateReasonHours;
  const lateReasonWithinHours =
    lateRaw === undefined ? 24 : Math.max(0, parseInt(lateRaw, 10) || 24);
  return { allowed, minHoursBeforeStart, lateReasonWithinHours };
}

export function hoursUntilStart(isoStartTime: string): number {
  return (new Date(isoStartTime).getTime() - Date.now()) / (1000 * 60 * 60);
}

/** Zobrazit tlačítko / gesto zrušení u klasického termínu (`startTime` ISO). */
export function clientMayUseSelfCancelForAppointment(
  policy: ClientSelfCancelUiPolicy,
  startTimeIso: string
): boolean {
  if (!policy.allowed) return false;
  const h = hoursUntilStart(startTimeIso);
  if (h <= 0) return false;
  return h >= policy.minHoursBeforeStart;
}

/** Vyžadovat dlouhý zdravotní důvod (stejná logika jako API). */
export function clientNeedsLateHealthReasonForAppointment(
  policy: ClientSelfCancelUiPolicy,
  startTimeIso: string
): boolean {
  if (!policy.allowed) return false;
  const h = hoursUntilStart(startTimeIso);
  if (h <= 0) return false;
  if (h < policy.minHoursBeforeStart) return false;
  return h < policy.lateReasonWithinHours;
}

export function hoursUntilBookingV2Slot(dateYmd: string, timeHm: string): number {
  const t = timeHm.length === 5 ? `${timeHm}:00` : timeHm;
  const ms = new Date(`${dateYmd}T${t}`).getTime();
  return (ms - Date.now()) / (1000 * 60 * 60);
}

export function clientMayUseSelfCancelForBookingV2(
  policy: ClientSelfCancelUiPolicy,
  dateYmd: string,
  timeHm: string
): boolean {
  if (!policy.allowed) return false;
  const h = hoursUntilBookingV2Slot(dateYmd, timeHm);
  if (h <= 0) return false;
  return h >= policy.minHoursBeforeStart;
}
