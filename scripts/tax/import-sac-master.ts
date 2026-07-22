import "dotenv/config";
import { readFile } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import {
  SacMasterImportStatus,
  prisma,
  type Prisma,
} from "../../packages/database/src/index";
import {
  normalizeSacRows,
  parseNormalizedSacCsv,
  planSacImport,
  type SacImportRow,
} from "../../apps/api/src/sac-master/sac-master-import";

const OFFICIAL_SOURCE_DOCUMENT = "GST Scheme of Classification of Services";
const OFFICIAL_SOURCE_REFERENCE =
  "https://gstcouncil.gov.in/sites/default/files/2024-02/scheme_of_classification_of_services_amended.pdf";

type CliArgs = Record<string, string | true>;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = stringArg(args.file);
  if (!file) {
    throw new Error(
      "Provide a normalized SAC catalogue with --file <path.csv|path.json>. Required columns: sac_code, description.",
    );
  }

  const absolutePath = resolve(process.cwd(), file);
  const rows = await loadRows(absolutePath);
  const existing = await prisma.sacMaster.findMany({
    select: { id: true, sacCode: true, description: true, isActive: true },
    orderBy: { sacCode: "asc" },
  });
  const apply = args.apply === true;
  const deactivateMissing = args["deactivate-missing"] === true;
  const plan = planSacImport(rows, existing, deactivateMissing);
  const sourceDocument = stringArg(args.sourceDocument) ?? OFFICIAL_SOURCE_DOCUMENT;
  const sourceReference = stringArg(args.sourceReference) ?? OFFICIAL_SOURCE_REFERENCE;
  const sourceVersion =
    stringArg(args.sourceVersion) ?? basename(absolutePath, extname(absolutePath));
  const effectiveDate = optionalDate(stringArg(args.effectiveDate));

  console.log(
    [
      apply ? "SAC import apply plan" : "SAC import dry run",
      `rows=${plan.rows.length}`,
      `insert=${plan.inserts.length}`,
      `update=${plan.updates.length}`,
      `unchanged=${plan.unchanged.length}`,
      `deactivate=${plan.deactivations.length}`,
      `checksum=${plan.checksum}`,
    ].join(" "),
  );

  if (!apply) {
    printSamples(plan);
    console.log(
      "No database changes were made. Review the counts, then run tax:sac:import with the same file.",
    );
    return;
  }
  if (process.env.INDIHUB_ALLOW_SAC_MASTER_IMPORT !== "true") {
    throw new Error(
      "Set INDIHUB_ALLOW_SAC_MASTER_IMPORT=true for this approved catalogue import.",
    );
  }

  const importedAt = new Date();
  await prisma.$transaction(async (tx) => {
    if (plan.inserts.length) {
      await tx.sacMaster.createMany({
        data: plan.inserts.map((row) =>
          provenanceData(
            row,
            sourceDocument,
            sourceReference,
            sourceVersion,
            effectiveDate,
            plan.checksum,
            importedAt,
          ),
        ),
      });
    }

    for (const row of [...plan.updates, ...plan.unchanged]) {
      await tx.sacMaster.update({
        where: { id: row.id },
        data: provenanceData(
          row,
          sourceDocument,
          sourceReference,
          sourceVersion,
          effectiveDate,
          plan.checksum,
          importedAt,
        ),
      });
    }

    if (plan.deactivations.length) {
      await tx.sacMaster.updateMany({
        where: { id: { in: plan.deactivations.map((row) => row.id) } },
        data: { isActive: false, importedAt },
      });
    }

    await tx.sacMasterImportRun.create({
      data: {
        status: SacMasterImportStatus.COMPLETED,
        sourceDocument,
        sourceReference,
        effectiveDate,
        sourceVersion,
        importChecksum: plan.checksum,
        rowCount: plan.rows.length,
        insertedCount: plan.inserts.length,
        updatedCount: plan.updates.length,
        deactivatedCount: plan.deactivations.length,
        metadata: {
          fileName: basename(absolutePath),
          deactivateMissing,
          unchangedCount: plan.unchanged.length,
        },
      },
    });
  });

  console.log("SAC master import completed.");
}

async function loadRows(filePath: string): Promise<SacImportRow[]> {
  const content = await readFile(filePath, "utf8");
  const extension = extname(filePath).toLowerCase();
  if (extension === ".csv") {
    return parseNormalizedSacCsv(content);
  }
  if (extension === ".json") {
    const parsed: unknown = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      throw new Error("SAC JSON must be an array of { sacCode, description } records.");
    }
    return normalizeSacRows(parsed as SacImportRow[]);
  }
  throw new Error("SAC imports support .csv and .json files.");
}

function provenanceData(
  row: SacImportRow,
  sourceDocument: string,
  sourceReference: string,
  sourceVersion: string,
  effectiveDate: Date | null,
  importChecksum: string,
  importedAt: Date,
): Prisma.SacMasterUncheckedCreateInput {
  return {
    sacCode: row.sacCode,
    description: row.description,
    isActive: true,
    sourceDocument,
    sourceReference,
    effectiveDate,
    sourceVersion,
    importChecksum,
    importedAt,
  };
}

function printSamples(plan: ReturnType<typeof planSacImport>) {
  const sample = (label: string, values: Array<{ sacCode: string; description: string }>) => {
    if (values.length) {
      console.log(`${label}:`, values.slice(0, 10));
    }
  };
  sample("Insert sample", plan.inserts);
  sample("Update sample", plan.updates);
  sample("Deactivate sample", plan.deactivations);
}

function optionalDate(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("effectiveDate must use YYYY-MM-DD.");
  }
  return date;
}

function parseArgs(values: string[]) {
  const args: CliArgs = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value?.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function stringArg(value: string | true | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "SAC master import failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
