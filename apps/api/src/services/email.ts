/**
 * Email service — Nodemailer SMTP.
 * All sends are no-ops when SMTP_HOST is not configured.
 */
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.SMTP_FROM || `"Přístav Radosti" <noreply@pristav-radosti.cz>`;

let transporter: nodemailer.Transporter | null = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  console.log(`[email] SMTP configured: ${SMTP_HOST}:${SMTP_PORT}`);
} else {
  console.log("[email] SMTP not configured — email sending disabled (set SMTP_HOST, SMTP_USER, SMTP_PASS)");
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!transporter) {
    console.log(`[email] SKIP (not configured): to=${payload.to} subject="${payload.subject}"`);
    return false;
  }

  try {
    const info = await transporter.sendMail({
      from: FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    console.log(`[email] Sent: ${info.messageId} → ${payload.to}`);
    return true;
  } catch (err) {
    console.error("[email] Send error:", err);
    return false;
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function appointmentConfirmedEmail(clientName: string, dateTime: string, service: string): EmailPayload {
  return {
    to: "", // caller fills in
    subject: `✅ Termín potvrzen — ${service}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1d4ed8;">Přístav Radosti</h2>
        <p>Dobrý den <strong>${clientName}</strong>,</p>
        <p>Váš termín byl potvrzen:</p>
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Služba:</strong> ${service}</p>
          <p><strong>Datum a čas:</strong> ${dateTime}</p>
        </div>
        <p>V případě potřeby zrušení nás prosím kontaktujte nejpozději 24 hodin předem.</p>
        <p>Těšíme se na vás!</p>
        <p style="color: #6b7280; font-size: 12px;">— Tým Přístav Radosti</p>
      </div>
    `,
    text: `Dobrý den ${clientName},\n\nVáš termín (${service}) dne ${dateTime} byl potvrzen.\n\nTěšíme se na vás!\nTým Přístav Radosti`,
  };
}

export function appointmentReminderEmail(clientName: string, dateTime: string, service: string): EmailPayload {
  return {
    to: "",
    subject: `⏰ Připomínka termínu — ${service}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1d4ed8;">Přístav Radosti</h2>
        <p>Dobrý den <strong>${clientName}</strong>,</p>
        <p>Připomínáme Váš nadcházející termín:</p>
        <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Služba:</strong> ${service}</p>
          <p><strong>Datum a čas:</strong> ${dateTime}</p>
        </div>
        <p>Těšíme se na vás!</p>
        <p style="color: #6b7280; font-size: 12px;">— Tým Přístav Radosti</p>
      </div>
    `,
    text: `Dobrý den ${clientName},\n\nPřipomínka: Váš termín (${service}) je dne ${dateTime}.\n\nTěšíme se na vás!`,
  };
}

export function invoiceEmail(clientName: string, invoiceNumber: string, amount: string, dueDate: string): EmailPayload {
  return {
    to: "",
    subject: `📄 Faktura ${invoiceNumber} — ${amount}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1d4ed8;">Přístav Radosti</h2>
        <p>Dobrý den <strong>${clientName}</strong>,</p>
        <p>Zasíláme Vám fakturu za poskytnuté služby:</p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Číslo faktury:</strong> ${invoiceNumber}</p>
          <p><strong>Částka:</strong> ${amount}</p>
          <p><strong>Splatnost:</strong> ${dueDate}</p>
        </div>
        <p>PDF fakturu najdete v klientském portálu.</p>
        <p style="color: #6b7280; font-size: 12px;">— Tým Přístav Radosti</p>
      </div>
    `,
    text: `Dobrý den ${clientName},\n\nFaktura ${invoiceNumber}, částka ${amount}, splatnost ${dueDate}.\n\nTým Přístav Radosti`,
  };
}

export function waitlistNotificationEmail(clientName: string, service: string): EmailPayload {
  return {
    to: "",
    subject: `🎉 Volný termín — ${service}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #1d4ed8;">Přístav Radosti</h2>
        <p>Dobrý den <strong>${clientName}</strong>,</p>
        <p>Uvolnil se termín pro Vaši žádanou službu <strong>${service}</strong>.</p>
        <p>Přihlaste se do klientského portálu a rezervujte si termín co nejdříve.</p>
        <p style="color: #6b7280; font-size: 12px;">— Tým Přístav Radosti</p>
      </div>
    `,
    text: `Dobrý den ${clientName},\n\nVolný termín pro ${service}! Přihlaste se a rezervujte.\n\nTým Přístav Radosti`,
  };
}
