import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import {
  LocationImportMode,
  LocationImportSourceType,
  prisma,
  type LocationImportSourceType as LocationImportSourceTypeValue
} from "@indihub/database";
import { bundledLocationDataset } from "../../apps/api/src/locations/bundled-location-data";
import {
  importLocationDataset,
  parseNormalizedLocationCsv,
  type LocationImportDataset,
  type LocationImportSourceInput
} from "../../apps/api/src/locations/location-importer";

type CliArgs = Record<string, string | true>;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = parseMode(args.mode);
  const dataset = await loadDataset(args);
  const result = await importLocationDataset(prisma, dataset, mode);

  console.log(
    [
      `Location ${mode.toLowerCase()} completed`,
      `run=${result.runId}`,
      `status=${result.status}`,
      `countries=${result.importedCountries}`,
      `states=${result.importedSubdivisions}`,
      `cities=${result.importedCities}`,
      `areas=${result.importedAreas}`,
      `skipped=${result.skippedRows}`
    ].join(" ")
  );
}

async function loadDataset(args: CliArgs): Promise<LocationImportDataset> {
  const file = stringArg(args.file);
  if (!file) {
    return bundledLocationDataset;
  }

  const absolutePath = resolve(process.cwd(), file);
  const content = await readFile(absolutePath, "utf8");
  const extension = extname(absolutePath).toLowerCase();

  if (extension === ".json") {
    return JSON.parse(content) as LocationImportDataset;
  }

  if (extension === ".csv") {
    return parseNormalizedLocationCsv(content, sourceFromArgs(args, absolutePath));
  }

  throw new Error("Location imports support .csv and .json files.");
}

function sourceFromArgs(args: CliArgs, filePath: string): LocationImportSourceInput {
  const sourceType = parseSourceType(stringArg(args.sourceType) ?? "MANUAL_CSV");
  const fallbackCode = basename(filePath, extname(filePath)).replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();

  return {
    code: stringArg(args.sourceCode) ?? fallbackCode,
    name: stringArg(args.sourceName) ?? `Location import ${fallbackCode}`,
    provider: stringArg(args.provider) ?? "Manual source file",
    sourceType,
    countryCode: stringArg(args.countryCode) ?? null,
    sourceUrl: stringArg(args.sourceUrl) ?? filePath,
    licenseNote: stringArg(args.licenseNote) ?? null
  };
}

function parseArgs(values: string[]) {
  const args: CliArgs = {};

  for (let index = 0; index < values.length; index += 1) {
    const raw = values[index];
    if (raw === "--") {
      continue;
    }

    if (!raw?.startsWith("--")) {
      continue;
    }

    const key = raw.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function parseMode(value: string | true | undefined) {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (normalized === "REFRESH") {
    return LocationImportMode.REFRESH;
  }

  return LocationImportMode.IMPORT;
}

function parseSourceType(value: string): LocationImportSourceTypeValue {
  const normalized = value.trim().toUpperCase();
  const values = Object.values(LocationImportSourceType) as string[];

  if (!values.includes(normalized)) {
    throw new Error(`Unsupported source type ${value}. Use one of: ${values.join(", ")}.`);
  }

  return normalized as LocationImportSourceTypeValue;
}

function stringArg(value: string | true | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
