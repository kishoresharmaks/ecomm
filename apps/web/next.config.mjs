import process from "node:process";
import { URL } from "node:url";
import { config as loadEnv } from "dotenv";
import { withSentryConfig } from "@sentry/nextjs";

loadEnv({ path: "../../.env", quiet: true });
loadEnv({ path: "../../.env.sentry-build-plugin", quiet: true });

const isWindows = process.platform === "win32";
const defaultDevWebUrl = "http://192.168.1.3:3000";
const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const allowedDevOrigins = resolveAllowedDevOrigins();
const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
const sentryEnabled = appEnvironment !== "development" || process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
  experimental: {
    ...(isWindows ? { workerThreads: true } : {})
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io"
      },
      {
        protocol: "https",
        hostname: "example.com",
        pathname: "/indihub-smoke-product.jpg"
      }
    ]
  },
  transpilePackages: [
    "@indihub/config",
    "@indihub/shared-types",
    "@indihub/ui",
    "@indihub/validators"
  ],
  async headers() {
    if (process.env.NODE_ENV === "development") {
      return [];
    }
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
             value: [
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://checkout.razorpay.com https://*.razorpay.com https://*.clerk.accounts.dev https://cdn.clerk.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https: data: blob:",
            "font-src 'self' data: https://fonts.gstatic.com",
            "connect-src 'self' https://www.google-analytics.com https://*.clerk.accounts.dev https://api.clerk.com https://clerk-telemetry.com",
            "frame-src https://checkout.razorpay.com https://*.razorpay.com https://*.clerk.accounts.dev",
            "worker-src 'self' blob:"
          ].join("; ")
          }
        ]
      }
    ];
  }
};

const sentryNextConfig = sentryEnabled ? withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "demo-n0b",
  project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/_1hi/relay",
  hideSourceMaps: true,
  silent: !process.env.CI,
}) : nextConfig;

export default sentryNextConfig;

function resolveAllowedDevOrigins() {
  const origins = [
    process.env.NEXT_PUBLIC_WEB_URL ?? defaultDevWebUrl,
    ...(process.env.API_CORS_ORIGINS?.split(",") ?? [])
  ];

  return [
    ...new Set(
      origins
        .map((origin) => hostnameFromOrigin(origin))
        .filter((hostname) => hostname && !localHostnames.has(hostname)),
    )
  ];
}

function hostnameFromOrigin(origin) {
  const value = origin.trim().replace(/^["']|["']$/g, "");
  if (!value || value === "*") {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
