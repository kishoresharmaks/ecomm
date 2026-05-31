import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
export { CodCollectionStatus } from "./generated/prisma/enums";
export type { CodCollectionStatus as CodCollectionStatusValue } from "./generated/prisma/enums";

declare global {
  var indihubPrisma: PrismaClient | undefined;
}

loadLocalEnv();

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/indihub?schema=public";
const transactionMaxWaitMs = positiveIntegerEnv("PRISMA_TRANSACTION_MAX_WAIT_MS", 15_000);
const transactionTimeoutMs = positiveIntegerEnv("PRISMA_TRANSACTION_TIMEOUT_MS", 30_000);

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString });
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

function positiveIntegerEnv(key: string, fallback: number) {
  const value = process.env[key];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
