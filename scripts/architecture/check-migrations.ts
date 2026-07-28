import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MigrationBaselineManifest = {
  schemaVersion: number;
  baselineSql: string;
  hardeningScript: string;
  throughMigration: string;
};

export type MigrationHygieneResult = {
  invalidEntries: string[];
  emptyMigrations: string[];
  validMigrations: string[];
  baselineErrors: string[];
  baselineThroughMigration?: string;
  postBaselineMigrations: string[];
};

const timestampedMigration = /^\d{14}_[a-z0-9_]+$/;

export function checkMigrationHygiene(
  migrationsRoot: string,
  manifestPath = resolve(migrationsRoot, "../baselines/manifest.json"),
): MigrationHygieneResult {
  const result: MigrationHygieneResult = {
    invalidEntries: [],
    emptyMigrations: [],
    validMigrations: [],
    baselineErrors: [],
    postBaselineMigrations: [],
  };
  if (!existsSync(migrationsRoot)) {
    result.invalidEntries.push("prisma/migrations directory is missing");
    return result;
  }

  for (const entry of readdirSync(migrationsRoot, { withFileTypes: true })) {
    const path = join(migrationsRoot, entry.name);
    if (!entry.isDirectory() || !timestampedMigration.test(entry.name)) {
      if (entry.name === "migration.sql" && entry.isFile() && !readFileSync(path, "utf8").trim()) {
        continue;
      }
      result.invalidEntries.push(entry.name);
      continue;
    }
    const migrationPath = join(path, "migration.sql");
    if (!existsSync(migrationPath) || !statSync(migrationPath).isFile()) {
      result.invalidEntries.push(`${entry.name}/migration.sql (missing)`);
      continue;
    }
    if (!readFileSync(migrationPath, "utf8").trim()) {
      result.emptyMigrations.push(`${entry.name}/migration.sql`);
      continue;
    }
    result.validMigrations.push(entry.name);
  }

  result.validMigrations.sort();
  checkBaselineManifest(result, manifestPath);
  return result;
}

function checkBaselineManifest(result: MigrationHygieneResult, manifestPath: string) {
  if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
    result.baselineErrors.push("prisma/baselines/manifest.json is missing");
    return;
  }

  let manifest: MigrationBaselineManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as MigrationBaselineManifest;
  } catch {
    result.baselineErrors.push("prisma/baselines/manifest.json is not valid JSON");
    return;
  }

  if (manifest.schemaVersion !== 1) {
    result.baselineErrors.push("baseline manifest schemaVersion must be 1");
  }
  if (!manifest.baselineSql?.trim()) {
    result.baselineErrors.push("baseline manifest baselineSql is missing");
  }
  if (!manifest.hardeningScript?.trim()) {
    result.baselineErrors.push("baseline manifest hardeningScript is missing");
  }
  if (!manifest.throughMigration?.trim()) {
    result.baselineErrors.push("baseline manifest throughMigration is missing");
    return;
  }

  result.baselineThroughMigration = manifest.throughMigration;
  const cutoffIndex = result.validMigrations.indexOf(manifest.throughMigration);
  if (cutoffIndex < 0) {
    result.baselineErrors.push(
      `baseline cutoff migration does not exist: ${manifest.throughMigration}`,
    );
  } else {
    result.postBaselineMigrations = result.validMigrations.slice(cutoffIndex + 1);
  }

  const projectRoot = resolve(dirname(manifestPath), "../..");
  checkManifestFile(result, projectRoot, manifest.baselineSql, "baseline SQL");
  checkManifestFile(result, projectRoot, manifest.hardeningScript, "baseline hardening script");
}

function checkManifestFile(
  result: MigrationHygieneResult,
  projectRoot: string,
  relativePath: string | undefined,
  label: string,
) {
  if (!relativePath?.trim()) return;
  if (isAbsolute(relativePath)) {
    result.baselineErrors.push(`${label} path must be project-relative: ${relativePath}`);
    return;
  }
  const path = resolve(projectRoot, relativePath);
  if (!existsSync(path) || !statSync(path).isFile()) {
    result.baselineErrors.push(`${label} is missing: ${relativePath}`);
    return;
  }
  if (!readFileSync(path, "utf8").trim()) {
    result.baselineErrors.push(`${label} is empty: ${relativePath}`);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = checkMigrationHygiene(resolve(projectRoot, "prisma/migrations"));
  console.log(`Migration hygiene: ${result.validMigrations.length} valid migration(s).`);
  if (result.baselineThroughMigration) {
    console.log(
      `Migration baseline: through ${result.baselineThroughMigration}; ` +
        `${result.postBaselineMigrations.length} incremental migration(s).`,
    );
  }
  if (result.invalidEntries.length) console.error("Invalid migration entries:", result.invalidEntries);
  if (result.emptyMigrations.length) console.error("Empty migrations:", result.emptyMigrations);
  if (result.baselineErrors.length) console.error("Migration baseline errors:", result.baselineErrors);
  if (result.invalidEntries.length || result.emptyMigrations.length || result.baselineErrors.length) {
    process.exitCode = 1;
  }
}
