// src/lib/email/admin-alert.ts
//
// Immediate out-of-band email push to active admin accounts.
// Uses the same nodemailer/Gmail transport already used by the breach-alert
// flow elsewhere in the project.
//
// Required env vars (set in .env.local and production secrets):
//   GMAIL_USER          — the sending Gmail address
//   GMAIL_APP_PASSWORD  — the 16-character Gmail App Password (not account password)
//
// Called from: src/app/api/admin/automation/cron/route.ts (Rule 3)
//
// Design notes:
//   — Fire-and-forget at call site (void sendFraudAlertEmail(...)). A failure
//     here must never throw or crash the cron; the DB notification row is the
//     durable fallback.
//   — adminEmails is fetched by the caller so this function stays stateless
//     and testable without a Supabase dependency.
//   — HTML body is intentionally minimal — no external CSS, no images — so it
//     renders correctly in all email clients including mobile Gmail.

import nodemailer from 'nodemailer';

export interface FraudAlertPayload {
  recipientUserId: string;
  uniqueSenderCount: number;
  windowHours: number;
}

function buildTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn(
      '[sendFraudAlertEmail] GMAIL_USER or GMAIL_APP_PASSWORD env var is not set. ' +
      'Email push is disabled — only the DB notification row was written.',
    );
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export async function sendFraudAlertEmail(
  adminEmails: string[],
  payload:      FraudAlertPayload,
): Promise<void> {
  if (adminEmails.length === 0) return;

  const transport = buildTransport();
  if (!transport) return;

  const { recipientUserId, uniqueSenderCount, windowHours } = payload;

  const subject = `[F9 CRITICAL] Suspicious wallet inflow — user ${recipientUserId}`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#dc2626;">⚠ Critical Fraud Alert — F9 Platform</h2>
      <p>Automated fraud detection has flagged a suspicious wallet inflow pattern
         and <strong>frozen the wallet</strong> pending your review.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;">
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Affected User ID</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${recipientUserId}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Unique External Senders</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${uniqueSenderCount}</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Detection Window</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">${windowHours} hours</td>
        </tr>
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Action Taken</td>
          <td style="padding:8px;border:1px solid #e5e7eb;">Wallet frozen (account_status unchanged)</td>
        </tr>
      </table>
      <p>No linked orders were found for the incoming transactions. Immediate
         review is required before the wallet can be unfrozen.</p>
      <p style="color:#6b7280;font-size:12px;">
        This alert was generated automatically by the F9 cron job (Rule 3).
        Do not reply to this email.
      </p>
    </div>
  `;

  try {
    await transport.sendMail({
      from:    `"F9 Platform Alerts" <${process.env.GMAIL_USER}>`,
      to:      adminEmails.join(', '),
      subject,
      html,
    });
  } catch (err) {
    // Never surface to caller — DB notification is the durable fallback.
    console.error('[sendFraudAlertEmail] nodemailer send failed:', err);
  }
}