// app/lib/email.ts
// Thin wrapper around Resend for transactional email.
// If RESEND_API_KEY is not configured (local dev without secrets), we log and
// skip rather than throwing — this keeps registration working offline while
// still surfacing the intent in server logs.

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM =
  process.env.RESEND_FROM_EMAIL || 'IWO Watch <no-reply@iwowatch.com.br>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
};

export async function sendEmail(opts: SendEmailInput) {
  // Optional: persist to prisma.emailLog here if we want a full audit trail.
  // Skipped for v1 to keep this wrapper minimal — emails are idempotent from
  // Resend's side and we already log failures below.
  if (!process.env.RESEND_API_KEY) {
    console.warn(
      '[email] RESEND_API_KEY missing — skipping send; would send:',
      opts.subject,
      '→',
      opts.to
    );
    return { skipped: true as const };
  }

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    tags: opts.tags,
  });

  if (error) {
    console.error('[email] send failed:', error);
    throw error;
  }

  return { id: data?.id };
}

export { APP_URL };
