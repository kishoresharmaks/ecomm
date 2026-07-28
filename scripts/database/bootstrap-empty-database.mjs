import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "prisma/baselines/manifest.json");
const migrationsRoot = resolve(root, "prisma/migrations");
const prismaExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const emptyDatabasePreflight = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
  ) OR EXISTS (
    SELECT 1
    FROM pg_type AS type
    JOIN pg_namespace AS namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typtype = 'e'
  ) THEN
    RAISE EXCEPTION 'database is not empty; refusing baseline bootstrap';
  END IF;
END
$$;
`;

main();

function main() {
  assertDisposableDatabase();
  const manifest = readManifest();
  const baselineSql = resolveProjectPath(manifest.baselineSql, "baseline SQL");
  const hardeningScript = resolveProjectPath(manifest.hardeningScript, "hardening script");
  const migrations = migrationNames();
  const cutoffIndex = migrations.indexOf(manifest.throughMigration);

  if (cutoffIndex < 0) {
    fail(`Baseline cutoff migration does not exist: ${manifest.throughMigration}`);
  }

  const representedMigrations = migrations.slice(0, cutoffIndex + 1);
  const incrementalMigrations = migrations.slice(cutoffIndex + 1);

  console.log(
    `Bootstrapping disposable database from ${manifest.baselineSql}; ` +
      `${representedMigrations.length} migration(s) are represented by the baseline and ` +
      `${incrementalMigrations.length} later migration(s) will be deployed.`,
  );

  runPrisma(["db", "execute", "--stdin"], emptyDatabasePreflight);
  runPrisma(["db", "execute", "--file", baselineSql]);
  const hardeningSql = execFileSync(process.execPath, [hardeningScript], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  runPrisma(["db", "execute", "--stdin"], hardeningSql);

  for (const migration of representedMigrations) {
    runPrisma(["migrate", "resolve", "--applied", migration]);
  }

  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"]);
  console.log("Disposable database bootstrap completed successfully.");
}

function assertDisposableDatabase() {
  if (process.env.INDIHUB_ALLOW_EMPTY_DB_BOOTSTRAP !== "true") {
    fail("INDIHUB_ALLOW_EMPTY_DB_BOOTSTRAP must be true.");
  }
  if (process.env.INDIHUB_ALLOW_INTEGRATION_TEST_DB !== "true") {
    fail("INDIHUB_ALLOW_INTEGRATION_TEST_DB must be true.");
  }
  if (isProtectedEnvironment()) {
    fail("Empty-database bootstrap is forbidden in production, staging, or pre-production.");
  }

  const databaseUrl = nonEmptyEnv("DATABASE_DIRECT_URL") ?? nonEmptyEnv("DATABASE_URL");
  if (!databaseUrl) fail("DATABASE_DIRECT_URL or DATABASE_URL must be configured.");

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail("The configured database URL could not be parsed safely.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!localHosts.has(parsed.hostname.toLowerCase())) {
    fail("Empty-database bootstrap only permits a local disposable PostgreSQL service.");
  }
  if (!/(test|e2e|integration)/i.test(databaseName)) {
    fail("The disposable database name must include test, e2e, or integration.");
  }
}

function readManifest() {
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    fail("Missing prisma/baselines/manifest.json.");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    manifest?.schemaVersion !== 1 ||
    typeof manifest.baselineSql !== "string" ||
    typeof manifest.hardeningScript !== "string" ||
    typeof manifest.throughMigration !== "string"
  ) {
    fail("Invalid prisma/baselines/manifest.json.");
  }
  return manifest;
}

function resolveProjectPath(relativePath, label) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    fail(`Missing ${label}: ${relativePath}`);
  }
  if (!readFileSync(absolutePath, "utf8").trim()) {
    fail(`Empty ${label}: ${relativePath}`);
  }
  return absolutePath;
}

function migrationNames() {
  if (!existsSync(migrationsRoot)) fail("Missing prisma/migrations directory.");
  return readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_[a-z0-9_]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function runPrisma(args, input) {
  const result = spawnSync(prismaExecutable, ["exec", "prisma", ...args], {
    cwd: root,
    env: process.env,
    input,
    stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function isProtectedEnvironment() {
  const values = [process.env.NODE_ENV, process.env.INDIHUB_ENV, process.env.APP_ENV]
    .filter(Boolean)
    .map((value) => value.trim().toLowerCase());
  return (
    process.env.INDIHUB_PRODUCTION === "true" ||
    values.some((value) => ["production", "prod", "staging", "stage", "preproduction", "preprod"].includes(value))
  );
}

function nonEmptyEnv(name) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function fail(message) {
  console.error(`[empty-db-bootstrap] ${message}`);
  process.exit(1);
}
