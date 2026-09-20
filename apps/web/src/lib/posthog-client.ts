import posthog, { type CaptureResult } from "posthog-js";

type CapturedException = {
  type?: unknown;
  stacktrace?: { frames?: unknown[] } | null;
};

// A genuine Error capture carries a stack trace, and its type is an Error class
// name such as "TypeError". A bare DOM event reaches the global exception handler
// with no stack trace and a type like "Event", which produces a valueless issue
// that nobody can debug. Drop that class before it leaves the browser.
function isStacklessNonError(exception: CapturedException): boolean {
  const frames = exception.stacktrace?.frames;
  const hasStack = Array.isArray(frames) && frames.length > 0;
  const isErrorType = typeof exception.type === "string" && /Error$/.test(exception.type);
  return !hasStack && !isErrorType;
}

export function dropStacklessNonErrorExceptions(
  event: CaptureResult | null,
): CaptureResult | null {
  if (!event || event.event !== "$exception") {
    return event;
  }

  const exceptions = event.properties?.["$exception_list"] as CapturedException[] | undefined;
  if (Array.isArray(exceptions) && exceptions.length > 0 && exceptions.every(isStacklessNonError)) {
    return null;
  }

  return event;
}

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
    capture_pageview: false, // Managed by PostHogPageView on App Router route transitions
    capture_pageleave: true,
    capture_exceptions: true,
    before_send: dropStacklessNonErrorExceptions,
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
