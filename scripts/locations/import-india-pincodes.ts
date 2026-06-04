import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { LocationImportMode, prisma } from "@indihub/database";
import {
  buildIndiaPincodeDataset,
  INDIA_PINCODE_CATALOG_URL,
  INDIA_PINCODE_RESOURCE_ID,
  INDIA_PINCODE_SOURCE_URL,
  parseIndiaPincodeCsv,
  type IndiaPincodeRecord
} from "../../apps/api/src/locations/india-pincode-importer";
import {
  importLocationDataset,
  importLocationDatasetBulk,
  type LocationImportBulkOptions,
  type LocationImportResult
} from "../../apps/api/src/locations/location-importer";

type CliArgs = Record<string, string | true>;

type DataGovPincodeResponse = {
  status?: string;
  message?: string;
  total?: number | string;
  count?: number | string;
  offset?: number | string;
  limit?: number | string;
  updated_date?: string;
  records?: IndiaPincodeRecord[];
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pageLimit = positiveIntegerArg(args.limit, 5000, "limit");
  const mode = parseMode(args.mode);
  const importEngine = parseImportEngine(args);
  const bulkOptions: LocationImportBulkOptions = {
    batchSize: positiveIntegerArg(args.batchSize ?? args["batch-size"], 1000, "batch-size")
  };
  const { records, sourceUrl } = await loadRecords(args, pageLimit);
  const build = buildIndiaPincodeDataset(records, {
    sourceUrl
  });

  if (booleanArg(args.dryRun ?? args["dry-run"]) || booleanArg(args.preview)) {
    console.log(
      [
        "India pincode import preview",
        `accepted=${build.acceptedRows}`,
        `skipped=${build.skippedRows}`,
        `states=${build.quality.stateCount}`,
        `cities=${build.cityCount}`,
        `areas=${build.areaCount}`,
        `uniquePincodes=${build.quality.uniquePincodes}`,
        `duplicateRows=${build.quality.duplicateSourceRows}`,
        `readyToApply=${build.quality.readyToApply}`
      ].join(" ")
    );
    console.log(JSON.stringify(build.quality, null, 2));
    return;
  }

  if (importEngine === "bulk") {
    warnIfUsingPooledDatabaseUrl();
  }

  const result = await runImport(importEngine, build.dataset, mode, bulkOptions);

  console.log(
    [
      "India pincode import completed",
      `engine=${importEngine === "bulk" ? "bulk-staging" : "row-upsert"}`,
      `run=${result.runId}`,
      `status=${result.status}`,
      `accepted=${build.acceptedRows}`,
      `skipped=${build.skippedRows}`,
      `uniquePincodes=${build.quality.uniquePincodes}`,
      `duplicateRows=${build.quality.duplicateSourceRows}`,
      `states=${result.importedSubdivisions}`,
      `cities=${result.importedCities}`,
      `areas=${result.importedAreas}`
    ].join(" ")
  );
}

async function runImport(
  importEngine: "bulk" | "row",
  dataset: Parameters<typeof importLocationDataset>[1],
  mode: LocationImportMode,
  bulkOptions: LocationImportBulkOptions
): Promise<LocationImportResult> {
  if (importEngine === "row") {
    return importLocationDataset(prisma, dataset, mode);
  }

  return importLocationDatasetBulk(prisma, dataset, mode, bulkOptions);
}

async function loadRecords(args: CliArgs, pageLimit: number) {
  const file = stringArg(args.file);

  if (file) {
    const absolutePath = resolve(process.cwd(), file);
    const csv = await readFile(absolutePath, "utf8");
    return {
      records: parseIndiaPincodeCsv(csv),
      sourceUrl: stringArg(args.sourceUrl ?? args["source-url"]) ?? absolutePath
    };
  }

  const apiKey = apiKeyFromArgs(args);
  return {
    records: await fetchAllRecords(apiKey, pageLimit),
    sourceUrl: stringArg(args.sourceUrl ?? args["source-url"]) ?? INDIA_PINCODE_CATALOG_URL
  };
}

async function fetchAllRecords(apiKey: string, limit: number) {
  const records: IndiaPincodeRecord[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await fetchPage(apiKey, offset, limit);
    const pageRecords = response.records ?? [];
    const responseTotal = numericValue(response.total);

    if (Number.isFinite(responseTotal)) {
      total = responseTotal;
    }

    if (!pageRecords.length) {
      break;
    }

    records.push(...pageRecords);
    offset += pageRecords.length;
    console.log(`Fetched India pincode rows ${records.length}/${Number.isFinite(total) ? total : "unknown"}`);
  }

  return records;
}

async function fetchPage(apiKey: string, offset: number, limit: number): Promise<DataGovPincodeResponse> {
  const url = new URL(INDIA_PINCODE_SOURCE_URL);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "1HandIndia location importer"
    }
  });

  if (!response.ok) {
    throw new Error(`data.gov.in pincode request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as DataGovPincodeResponse;
  if (payload.status && payload.status !== "ok") {
    throw new Error(payload.message || "data.gov.in pincode request failed.");
  }

  return payload;
}

function apiKeyFromArgs(args: CliArgs) {
  const apiKey = stringArg(args.apiKey ?? args["api-key"]) ?? process.env.DATAGOVINDIA_API_KEY ?? process.env.DATA_GOV_IN_API_KEY;

  if (!apiKey) {
    throw new Error(
      [
        "India pincode import requires a data.gov.in API key.",
        "Set DATAGOVINDIA_API_KEY or pass --api-key.",
        `Resource: ${INDIA_PINCODE_RESOURCE_ID}`
      ].join(" ")
    );
  }

  return apiKey;
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

  if (normalized === "IMPORT") {
    return LocationImportMode.IMPORT;
  }

  return LocationImportMode.REFRESH;
}

function parseImportEngine(args: CliArgs): "bulk" | "row" {
  const normalized = stringArg(args.importEngine ?? args["import-engine"])?.toLowerCase();

  if (!normalized || normalized === "bulk" || normalized === "bulk-staging") {
    return "bulk";
  }

  if (normalized === "row" || normalized === "row-upsert") {
    return "row";
  }

  throw new Error("Unsupported import engine. Use bulk or row.");
}

function positiveIntegerArg(value: string | true | undefined, fallback: number, field: string) {
  if (value === undefined || value === true || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }

  return parsed;
}

function numericValue(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function stringArg(value: string | true | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanArg(value: string | true | undefined) {
  if (value === true) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
}

function warnIfUsingPooledDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!/pooler/i.test(databaseUrl)) {
    return;
  }

  console.warn(
    [
      "Bulk location import detected a pooled database URL.",
      "For large Neon imports, use the direct database URL when possible to reduce long-running import disconnects.",
      "The pooled URL can still work, but direct is safer for this operation."
    ].join(" ")
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
