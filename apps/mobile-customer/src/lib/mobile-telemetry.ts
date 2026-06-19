import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";
import { sanitizeMobileEventProperties, type MobileEventProperties } from "./mobile-telemetry-sanitize";

let telemetryInitialized = false;

export function initMobileTelemetry() {
  if (telemetryInitialized) {
    return;
  }

  telemetryInitialized = true;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  const tunnel = process.env.EXPO_PUBLIC_SENTRY_TUNNEL_URL?.trim();

  Sentry.init({
    dsn,
    attachScreenshot: false,
    enableAutoSessionTracking: true,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    integrations: [Sentry.expoContextIntegration()],
    ...(tunnel ? { tunnel } : {}),
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}

export function withMobileTelemetry<TProps extends object>(Component: ComponentType<TProps>) {
  return Sentry.wrap(Component as ComponentType<Record<string, unknown>>) as ComponentType<TProps>;
}

export function captureMobileException(error: unknown, context: string, properties: MobileEventProperties = {}) {
  const sanitized = sanitizeMobileEventProperties(properties);

  if (process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()) {
    return Sentry.captureException(error, {
      tags: { context },
      extra: sanitized,
    });
  }

  if (__DEV__) {
    console.error(`[mobile:${context}]`, sanitized, error);
  }

  return undefined;
}

export function trackMobileEvent(name: string, properties: MobileEventProperties = {}) {
  const sanitized = sanitizeMobileEventProperties(properties);

  if (process.env.EXPO_PUBLIC_SENTRY_DSN?.trim()) {
    Sentry.addBreadcrumb({
      category: "analytics",
      data: sanitized,
      level: "info",
      message: name,
    });
    return;
  }

  if (__DEV__) {
    console.log(`[mobile-event:${name}]`, sanitized);
  }
}

export { sanitizeMobileEventProperties };
