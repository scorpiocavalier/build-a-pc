import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resend } from "resend";

export type Email = { to: string; subject: string; html: string; text: string };

const resend = process.env.AUTH_RESEND_KEY ? new Resend(process.env.AUTH_RESEND_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "Astral Tech Gaming <no-reply@astralgaming.ca>";

// Email never blocks an order: failures are logged (and reach Sentry) but the
// order flow carries on. Without a Resend key, emails are printed instead.
export async function sendEmail(email: Email): Promise<void> {
  // Browser tests read emails (e.g. sign-in links) from this folder.
  const outbox = process.env.EMAIL_OUTBOX_DIR;
  if (outbox) {
    await mkdir(outbox, { recursive: true });
    const file = `${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    await writeFile(path.join(outbox, file), JSON.stringify(email));
    return;
  }
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
