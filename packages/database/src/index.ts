import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "./generated/prisma/client";
export { CodCollectionStatus } from "./generated/prisma/enums";
export type { CodCollectionStatus as CodCollectionStatusValue } from "./generated/prisma/enums";

declare global {
  var indihubPrisma: PrismaClient | undefined;
}

loadLocalEnv();

const connectionString =
  normalizePgSslMode(
    nonEmptyEnv("DATABASE_URL") ?? "postgresql://postgres:postgres@localhost:5432/indihub?schema=public"
  );
const isProductionRuntime =
  process.env.NODE_ENV === "production" || process.env.INDIHUB_ENV === "production";
const transactionMaxWaitMs = positiveIntegerEnv(
  "PRISMA_TRANSACTION_MAX_WAIT_MS",
  isProductionRuntime ? 10_000 : 15_000,
);
const transactionTimeoutMs = positiveIntegerEnv("PRISMA_TRANSACTION_TIMEOUT_MS", 30_000);
const poolMax = positiveIntegerEnv("PG_POOL_MAX", isProductionRuntime ? 10 : 6);
const poolConnectionTimeoutMs = positiveIntegerEnv(
  "PG_POOL_CONNECTION_TIMEOUT_MS",
  isProductionRuntime ? 10_000 : 30_000,
);
const poolIdleTimeoutMs = positiveIntegerEnv(
  "PG_POOL_IDLE_TIMEOUT_MS",
  isProductionRuntime ? 60_000 : 30_000,
);
const poolMaxLifetimeSeconds = positiveIntegerEnv(
  "PG_POOL_MAX_LIFETIME_SECONDS",
  isProductionRuntime ? 900 : 300,
);
const poolKeepAliveInitialDelayMs = positiveIntegerEnv("PG_POOL_KEEP_ALIVE_INITIAL_DELAY_MS", 10_000);
const poolAllowExitOnIdle = booleanEnv("PG_POOL_ALLOW_EXIT_ON_IDLE", false);

function createPrismaClient() {
  const poolConfig: PoolConfig = {
    connectionString,
    max: poolMax,
    connectionTimeoutMillis: poolConnectionTimeoutMs,
    idleTimeoutMillis: poolIdleTimeoutMs,
    keepAlive: true,
    keepAliveInitialDelayMillis: poolKeepAliveInitialDelayMs,
    maxLifetimeSeconds: poolMaxLifetimeSeconds,
    allowExitOnIdle: poolAllowExitOnIdle,
    application_name: process.env.PG_APP_NAME ?? "indihub-api"
  };
  const adapter = new PrismaPg(poolConfig);
  return new PrismaClient({
    adapter,
    transactionOptions: {
      maxWait: transactionMaxWaitMs,
      timeout: transactionTimeoutMs,
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });
}

export const prisma = globalThis.indihubPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.indihubPrisma = prisma;
}

export * from "./generated/prisma/client";

function loadLocalEnv() {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
    resolve(packageRoot, ".env")
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      applyEnvFile(envPath);
    }
  }
}

function applyEnvFile(envPath: string) {
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    process.env[key] ??= value;
  }
}

function normalizePgSslMode(value: string) {
  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get("sslmode")?.trim().toLowerCase();

    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function positiveIntegerEnv(key: string, fallback: number) {
  const value = nonEmptyEnv(key);

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanEnv(key: string, fallback: boolean) {
  const value = process.env[key]?.trim().toLowerCase();

  if (!value) {
    return fallback;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return fallback;
}

function nonEmptyEnv(key: string) {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}
