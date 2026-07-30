import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { buildProductionBaselineHardening } from "./print-production-baseline-hardening.mjs";

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(resolve(root, "prisma/baselines/manifest.json"), "utf8"),
);
const outputPath = resolve(
  root,
  "prisma/baselines/20260730_complete_production_schema.sql",
);
const migrationsPath = resolve(root, "prisma/migrations");
const laterMigrations = readdirSync(migrationsPath, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && entry.name > manifest.throughMigration,
  )
  .map((entry) => entry.name)
  .sort();

const read = (relativePath) =>
  readFileSync(resolve(root, relativePath), "utf8").replace(/^\uFEFF/, "").trim();
const hardening = buildProductionBaselineHardening().trim();
const sections = [
  `-- 1HandIndia complete production schema bootstrap.
-- Generated on 2026-07-30 for a completely empty PostgreSQL database only.
-- Includes the approved baseline through ${manifest.throughMigration},
-- PostgreSQL-only hardening, and every later migration available at generation time.
-- This file does not populate Prisma's _prisma_migrations table.`,
  read(manifest.baselineSql),
  `-- PostgreSQL-only baseline hardening\n${hardening}`,
  ...laterMigrations.map(
    (migrationName) =>
      `-- Migration: ${migrationName}\n${read(
        join("prisma/migrations", migrationName, "migration.sql"),
      )}`,
  ),
];
const output = `${sections.join("\n\n")}\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(outputPath, "utf8") !== output) {
    throw new Error(`${basename(outputPath)} is stale. Run pnpm db:baseline:build.`);
  }
  console.log(`${basename(outputPath)} is current.`);
} else {
  writeFileSync(outputPath, output);
  console.log(
    `Wrote ${basename(outputPath)} with ${laterMigrations.length} post-baseline migrations.`,
  );
}
