import type { Rehearsal } from "@/features/rehearsals/types";
import { clearGmailAccessToken, getGmailAccessToken } from "./gmailAuth";

export interface RehearsalEmailRecipient {
  musicianId: string;
  name: string;
  email: string;
  confirmationUrl: string;
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toBase64UrlUtf8(value: string): string {
  return toBase64Utf8(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeRfc2047Subject(subject: string): string {
  return `=?UTF-8?B?${toBase64Utf8(subject)}?=`;
}

function formatIcsDateTimeLocal(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/-/g, "");
  const [hh = "00", mm = "00", ss = "00"] = timeStr.split(":");
  return `${cleanDate}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}${ss.slice(0, 2).padStart(2, "0")}`;
}

function formatIcsUtcStamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildGoogleCalendarTemplateUrl(rehearsal: Rehearsal, confirmationUrl?: string): string {
  // Convert Colombia time (UTC-5) to UTC YYYYMMDDTHHmmSSZ for Google Calendar
  const startUtc = new Date(`${rehearsal.rehearsal_date}T${rehearsal.start_time.slice(0, 5)}:00-05:00`);
  const endUtc = new Date(`${rehearsal.rehearsal_date}T${rehearsal.end_time.slice(0, 5)}:00-05:00`);
  const dates = `${formatIcsUtcStamp(startUtc)}/${formatIcsUtcStamp(endUtc)}`;
  const location = [rehearsal.location, rehearsal.address].filter(Boolean).join(" - ");
  const detailsParts = [
    rehearsal.objective ? `Objetivo: ${rehearsal.objective}` : "",
    rehearsal.observations ? `Observaciones: ${rehearsal.observations}` : "",
    confirmationUrl ? `Confirmar asistencia: ${confirmationUrl}` : "",
  ].filter(Boolean);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Ensayo: ${rehearsal.name}`,
    dates,
    location,
    details: detailsParts.join("\n\n"),
    ctz: "America/Bogota",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildRehearsalIcsContent(input: {
  rehearsal: Rehearsal;
  organizationName: string;
  organizerEmail?: string | null;
  recipient: RehearsalEmailRecipient;
  customMessage?: string;
}): string {
  const startUtc = new Date(`${input.rehearsal.rehearsal_date}T${input.rehearsal.start_time.slice(0, 5)}:00-05:00`);
  const endUtc = new Date(`${input.rehearsal.rehearsal_date}T${input.rehearsal.end_time.slice(0, 5)}:00-05:00`);
  const location = [input.rehearsal.location, input.rehearsal.address].filter(Boolean).join(" - ");
  const descriptionLines = [
    `Organización: ${input.organizationName}`,
    input.rehearsal.objective ? `Objetivo: ${input.rehearsal.objective}` : "",
    input.rehearsal.observations ? `Observaciones: ${input.rehearsal.observations}` : "",
    input.customMessage?.trim() ? `Nota: ${input.customMessage.trim()}` : "",
    `Confirma tu asistencia en Proyecto Orquesta: ${input.recipient.confirmationUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const organizerLine = input.organizerEmail
    ? `ORGANIZER;CN="${escapeIcsText(input.organizationName)}":mailto:${input.organizerEmail}`
    : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Proyecto Orquesta//Programacion Ensayos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:rehearsal-${input.rehearsal.id}@proyecto-orquesta.local`,
    `DTSTAMP:${formatIcsUtcStamp(new Date())}`,
    `DTSTART:${formatIcsUtcStamp(startUtc)}`,
    `DTEND:${formatIcsUtcStamp(endUtc)}`,
    `SUMMARY:${escapeIcsText(`Ensayo: ${input.rehearsal.name}`)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines)}`,
    organizerLine,
    `ATTENDEE;CN="${escapeIcsText(input.recipient.name)}";RSVP=TRUE:mailto:${input.recipient.email}`,
    `URL:${input.recipient.confirmationUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  // Also ensure local format function is referenced cleanly if needed
  void formatIcsDateTimeLocal;
  return lines.join("\r\n");
}

function buildMimeEmail(input: {
  fromEmail: string;
  recipient: RehearsalEmailRecipient;
  subject: string;
  rehearsal: Rehearsal;
  organizationName: string;
  customMessage: string;
  attachIcs: boolean;
}): string {
  const formattedDate = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(`${input.rehearsal.rehearsal_date}T12:00:00-05:00`));
  const timeRange = `${input.rehearsal.start_time.slice(0, 5)} – ${input.rehearsal.end_time.slice(0, 5)} (hora Colombia)`;
  const gcalUrl = buildGoogleCalendarTemplateUrl(input.rehearsal, input.recipient.confirmationUrl);

  const plainText = [
    `Hola ${input.recipient.name},`,
    "",
    `Has sido convocado(a) a un ensayo de ${input.organizationName}:`,
    `• Ensayo: ${input.rehearsal.name}`,
    `• Fecha: ${formattedDate}`,
    `• Horario: ${timeRange}`,
    `• Lugar: ${input.rehearsal.location}${input.rehearsal.address ? ` (${input.rehearsal.address})` : ""}`,
    `• Objetivo: ${input.rehearsal.objective}`,
    input.rehearsal.observations ? `• Observaciones: ${input.rehearsal.observations}` : "",
    input.customMessage.trim() ? `\nMensaje adicional:\n${input.customMessage.trim()}` : "",
    "",
    `1. Confirmar asistencia: ${input.recipient.confirmationUrl}`,
    `2. Agregar a Google Calendar: ${gcalUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const htmlBody = `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f8f7fc; color: #181329;">
    <div style="background: #201537; color: #ffffff; padding: 24px; border-radius: 18px 18px 0 0;">
      <p style="margin: 0; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #c4b5fd; font-weight: 700;">
        ${escapeHtml(input.organizationName)} · Convocatoria de ensayo
      </p>
      <h1 style="margin: 8px 0 0; font-size: 22px; font-weight: 800;">${escapeHtml(input.rehearsal.name)}</h1>
    </div>
    <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 18px 18px;">
      <p style="margin: 0 0 16px; font-size: 15px;">Hola <strong>${escapeHtml(input.recipient.name)}</strong>,</p>
      <p style="margin: 0 0 16px; font-size: 14px; color: #4b5563;">
        Se ha programado un nuevo ensayo en el calendario y tu presencia es importante. Aquí tienes los detalles:
      </p>
      <div style="background: #f5f3ff; border-left: 4px solid #5B21F4; padding: 14px 16px; border-radius: 10px; margin-bottom: 18px; font-size: 14px; line-height: 1.6;">
        <div><strong>Fecha:</strong> ${escapeHtml(formattedDate)}</div>
        <div><strong>Horario:</strong> ${escapeHtml(timeRange)}</div>
        <div><strong>Lugar:</strong> ${escapeHtml(input.rehearsal.location)}${input.rehearsal.address ? ` · ${escapeHtml(input.rehearsal.address)}` : ""}</div>
        <div><strong>Objetivo:</strong> ${escapeHtml(input.rehearsal.objective)}</div>
        ${input.rehearsal.observations ? `<div><strong>Observaciones:</strong> ${escapeHtml(input.rehearsal.observations)}</div>` : ""}
      </div>
      ${
        input.customMessage.trim()
          ? `<p style="margin: 0 0 18px; font-size: 14px; background: #f9fafb; padding: 12px; border-radius: 10px; color: #374151;">${escapeHtml(input.customMessage.trim()).replace(/\n/g, "<br/>")}</p>`
          : ""
      }
      <div style="margin: 22px 0; display: flex; flex-wrap: wrap; gap: 10px;">
        <a href="${escapeHtml(input.recipient.confirmationUrl)}" style="display: inline-block; background: #5B21F4; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 10px; margin-right: 8px; margin-bottom: 8px;">
          Confirmar asistencia
        </a>
        <a href="${escapeHtml(gcalUrl)}" style="display: inline-block; background: #eef2ff; color: #3730a3; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 18px; border-radius: 10px; margin-bottom: 8px;">
          Agregar a Google Calendar
        </a>
      </div>
      <p style="margin: 16px 0 0; font-size: 12px; color: #6b7280;">
        También adjuntamos la invitación de calendario (.ics) para que puedas guardarla directamente en tu agenda.
      </p>
    </div>
  </div>`.trim();

  const mixedBoundary = `po-mixed-${Math.random().toString(36).slice(2, 12)}`;
  const altBoundary = `po-alt-${Math.random().toString(36).slice(2, 12)}`;

  const parts: string[] = [
    `From: ${input.fromEmail}`,
    `To: "${input.recipient.name.replace(/"/g, "")}" <${input.recipient.email}>`,
    `Subject: ${encodeRfc2047Subject(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    `--${altBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    toBase64Utf8(plainText),
    "",
    `--${altBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    toBase64Utf8(htmlBody),
    "",
    `--${altBoundary}--`,
  ];

  if (input.attachIcs) {
    const ics = buildRehearsalIcsContent({
      rehearsal: input.rehearsal,
      organizationName: input.organizationName,
      organizerEmail: input.fromEmail,
      recipient: input.recipient,
      customMessage: input.customMessage,
    });
    parts.push(
      "",
      `--${mixedBoundary}`,
      'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="ensayo.ics"',
      "Content-Transfer-Encoding: base64",
      'Content-Disposition: attachment; filename="ensayo.ics"',
      "",
      toBase64Utf8(ics),
    );
  }

  parts.push("", `--${mixedBoundary}--`);
  return parts.join("\r\n");
}

export async function sendRehearsalScheduleEmailsViaGmail(input: {
  fromEmail: string;
  rehearsal: Rehearsal;
  organizationName: string;
  subject: string;
  customMessage: string;
  attachIcs: boolean;
  recipients: RehearsalEmailRecipient[];
}): Promise<{ sent: number; failed: Array<{ name: string; email: string; reason: string }> }> {
  const token = getGmailAccessToken();
  if (!token) {
    throw new Error("Tu sesión de Gmail expiró o no está conectada. Vuelve a conectar tu cuenta de Google.");
  }

  let sent = 0;
  const failed: Array<{ name: string; email: string; reason: string }> = [];

  for (const recipient of input.recipients) {
    const rawMime = buildMimeEmail({
      fromEmail: input.fromEmail,
      recipient,
      subject: input.subject,
      rehearsal: input.rehearsal,
      organizationName: input.organizationName,
      customMessage: input.customMessage,
      attachIcs: input.attachIcs,
    });

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: toBase64UrlUtf8(rawMime) }),
    });

    if (response.status === 401) {
      clearGmailAccessToken();
      throw new Error("El permiso temporal de Gmail expiró. Conecta nuevamente tu cuenta de Google para continuar.");
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg =
        (errBody as { error?: { message?: string } })?.error?.message ||
        `Error HTTP ${response.status} al enviar correo`;
      failed.push({ name: recipient.name, email: recipient.email, reason: msg });
    } else {
      sent += 1;
    }
  }

  return { sent, failed };
}
