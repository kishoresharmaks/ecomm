import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type MigrationHygieneResult = {
  invalidEntries: string[];
  emptyMigrations: string[];
  validMigrations: string[];
};

const timestampedMigration = /^\d{14}_[a-z0-9_]+$/;

export function checkMigrationHygiene(migrationsRoot: string): MigrationHygieneResult {
  const result: MigrationHygieneResult = {
    invalidEntries: [],
    emptyMigrations: [],
    validMigrations: [],
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
  return result;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = checkMigrationHygiene(resolve(projectRoot, "prisma/migrations"));
  console.log(`Migration hygiene: ${result.validMigrations.length} valid migration(s).`);
  if (result.invalidEntries.length) console.error("Invalid migration entries:", result.invalidEntries);
  if (result.emptyMigrations.length) console.error("Empty migrations:", result.emptyMigrations);
  if (result.invalidEntries.length || result.emptyMigrations.length) process.exitCode = 1;
}
