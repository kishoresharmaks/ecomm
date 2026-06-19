import * as Sentry from "@sentry/nextjs";

const sentryEnabled =
  (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV) !== "development" ||
  process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true";

if (sentryEnabled && process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    integrations: [
      Sentry.replayIntegration({
        blockAllMedia: true,
        maskAllInputs: true,
        maskAllText: true,
      }),
    ],
  });
}

export const onRouterTransitionStart = sentryEnabled ? Sentry.captureRouterTransitionStart : undefined;
