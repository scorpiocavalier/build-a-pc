import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Customer details must not be sent to a third party (PIPEDA / Law 25).
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
