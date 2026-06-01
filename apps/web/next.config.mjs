import process from "node:process";
import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env", quiet: true });

const isWindows = process.platform === "win32";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
