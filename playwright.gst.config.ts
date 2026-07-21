import { defineConfig, devices } from "@playwright/test";

const runGstE2e = process.env.GST_E2E_RUN === "true";
const databaseUrl = process.env.GST_E2E_DATABASE_URL ?? "";

if (runGstE2e) {
  let databaseName = "";
  try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  } catch {
    throw new Error("GST_E2E_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!/(test|e2e|integration)/i.test(databaseName)) {
    throw new Error(
      "GST browser tests require a disposable database name containing test, e2e, or integration.",
    );
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "gst-reports.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.GST_E2E_WEB_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "gst-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "gst-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  ...(process.env.GST_E2E_START_SERVERS === "true"
    ? {
        webServer: [
          {
            command: "pnpm.cmd --filter @indihub/api dev",
            url: process.env.GST_E2E_API_HEALTH_URL ?? "http://localhost:4000/api/health",
            reuseExistingServer: true,
            timeout: 120_000,
            env: {
              ...process.env,
              DATABASE_URL: databaseUrl,
              DATABASE_DIRECT_URL: databaseUrl,
              INDIHUB_ALLOW_INTEGRATION_TEST_DB: "true",
            },
          },
          {
            command: "pnpm.cmd --filter @indihub/web dev",
            url: process.env.GST_E2E_WEB_URL ?? "http://localhost:3000",
            reuseExistingServer: true,
            timeout: 120_000,
          },
        ],
      }
    : {}),
});
