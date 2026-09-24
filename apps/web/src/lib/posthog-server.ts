import { PostHog } from "posthog-node";

function getPostHogToken(): string | undefined {
  return (
    process.env.POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  );
}

function getPostHogHost(): string {
  return (
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    "https://t.1handindia.com"
  );
}

let posthogInstance: PostHog | null = null;

export function getPostHogServerClient(): PostHog | null {
  const token = getPostHogToken();
  if (!token) {
    return null;
  }

  if (!posthogInstance) {
    posthogInstance = new PostHog(token, {
      host: getPostHogHost(),
    });
  }

  return posthogInstance;
}

export const posthog = {
  capture({
    distinctId,
    event,
    properties,
  }: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown> | undefined;
  }) {
    const token = getPostHogToken();
    if (!token) {
      return;
    }
    const client = getPostHogServerClient();
    if (client) {
      client.capture({
        distinctId,
        event,
        ...(properties ? { properties } : {}),
      });
    }
  },
  shutdown() {
    if (posthogInstance) {
      void posthogInstance.shutdown();
      posthogInstance = null;
    }
  },
};

export default posthog;
