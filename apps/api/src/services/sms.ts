/**
 * SMS service — FAYN API (Czech provider).
 * Configure with FAYN_API_KEY env var.
 * No-op when API key is not set.
 */

const FAYN_API_KEY = process.env.FAYN_API_KEY;
const FAYN_API_URL = "https://api.fayn.eu/v1/sms/send";
const SENDER_NAME = "PristavR";

if (FAYN_API_KEY) {
  console.log("[sms] FAYN API configured, SMS sending enabled");
} else {
  console.log("[sms] FAYN_API_KEY not set — SMS sending disabled");
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  if (!FAYN_API_KEY) {
    console.log(`[sms] SKIP (not configured): to=${to} message="${message.slice(0, 50)}..."`);
    return false;
  }

  // Normalize phone number (Czech: +420XXXXXXXXX)
  let phone = to.replace(/\s/g, "");
  if (phone.startsWith("0")) phone = `+420${phone.slice(1)}`;
  if (!phone.startsWith("+")) phone = `+420${phone}`;

  try {
    const res = await fetch(FAYN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FAYN_API_KEY}`,
      },
      body: JSON.stringify({
        to: phone,
        from: SENDER_NAME,
        text: message,
        type: "transactional",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[sms] Error ${res.status}: ${err}`);
      return false;
    }

    console.log(`[sms] Sent OK to ${phone}`);
    return true;
  } catch (err) {
    console.error("[sms] Network error:", err);
    return false;
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function appointmentReminderSms(dateTime: string, serviceName: string): string {
  return `Pripominkaç Pristav Radosti: Vas termin (${serviceName}) je ${dateTime}. Info: pristav-radosti.cz`;
}

export function appointmentConfirmedSms(dateTime: string, serviceName: string): string {
  return `Pristav Radosti: Vas termin (${serviceName}) ${dateTime} byl potvrzen. Na shledanou!`;
}

export function waitlistNotificationSms(serviceName: string): string {
  return `Pristav Radosti: Uvolnil se termin pro ${serviceName}! Prihlaste se a rezervujte: pristav-radosti.cz`;
}
