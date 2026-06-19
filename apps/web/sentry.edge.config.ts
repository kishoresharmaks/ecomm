import * as Sentry from "@sentry/nextjs";

const sentryEnabled =
  (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV) !== "development" ||
  process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true";
const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (sentryEnabled && dsn?.trim()) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}
