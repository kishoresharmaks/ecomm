import process from "node:process";
import { URL } from "node:url";
import { config as loadEnv } from "dotenv";
import { withSentryConfig } from "@sentry/nextjs";

loadEnv({ path: "../../.env", quiet: true });
loadEnv({ path: "../../.env.sentry-build-plugin", quiet: true });

const isWindows = process.platform === "win32";
const isDevelopment = process.env.NODE_ENV === "development";
const defaultDevWebUrl = "http://192.168.1.3:3000";
const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const allowedDevOrigins = resolveAllowedDevOrigins();
const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
const sentryEnabled = appEnvironment !== "development" || process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true";

const webOrigin = originFromUrl(process.env.NEXT_PUBLIC_WEB_URL);
const apiOrigin = originFromUrl(process.env.NEXT_PUBLIC_API_URL);
const clerkFrontendOrigin = originFromUrl(process.env.NEXT_PUBLIC_CLERK_FRONTEND_API);
const extraConnectOrigins = parseCsvOrigins(process.env.NEXT_PUBLIC_CSP_CONNECT_SRC);
const extraImageOrigins = parseCsvOrigins(process.env.NEXT_PUBLIC_CSP_IMG_SRC);
const extraFrameOrigins = parseCsvOrigins(process.env.NEXT_PUBLIC_CSP_FRAME_SRC);
const imageRemotePatterns = buildImageRemotePatterns();

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
  poweredByHeader: false,
  compress: true,
  experimental: {
    ...(isWindows ? { workerThreads: true } : {}),
  },
  images: {
    remotePatterns: imageRemotePatterns,
  },
  transpilePackages: [
    "@indihub/config",
    "@indihub/shared-types",
    "@indihub/ui",
    "@indihub/validators",
  ],
  async headers() {
    if (isDevelopment) {
      return [];
    }

    return [
      {
        source: "/(.*)",
        headers: productionSecurityHeaders(),
      },
    ];
  },
};

const sentryNextConfig = sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG ?? "demo-n0b",
      project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      tunnelRoute: "/_1hi/relay",
      hideSourceMaps: true,
      silent: !process.env.CI,
    })
  : nextConfig;

export default sentryNextConfig;

function productionSecurityHeaders() {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
    },
  ];
}

function buildContentSecurityPolicy() {
  const clerkOrigins = [
    "https://*.clerk.accounts.dev",
    "https://*.clerk.com",
    "https://api.clerk.com",
    "https://cdn.clerk.com",
    "https://clerk-telemetry.com",
    clerkFrontendOrigin,
  ];
  const razorpayOrigins = ["https://checkout.razorpay.com", "https://*.razorpay.com"];
  const analyticsOrigins = [
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://static.cloudflareinsights.com",
  ];
  const sentryOrigins = [webOrigin ? `${webOrigin}/_1hi/relay` : null];

  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["script-src", "'self'", "'unsafe-inline'", "'unsafe-eval'", ...analyticsOrigins, ...razorpayOrigins, ...clerkOrigins],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "https:", "data:", "blob:", ...extraImageOrigins],
    ["font-src", "'self'", "data:", "https://fonts.gstatic.com"],
    [
      "connect-src",
      "'self'",
      apiOrigin,
      ...analyticsOrigins,
      ...clerkOrigins,
      ...sentryOrigins,
      ...extraConnectOrigins,
    ],
    ["frame-src", ...razorpayOrigins, ...clerkOrigins, ...extraFrameOrigins],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["form-action", "'self'", ...razorpayOrigins],
    ["frame-ancestors", "'self'"],
  ];

  return directives
    .map(([directive, ...sources]) => [directive, ...uniqueNonEmpty(sources)].join(" "))
    .join("; ");
}

function buildImageRemotePatterns() {
  const configuredOrigins = [
    "https://images.unsplash.com",
    "https://ik.imagekit.io",
    "https://example.com",
    ...parseCsvOrigins(process.env.NEXT_PUBLIC_IMAGE_REMOTE_ORIGINS),
  ];

  return configuredOrigins
    .map((origin) => {
      try {
        const url = new URL(origin);
        return {
          protocol: url.protocol.replace(":", ""),
          hostname: url.hostname,
          ...(url.pathname && url.pathname !== "/" ? { pathname: `${url.pathname.replace(/\/$/, "")}/**` } : {}),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function resolveAllowedDevOrigins() {
  const origins = [
    process.env.NEXT_PUBLIC_WEB_URL ?? defaultDevWebUrl,
    ...(process.env.API_CORS_ORIGINS?.split(",") ?? []),
  ];

  return [
    ...new Set(
      origins
        .map((origin) => hostnameFromOrigin(origin))
        .filter((hostname) => hostname && !localHostnames.has(hostname)),
    ),
  ];
}

function hostnameFromOrigin(origin) {
  const value = origin?.trim().replace(/^["']|["']$/g, "");
  if (!value || value === "*") {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function originFromUrl(value) {
  const normalizedValue = value?.trim().replace(/^["']|["']$/g, "");
  if (!normalizedValue) {
    return null;
  }

  try {
    return new URL(normalizedValue).origin;
  } catch {
    return null;
  }
}

function parseCsvOrigins(value) {
  return uniqueNonEmpty(
    value
      ?.split(",")
      .map((item) => originFromUrl(item) ?? item.trim().replace(/^["']|["']$/g, "")) ?? [],
  );
}

function uniqueNonEmpty(values) {
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : value))
        .filter(Boolean),
    ),
  ];
}
