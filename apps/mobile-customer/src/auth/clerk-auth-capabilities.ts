type ClerkEnvironmentResponse = {
  auth_config?: {
    phone_number?: string;
  };
  user_settings?: {
    attributes?: {
      phone_number?: {
        enabled?: boolean;
        used_for_first_factor?: boolean;
      };
    };
  };
};

const DEFAULT_CLERK_FRONTEND_API_URL = "https://clerk.1handindia.com";

export async function getClerkAuthCapabilities() {
  const response = await fetch(`${clerkFrontendApiUrl()}/v1/environment`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Clerk authentication capabilities are unavailable.");
  }

  return parseClerkAuthCapabilities(await response.json() as ClerkEnvironmentResponse);
}

export function parseClerkAuthCapabilities(environment: ClerkEnvironmentResponse) {
  const phoneSettings = environment.user_settings?.attributes?.phone_number;

  return {
    phoneEnabled:
      environment.auth_config?.phone_number === "on" &&
      phoneSettings?.enabled === true &&
      phoneSettings.used_for_first_factor === true,
  };
}

export function clerkFrontendApiUrl(
  configuredUrl = process.env.EXPO_PUBLIC_CLERK_FRONTEND_API_URL,
  publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
) {
  const explicitUrl = configuredUrl?.trim().replace(/\/+$/, "");
  if (explicitUrl) {
    return explicitUrl;
  }

  const encodedFrontendApi = publishableKey?.trim().replace(/^pk_(?:test|live)_/, "");
  if (encodedFrontendApi && typeof globalThis.atob === "function") {
    try {
      const padded = encodedFrontendApi.padEnd(Math.ceil(encodedFrontendApi.length / 4) * 4, "=");
      const host = globalThis.atob(padded).replace(/\$$/, "").trim();
      if (host && /^[a-z0-9.-]+$/i.test(host)) {
        return `https://${host}`;
      }
    } catch {
      // Fall through to the approved production frontend API.
    }
  }

  return DEFAULT_CLERK_FRONTEND_API_URL;
}
