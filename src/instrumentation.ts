import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Customer details must not be sent to a third party (PIPEDA / Law 25).
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
  });
}

export const onRequestError = Sentry.captureRequestError;
