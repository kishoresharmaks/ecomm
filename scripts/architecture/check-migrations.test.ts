import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMigrationHygiene } from "./check-migrations";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "indihub-migrations-"));
  const migrationsRoot = join(root, "prisma", "migrations");
  const baselinesRoot = join(root, "prisma", "baselines");
  const scriptsRoot = join(root, "scripts", "database");
  mkdirSync(migrationsRoot, { recursive: true });
  mkdirSync(baselinesRoot, { recursive: true });
  mkdirSync(scriptsRoot, { recursive: true });

  for (const migration of ["20260101000000_initial", "20260102000000_incremental"]) {
    const directory = join(migrationsRoot, migration);
    mkdirSync(directory);
    writeFileSync(join(directory, "migration.sql"), "SELECT 1;\n");
  }
  writeFileSync(join(baselinesRoot, "baseline.sql"), "CREATE TABLE example (id text);\n");
  writeFileSync(join(scriptsRoot, "hardening.mjs"), "process.stdout.write('SELECT 1;\\n');\n");

  return { root, migrationsRoot, manifestPath: join(baselinesRoot, "manifest.json") };
}

function writeManifest(
  fixtureRoot: ReturnType<typeof fixture>,
  overrides: Record<string, unknown> = {},
) {
  writeFileSync(
    fixtureRoot.manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      baselineSql: "prisma/baselines/baseline.sql",
      hardeningScript: "scripts/database/hardening.mjs",
      throughMigration: "20260101000000_initial",
      ...overrides,
    }),
  );
}

describe("migration baseline hygiene", () => {
  it("reports the baseline cutoff and later incremental migrations", () => {
    const files = fixture();
    writeManifest(files);

    expect(checkMigrationHygiene(files.migrationsRoot, files.manifestPath)).toMatchObject({
      baselineErrors: [],
      baselineThroughMigration: "20260101000000_initial",
      postBaselineMigrations: ["20260102000000_incremental"],
    });
  });

  it("fails when the baseline manifest is missing", () => {
    const files = fixture();

    expect(checkMigrationHygiene(files.migrationsRoot, files.manifestPath).baselineErrors).toEqual([
      "prisma/baselines/manifest.json is missing",
    ]);
  });

  it("fails when the baseline cutoff is not a tracked migration", () => {
    const files = fixture();
    writeManifest(files, { throughMigration: "20260103000000_missing" });

    expect(checkMigrationHygiene(files.migrationsRoot, files.manifestPath).baselineErrors).toContain(
      "baseline cutoff migration does not exist: 20260103000000_missing",
    );
  });
});
