import posthog from "posthog-js";

export function getPostHogToken(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()
  );
}

export function getPostHogHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    "https://t.1handindia.com"
  );
}

export function getPostHogUiHost(): string {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_UI_HOST?.trim() ||
    "https://us.posthog.com"
  );
}

export function isPostHogConfigured(): boolean {
  return Boolean(getPostHogToken());
}

let isInitialized = false;
let hasWarnedMissingToken = false;

export function initPostHog(): typeof posthog | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = getPostHogToken();
  if (!token) {
    if (!hasWarnedMissingToken) {
      console.warn(
        "[PostHog] NEXT_PUBLIC_POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing. Analytics and session recording are disabled. Set this variable in your hosting environment to start capturing events.",
      );
      hasWarnedMissingToken = true;
    }
    return null;
  }

  if (isInitialized || posthog.__loaded) {
    return posthog;
  }

  const host = getPostHogHost();
  const uiHost = getPostHogUiHost();

  posthog.init(token, {
    api_host: host,
    ui_host: uiHost,
    defaults: "2026-05-30",
    persistence: "localStorage+cookie",
    capture_pageview: false, // Managed by PostHogPageView on App Router route transitions
    capture_pageleave: true,
    capture_exceptions: true,
    autocapture: true,
    person_profiles: "identified_only",
    debug: process.env.NODE_ENV === "development",
  });

  isInitialized = true;
  return posthog;
}

export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return;
  }
  const client = initPostHog();
  if (client) {
    client.capture(eventName, properties);
  }
}

export function capturePostHogException(error: unknown) {
  if (typeof window === "undefined") {
    return;
  }
  const client = initPostHog();
  if (client) {
    client.captureException(error);
  }
}

export function identifyPostHogUser(
  distinctId: string,
  personProperties?: Record<string, unknown>,
) {
  if (typeof window === "undefined") {
    return;
  }
  const client = initPostHog();
  if (client) {
    client.identify(distinctId, personProperties);
  }
}

export function resetPostHogUser() {
  if (typeof window === "undefined") {
    return;
  }
  const client = initPostHog();
  if (client) {
    client.reset();
  }
}

export { posthog };
