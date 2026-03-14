/**
 * SMS service — SMSAPI.com
 * Configure with SMSAPI_TOKEN env var (Bearer token from smsapi.com).
 * Optionally set SMSAPI_SENDER to a pre-approved sender name (ECO SMS if not set).
 * No-op when token is not set.
 *
 * Docs: https://www.smsapi.com/rest-api
 */

const SMSAPI_URL = "https://api.smsapi.com/sms.do";

// Startup log (read env at module init for informational purposes only)
if (process.env.SMSAPI_TOKEN) {
  const sender = process.env.SMSAPI_SENDER;
  console.log(`[sms] SMSAPI.com configured${sender ? `, sender=${sender}` : " (ECO — no sender name)"}`);
} else {
  console.log("[sms] SMSAPI_TOKEN not set — SMS sending disabled");
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  // Read env vars dynamically to allow runtime/test overrides
  const token = process.env.SMSAPI_TOKEN;
  const sender = process.env.SMSAPI_SENDER;

  if (!token) {
    console.log(`[sms] SKIP (not configured): to=${to} message="${message.slice(0, 50)}..."`);
    return false;
  }

  // Normalize phone number (Czech: +420XXXXXXXXX)
  let phone = to.replace(/\s/g, "");
  if (phone.startsWith("0")) phone = `+420${phone.slice(1)}`;
  if (!phone.startsWith("+")) phone = `+420${phone}`;

  try {
    const params: Record<string, string> = {
      to: phone,
      message,
      format: "json",
    };
    if (sender) {
      params.from = sender;
    }

    const res = await fetch(SMSAPI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || (data && data.error)) {
      console.error(`[sms] Error ${res.status ?? data?.error}: ${data?.message ?? "unknown"}`);
      return false;
    }

    // SMSAPI returns { count, list: [{ id, number, date_sent, status, ... }] }
    if (data?.invalid_numbers?.length) {
      console.error("[sms] Invalid number:", data.invalid_numbers);
      return false;
    }

    console.log(`[sms] Sent OK to ${phone}, id=${data?.list?.[0]?.id ?? "?"}`);
    return true;
  } catch (err) {
    console.error("[sms] Network error:", err);
    return false;
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function appointmentReminderSms(dateTime: string, serviceName: string): string {
  return `Pripominka Pristav Radosti: Vas termin (${serviceName}) je ${dateTime}. Info: pristav-radosti.cz`;
}

export function appointmentConfirmedSms(dateTime: string, serviceName: string): string {
  return `Pristav Radosti: Vas termin (${serviceName}) ${dateTime} byl potvrzen. Na shledanou!`;
}

export function waitlistNotificationSms(serviceName: string): string {
  return `Pristav Radosti: Uvolnil se termin pro ${serviceName}! Prihlaste se a rezervujte: pristav-radosti.cz`;
}
