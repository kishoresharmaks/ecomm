import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { config as loadEnv } from "dotenv";
import { withSentryConfig } from "@sentry/nextjs";

const webDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = path.resolve(webDirectory, "../..");

loadEnv({ path: path.join(workspaceDirectory, ".env"), quiet: true });
loadEnv({ path: path.join(workspaceDirectory, ".env.sentry-build-plugin"), quiet: true });

const isWindows = process.platform === "win32";
const isDevelopment = process.env.NODE_ENV === "development";

// Pin the output tracing root to the monorepo root so Next.js does not
// auto-detect a stray lockfile in the parent directory (e.g. /root/package-lock.json
// when the PM2 process is launched from /root instead of /root/ecomm).
const outputFileTracingRoot = process.env.NEXT_OUTPUT_FILE_TRACING_ROOT
  ? path.resolve(process.env.NEXT_OUTPUT_FILE_TRACING_ROOT)
  : workspaceDirectory;
const defaultDevWebUrl = "http://192.168.1.2:3000";
const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const allowedDevOrigins = resolveAllowedDevOrigins();
const appEnvironment = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
const sentryEnabled = appEnvironment !== "development" || process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true";
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

const apiOrigin = originFromUrl(process.env.NEXT_PUBLIC_API_URL);
const imageRemotePatterns = buildImageRemotePatterns();

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot,
  allowedDevOrigins,
  poweredByHeader: false,
  compress: true,
  ...(isWindows ? { experimental: { workerThreads: true } } : {}),
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
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

const sentryNextConfig = sentryEnabled
  ? withWebWorkingDirectory(() =>
      withSentryConfig(nextConfig, {
        org: process.env.SENTRY_ORG ?? "demo-n0b",
        project: process.env.SENTRY_PROJECT ?? "javascript-nextjs",
        ...(sentryAuthToken ? { authToken: sentryAuthToken, widenClientFileUpload: true } : {}),
        tunnelRoute: "/_1hi/relay",
        hideSourceMaps: true,
        silent: !process.env.CI || !sentryAuthToken,
      }),
    )
  : nextConfig;

export default sentryNextConfig;

function withWebWorkingDirectory(callback) {
  const originalWorkingDirectory = process.cwd();

  if (path.resolve(originalWorkingDirectory) === path.resolve(webDirectory)) {
    return callback();
  }

  try {
    process.chdir(webDirectory);
    return callback();
  } finally {
    process.chdir(originalWorkingDirectory);
  }
}

function buildImageRemotePatterns() {
  const configuredOrigins = [
    apiOrigin,
    "https://images.unsplash.com",
    "https://ik.imagekit.io",
    ...(isDevelopment ? ["https://example.com"] : []),
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
