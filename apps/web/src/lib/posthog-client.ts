import { isAbortError, isNetworkError } from "./api";
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
    before_send: (event) => {
      if (event?.event === "$exception") {
        const type = String(event?.properties?.["$exception_type"] || "");
        const message = String(
          event?.properties?.["$exception_message"] ||
            event?.properties?.["$exception_personURL"] ||
            "",
        );
        const lowerMsg = message.toLowerCase();
        if (
          type === "AbortError" ||
          type === "DOMException" ||
          lowerMsg.includes("load failed") ||
          lowerMsg.includes("failed to fetch") ||
          lowerMsg.includes("networkerror") ||
          lowerMsg.includes("network error") ||
          lowerMsg.includes("network request failed") ||
          lowerMsg.includes("fetch is aborted") ||
          lowerMsg.includes("signal is aborted") ||
          lowerMsg.includes("operation was aborted") ||
          lowerMsg.includes("sign in before ") ||
          lowerMsg.includes("session expired") ||
          lowerMsg.includes("token is expired") ||
          lowerMsg.includes("token expired")
        ) {
          return null;
        }
      }
      return event;
    },
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

export function isUserFacingAuthOrValidationError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  if (isAbortError(error) || isNetworkError(error)) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null && "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";

  if (!message) {
    return false;
  }

  const lower = message.toLowerCase();
  return (
    lower.includes("sign in before ") ||
    lower.includes("sign in to ") ||
    lower.includes("please sign in") ||
    lower.includes("session expired") ||
    lower.includes("token is expired") ||
    lower.includes("token expired") ||
    lower.includes("sign out and sign in again")
  );
}

export function capturePostHogException(error: unknown) {
  if (typeof window === "undefined") {
    return;
  }
  if (isUserFacingAuthOrValidationError(error)) {
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
