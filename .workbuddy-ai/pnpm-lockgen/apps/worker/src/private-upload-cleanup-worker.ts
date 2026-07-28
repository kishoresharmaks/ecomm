import type pino from "pino";
import { prisma } from "@indihub/database";
import {
  deletePrivateStoredFile,
  loadPrivateStorageConfig,
} from "./private-storage";

type Logger = pino.Logger;

type PrivateUploadCleanupCandidate = {
  id: string;
  assetKey: string;
  provider: string;
};

export function startPrivateUploadCleanupPolling(logger: Logger) {
  if (process.env.PRIVATE_UPLOAD_CLEANUP_WORKER_ENABLED === "false") {
    logger.info(
      "Private upload orphan cleanup worker disabled by PRIVATE_UPLOAD_CLEANUP_WORKER_ENABLED=false.",
    );
    return;
  }

  const pollIntervalMs = positiveInteger(
    process.env.PRIVATE_UPLOAD_CLEANUP_INTERVAL_MS,
    60 * 60 * 1000,
  );
  const batchSize = positiveInteger(process.env.PRIVATE_UPLOAD_CLEANUP_BATCH_SIZE, 50);
  const retentionHours = positiveInteger(process.env.PRIVATE_UPLOAD_ORPHAN_RETENTION_HOURS, 24);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await cleanupOrphanPrivateUploads(batchSize, retentionHours);
      if (result.checked > 0) {
        logger.info(result, "Private upload orphan cleanup completed");
      }
    } catch (error) {
      logger.error({ error }, "Private upload orphan cleanup poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info(
    { pollIntervalMs, batchSize, retentionHours },
    "Private upload orphan cleanup worker started",
  );
}

export async function cleanupOrphanPrivateUploads(limit = 50, retentionHours = 24) {
  const candidates = await findCleanupCandidates(limit, retentionHours);
  const storage = await loadPrivateStorageConfig();
  const result = {
    checked: candidates.length,
    deleted: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      await deletePrivateStoredFile(storage, candidate.provider, candidate.assetKey);

      await markDeleted(candidate.id);
      result.deleted += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

async function findCleanupCandidates(limit: number, retentionHours: number) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const hours = Math.min(720, Math.max(1, Math.trunc(retentionHours)));

  return prisma.$queryRaw<PrivateUploadCleanupCandidate[]>`
    SELECT
      pu.id::text AS "id",
      pu.asset_key AS "assetKey",
      pu.provider AS "provider"
    FROM private_uploads pu
    WHERE
      pu.deleted_at IS NULL
      AND pu.created_at < NOW() - make_interval(hours => ${hours})
      AND NOT EXISTS (
        SELECT 1
        FROM seller_documents sd
        WHERE sd.file_url = pu.asset_key
      )
      AND NOT EXISTS (
        SELECT 1
        FROM b2b_orders bo
        WHERE bo.purchase_order_file_key = pu.asset_key
           OR bo.proforma_invoice_file_key = pu.asset_key
      )
      AND NOT EXISTS (
        SELECT 1
        FROM b2b_payment_proofs bpp
        WHERE bpp.proof_file_key = pu.asset_key
      )
      AND NOT EXISTS (
        SELECT 1
        FROM b2b_proforma_invoice_revisions bpir
        WHERE bpir.file_key = pu.asset_key
      )
      AND NOT EXISTS (
        SELECT 1
        FROM report_export_jobs rej
        WHERE rej.storage_key = pu.asset_key
      )
    ORDER BY pu.created_at ASC
    LIMIT ${take}
  `;
}

async function markDeleted(id: string) {
  await prisma.$executeRaw`
    UPDATE private_uploads
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}::uuid
      AND deleted_at IS NULL
  `;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
