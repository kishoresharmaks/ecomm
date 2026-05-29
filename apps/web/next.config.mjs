import { config as loadEnv } from "dotenv";

loadEnv({ path: "../../.env", quiet: true });

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  experimental: {
    cpus: 1,
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
    staticGenerationMaxConcurrency: 1,
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
    workerThreads: true
  }
};

export default nextConfig;
