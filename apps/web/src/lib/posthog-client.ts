import posthog from "posthog-js";

const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim(),
);

export function capturePostHogEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (posthogConfigured) {
    posthog.capture(eventName, properties);
  }
}

export function capturePostHogException(error: unknown) {
  if (posthogConfigured) {
    posthog.captureException(error);
  }
}

export function identifyPostHogUser(
  distinctId: string,
  personProperties?: Record<string, unknown>,
) {
  if (posthogConfigured) {
    posthog.identify(distinctId, personProperties);
  }
}

export function resetPostHogUser() {
  if (posthogConfigured) {
    posthog.reset();
  }
}
