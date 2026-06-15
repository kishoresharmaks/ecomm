import process from "node:process";
import { URL } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env", quiet: true });

const isWindows = process.platform === "win32";
const defaultDevWebUrl = "http://192.168.1.3:3000";
const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const allowedDevOrigins = resolveAllowedDevOrigins();

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
  ]
};

export default nextConfig;

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
