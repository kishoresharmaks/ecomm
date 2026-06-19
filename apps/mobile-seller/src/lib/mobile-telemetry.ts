import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

let initialized = false;

function isMobileTelemetryEnabled() {
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
  return appEnv !== "development" || process.env.EXPO_PUBLIC_ENABLE_SENTRY === "true";
}

export function initMobileTelemetry() {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }
  if (!isMobileTelemetryEnabled()) {
    return;
  }

  const tunnelUrl = process.env.EXPO_PUBLIC_SENTRY_TUNNEL_URL?.trim();
  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    ...(tunnelUrl ? { tunnel: tunnelUrl } : {}),
    integrations: [Sentry.expoContextIntegration()],
    beforeSend(event) {
      delete event.request?.headers?.authorization;
      delete event.request?.headers?.Authorization;
      return event;
    },
  });
}

export function withMobileTelemetry<TProps extends object>(Component: ComponentType<TProps>) {
  if (!isMobileTelemetryEnabled()) {
    return Component;
  }
  return Sentry.wrap(Component as ComponentType<Record<string, unknown>>) as ComponentType<TProps>;
}

export function captureMobileError(error: unknown, area: string) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() && isMobileTelemetryEnabled()) {
    return Sentry.captureException(error, {
      tags: { area, surface: "seller-mobile" },
    });
  }
  return null;
}
