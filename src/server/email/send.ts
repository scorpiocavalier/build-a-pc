import "server-only";

import { Resend } from "resend";

export type Email = { to: string; subject: string; html: string; text: string };

const resend = process.env.AUTH_RESEND_KEY ? new Resend(process.env.AUTH_RESEND_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "Astral Tech Gaming <no-reply@astralgaming.ca>";

// Email never blocks an order: failures are logged (and reach Sentry) but the
// order flow carries on. Without a Resend key, emails are printed instead.
export async function sendEmail(email: Email): Promise<void> {
  if (!resend) {
    console.info(`[email] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, ...email });
    if (error) console.error("[email] Resend rejected the message", error);
  } catch (error) {
    console.error("[email] sending failed", error);
  }
}
