import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type pino from "pino";
import {
  ReportExportStatus,
  ReportExportType,
  prisma,
  reportExportCsvHeader,
  reportExportCsvRow,
  reportExportFileName,
  reportExportRows,
  type ReportExportFilters,
} from "@indihub/database";
import {
  deletePrivateStoredFile,
  loadPrivateStorageConfig,
  markPrivateUploadDeleted,
  saveReportExportFile,
} from "./private-storage";

type Logger = pino.Logger;

type ClaimedExportJob = {
  id: string;
  exportType: ReportExportType;
  actorUserId: string;
  sellerId: string | null;
  filters: unknown;
  attempts: number;
  maxAttempts: number;
};

type ExpiredExport = {
  id: string;
  storageKey: string;
  provider: string;
};

const maxExportBytes = 250 * 1024 * 1024;
const retentionMs = 30 * 24 * 60 * 60 * 1000;

export function startReportExportPolling(logger: Logger) {
  if (process.env.REPORT_EXPORT_WORKER_ENABLED === "false") {
    logger.info("Report export worker disabled by REPORT_EXPORT_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.REPORT_EXPORT_POLL_INTERVAL_MS, 10_000);
  const batchSize = positiveInteger(process.env.REPORT_EXPORT_BATCH_SIZE, 2);
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const result = await processReportExportJobs(batchSize);
      if (result.claimed || result.expired) {
        logger.info(result, "Report export worker tick completed");
      }
    } catch (error) {
      logger.error({ error }, "Report export worker poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => void poll(), pollIntervalMs);
  logger.info({ pollIntervalMs, batchSize }, "Report export worker started");
}

export async function processReportExportJobs(limit = 2) {
  const expired = await expireReportExports(Math.max(10, limit * 5));
  const jobs = await claimReportExportJobs(limit);
  const result = { claimed: jobs.length, completed: 0, failed: 0, expired };

  for (const job of jobs) {
    try {
      await generateReportExport(job);
      result.completed += 1;
    } catch (error) {
      await failReportExport(job, error);
      result.failed += 1;
    }
  }

  return result;
}

async function claimReportExportJobs(limit: number) {
  const take = Math.min(10, Math.max(1, Math.trunc(limit)));
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('statement_timeout', '3000ms', true)`;
    return tx.$queryRaw<ClaimedExportJob[]>`
      UPDATE report_export_jobs
      SET
        status = ${ReportExportStatus.PROCESSING}::"ReportExportStatus",
        locked_at = NOW(),
        attempts = attempts + 1,
        error_message = NULL,
        updated_at = NOW()
      WHERE id IN (
        SELECT id
        FROM report_export_jobs
        WHERE
          attempts < max_attempts
          AND available_at <= NOW()
          AND (
            status IN (
              ${ReportExportStatus.PENDING}::"ReportExportStatus",
              ${ReportExportStatus.FAILED}::"ReportExportStatus"
            )
            OR (
              status = ${ReportExportStatus.PROCESSING}::"ReportExportStatus"
              AND locked_at < NOW() - ('30 minutes')::interval
            )
          )
        ORDER BY available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${take}
      )
      RETURNING
        id::text AS "id",
        export_type::text AS "exportType",
        actor_user_id::text AS "actorUserId",
        seller_id::text AS "sellerId",
        filters,
        attempts,
        max_attempts AS "maxAttempts"
    `;
  });
}

async function generateReportExport(job: ClaimedExportJob) {
  const exportType = job.exportType;
  const fileName = reportExportFileName(exportType);
  const contentType = "text/csv; charset=utf-8";
  const directory = join(tmpdir(), "1handindia-report-exports");
  const tempPath = join(directory, `${job.id}.csv`);
  await mkdir(directory, { recursive: true });

  try {
    const { byteSize, rowCount, sha256 } = await writeCsvFile(
      tempPath,
      exportType,
      reportExportFilters(job.filters),
      job.sellerId,
    );
    const storage = await loadPrivateStorageConfig();
    const storageKey = await saveReportExportFile({
      storage,
      jobId: job.id,
      actorUserId: job.actorUserId,
      fileName,
      contentType,
      sourcePath: tempPath,
      sizeBytes: byteSize,
    });

    await prisma.reportExportJob.update({
      where: { id: job.id },
      data: {
        status: ReportExportStatus.COMPLETED,
        fileName,
        contentType,
        storageKey,
        sha256,
        rowCount,
        byteSize,
        lockedAt: null,
        errorMessage: null,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + retentionMs),
      },
    });
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function writeCsvFile(
  filePath: string,
  exportType: ReportExportType,
  filters: ReportExportFilters,
  sellerId: string | null,
) {
  const stream = createWriteStream(filePath, { encoding: "utf8" });
  const hash = createHash("sha256");
  let byteSize = 0;
  let rowCount = 0;

  const write = async (value: string) => {
    const bytes = Buffer.byteLength(value, "utf8");
    byteSize += bytes;
    if (byteSize > maxExportBytes) {
      throw new Error("The report exceeds the 250 MB export limit. Narrow the filters and retry.");
    }
    hash.update(value, "utf8");
    if (!stream.write(value)) {
      await once(stream, "drain");
    }
  };

  try {
    await write(`\uFEFF${reportExportCsvHeader(exportType)}`);
    for await (const row of reportExportRows(prisma, exportType, filters, sellerId)) {
      await write(reportExportCsvRow(exportType, row));
      rowCount += 1;
    }
    stream.end();
    await once(stream, "finish");
    return { byteSize, rowCount, sha256: hash.digest("hex") };
  } catch (error) {
    stream.destroy();
    throw error;
  }
}

async function failReportExport(job: ClaimedExportJob, error: unknown) {
  const finalAttempt = job.attempts >= job.maxAttempts;
  await prisma.reportExportJob.update({
    where: { id: job.id },
    data: {
      status: ReportExportStatus.FAILED,
      lockedAt: null,
      availableAt: finalAttempt
        ? new Date()
        : new Date(Date.now() + reportExportRetryDelayMs(job.attempts)),
      errorMessage: error instanceof Error ? error.message : String(error),
    },
  });
}

async function expireReportExports(limit: number) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const storage = await loadPrivateStorageConfig();
  const jobs = await prisma.$queryRaw<ExpiredExport[]>`
    SELECT
      rej.id::text AS "id",
      rej.storage_key AS "storageKey",
      COALESCE(pu.provider, ${storage.activeProvider}) AS "provider"
    FROM report_export_jobs rej
    LEFT JOIN private_uploads pu ON pu.asset_key = rej.storage_key
    WHERE
      rej.status = ${ReportExportStatus.COMPLETED}::"ReportExportStatus"
      AND rej.expires_at <= NOW()
      AND rej.storage_key IS NOT NULL
    ORDER BY rej.expires_at ASC
    LIMIT ${take}
  `;
  let expired = 0;

  for (const job of jobs) {
    try {
      await deletePrivateStoredFile(storage, job.provider, job.storageKey);
      await markPrivateUploadDeleted(job.storageKey);
      await prisma.reportExportJob.update({
        where: { id: job.id },
        data: {
          status: ReportExportStatus.EXPIRED,
          storageKey: null,
          lockedAt: null,
        },
      });
      expired += 1;
    } catch {
      // Keep the completed row so the worker can retry file cleanup on the next poll.
    }
  }

  return expired;
}

export function reportExportRetryDelayMs(attempt: number) {
  return Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

export function reportExportFilters(value: unknown): ReportExportFilters {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  return Object.fromEntries(
    ["dateFrom", "dateTo", "search", "status", "provider", "paymentStatus"]
      .filter((key) => typeof input[key] === "string" && input[key])
      .map((key) => [key, input[key] as string]),
  ) as ReportExportFilters;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
