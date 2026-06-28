import { createHash, createHmac } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type pino from "pino";
import { prisma } from "@indihub/database";

type Logger = pino.Logger;

type PrivateUploadCleanupCandidate = {
  id: string;
  assetKey: string;
  provider: string;
};

type PrivateStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  localRoot: string;
};

const privateStorageSettingKeys = [
  "storage.private.endpoint",
  "storage.private.region",
  "storage.private.bucket",
  "storage.private.access_key_id",
  "storage.private.secret_access_key",
  "storage.private.local_root",
] as const;

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
  const storage = await privateStorageConfig();
  const result = {
    checked: candidates.length,
    deleted: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      if (candidate.provider.toUpperCase() === "LOCAL") {
        await deleteLocalPrivateUpload(storage.localRoot, candidate.assetKey);
      } else if (candidate.provider.toUpperCase() === "S3") {
        await deleteS3PrivateUpload(storage, candidate.assetKey);
      } else {
        throw new Error(`Unsupported private upload provider: ${candidate.provider}`);
      }

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

async function privateStorageConfig(): Promise<PrivateStorageConfig> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: [...privateStorageSettingKeys] } },
    select: { key: true, value: true },
  });
  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

  return {
    endpoint: stringSetting(settingMap, "storage.private.endpoint", process.env.S3_ENDPOINT ?? ""),
    region: stringSetting(settingMap, "storage.private.region", process.env.S3_REGION ?? ""),
    bucket: stringSetting(settingMap, "storage.private.bucket", process.env.S3_BUCKET ?? ""),
    accessKeyId: stringSetting(
      settingMap,
      "storage.private.access_key_id",
      process.env.S3_ACCESS_KEY_ID ?? "",
    ),
    secretAccessKey: stringSetting(
      settingMap,
      "storage.private.secret_access_key",
      process.env.S3_SECRET_ACCESS_KEY ?? "",
    ),
    localRoot: normalizePrivateLocalRoot(
      stringSetting(
        settingMap,
        "storage.private.local_root",
        process.env.INDIHUB_PRIVATE_UPLOAD_ROOT ?? "storage/private",
      ),
    ),
  };
}

async function deleteLocalPrivateUpload(localRoot: string, assetKey: string) {
  const rootPath = resolve(localRoot);
  const filePath = resolve(rootPath, assetKey);

  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
    throw new Error("Private upload path resolved outside the configured root.");
  }

  await rm(filePath, { force: true });
}

async function deleteS3PrivateUpload(storage: PrivateStorageConfig, assetKey: string) {
  if (
    !storage.endpoint ||
    !storage.region ||
    !storage.bucket ||
    !storage.accessKeyId ||
    !storage.secretAccessKey
  ) {
    throw new Error("Private S3 storage is not configured for orphan cleanup.");
  }

  const url = presignS3Object(storage, "DELETE", assetKey, 300);
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Private S3 orphan delete failed with status ${response.status}.`);
  }
}

function presignS3Object(
  storage: PrivateStorageConfig,
  method: "DELETE",
  assetKey: string,
  expiresSeconds: number,
) {
  const endpoint = new URL(storage.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${storage.region}/s3/aws4_request`;
  const credential = `${storage.accessKeyId}/${credentialScope}`;
  const signedHeaders = "host";
  const canonicalUri = s3CanonicalUri(endpoint.pathname, storage.bucket, assetKey);
  const queryParams: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", signedHeaders],
  ];
  const canonicalQuery = canonicalQueryString(queryParams);
  const canonicalHeaders = `host:${endpoint.host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac(
    "sha256",
    awsSigningKey(storage.secretAccessKey, dateStamp, storage.region),
  )
    .update(stringToSign)
    .digest("hex");

  return `${endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function s3CanonicalUri(endpointPath: string, bucket: string, assetKey: string) {
  const basePath = endpointPath.replace(/\/+$/, "");
  const segments = [...basePath.split("/").filter(Boolean), bucket, ...assetKey.split("/")];
  return `/${segments.map((segment) => encodeRfc3986(segment)).join("/")}`;
}

function canonicalQueryString(params: Array<[string, string]>) {
  return [...params]
    .sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
    )
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

function awsSigningKey(secret: string, dateStamp: string, region: string) {
  const dateKey = createHmac("sha256", `AWS4${secret}`).update(dateStamp).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function stringSetting(settingMap: ReadonlyMap<string, unknown>, key: string, fallback: string) {
  const value = settingMap.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePrivateLocalRoot(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "").replace(/\\+$/, "");
  return trimmed || "storage/private";
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
