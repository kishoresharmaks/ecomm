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
    const host = getPostHogHost().replace(/\/+$/, "");

    void fetch(`${host}/capture/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          $lib: "indihub-posthog-server",
        },
      }),
    }).catch(() => {
      // Non-blocking catch for server tracking fetch
    });
  },
  shutdown() {
    // No-op for HTTP capture
  },
};

export function getPostHogServerClient() {
  return posthog;
}

export default posthog;
