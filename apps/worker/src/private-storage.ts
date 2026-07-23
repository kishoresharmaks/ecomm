import { createHash, createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { prisma } from "@indihub/database";

export type PrivateStorageConfig = {
  activeProvider: "LOCAL" | "S3";
  configured: boolean;
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  localRoot: string;
};

const settingKeys = [
  "storage.private.provider",
  "storage.private.enabled",
  "storage.private.endpoint",
  "storage.private.region",
  "storage.private.bucket",
  "storage.private.access_key_id",
  "storage.private.secret_access_key",
  "storage.private.local_root",
] as const;

export async function loadPrivateStorageConfig(): Promise<PrivateStorageConfig> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: [...settingKeys] } },
    select: { key: true, value: true },
  });
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const endpoint = stringSetting(values, "storage.private.endpoint", process.env.S3_ENDPOINT ?? "");
  const region = stringSetting(values, "storage.private.region", process.env.S3_REGION ?? "");
  const bucket = stringSetting(values, "storage.private.bucket", process.env.S3_BUCKET ?? "");
  const accessKeyId = stringSetting(
    values,
    "storage.private.access_key_id",
    process.env.S3_ACCESS_KEY_ID ?? "",
  );
  const secretAccessKey = stringSetting(
    values,
    "storage.private.secret_access_key",
    process.env.S3_SECRET_ACCESS_KEY ?? "",
  );
  const localRoot = normalizeLocalRoot(
    stringSetting(
      values,
      "storage.private.local_root",
      process.env.INDIHUB_PRIVATE_UPLOAD_ROOT ?? "storage/private",
    ),
  );
  const provider = stringSetting(
    values,
    "storage.private.provider",
    process.env.INDIHUB_PRIVATE_STORAGE_PROVIDER ??
      process.env.PRIVATE_STORAGE_PROVIDER ??
      "AUTO",
  ).toUpperCase();
  const s3Configured = Boolean(endpoint && region && bucket && accessKeyId && secretAccessKey);
  const activeProvider = provider === "S3" || (provider === "AUTO" && s3Configured) ? "S3" : "LOCAL";
  const enabled = booleanSetting(
    values.get("storage.private.enabled"),
    activeProvider === "S3" ? s3Configured : Boolean(localRoot),
  );

  return {
    activeProvider,
    configured: enabled && (activeProvider === "S3" ? s3Configured : Boolean(localRoot)),
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    localRoot,
  };
}

export async function saveReportExportFile(input: {
  storage: PrivateStorageConfig;
  jobId: string;
  actorUserId: string;
  fileName: string;
  contentType: string;
  sourcePath: string;
  sizeBytes: number;
}) {
  if (!input.storage.configured) {
    throw new Error("Private storage must be configured before report exports can be generated.");
  }

  const assetKey = `1handindia/report-exports/${safeSegment(input.jobId)}/${safeFileName(input.fileName)}`;
  if (input.storage.activeProvider === "S3") {
    await uploadS3File(input.storage, assetKey, input.sourcePath, input.contentType, input.sizeBytes);
  } else {
    const targetPath = privateLocalPath(input.storage.localRoot, assetKey);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(input.sourcePath, targetPath);
  }

  await prisma.$executeRaw`
    INSERT INTO private_uploads (
      id,
      asset_key,
      provider,
      upload_kind,
      actor_user_id,
      content_type,
      size_bytes,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${assetKey},
      ${input.storage.activeProvider},
      'REPORT_EXPORT',
      ${input.actorUserId}::uuid,
      ${input.contentType},
      ${input.sizeBytes},
      NOW(),
      NOW()
    )
    ON CONFLICT (asset_key) DO UPDATE SET
      provider = EXCLUDED.provider,
      upload_kind = EXCLUDED.upload_kind,
      actor_user_id = EXCLUDED.actor_user_id,
      content_type = EXCLUDED.content_type,
      size_bytes = EXCLUDED.size_bytes,
      deleted_at = NULL,
      updated_at = NOW()
  `;

  return assetKey;
}

export async function deletePrivateStoredFile(
  storage: PrivateStorageConfig,
  provider: string,
  assetKey: string,
) {
  if (provider.toUpperCase() === "S3") {
    await deleteS3File(storage, assetKey);
  } else if (provider.toUpperCase() === "LOCAL") {
    await rm(privateLocalPath(storage.localRoot, assetKey), { force: true });
  } else {
    throw new Error(`Unsupported private storage provider: ${provider}`);
  }
}

export async function markPrivateUploadDeleted(assetKey: string) {
  await prisma.$executeRaw`
    UPDATE private_uploads
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE asset_key = ${assetKey}
      AND deleted_at IS NULL
  `;
}

async function uploadS3File(
  storage: PrivateStorageConfig,
  assetKey: string,
  sourcePath: string,
  contentType: string,
  sizeBytes: number,
) {
  assertS3Configured(storage);
  const url = presignS3Object(storage, "PUT", assetKey, 900);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "content-length": String(sizeBytes),
    },
    body: createReadStream(sourcePath) as unknown as BodyInit,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!response.ok) {
    throw new Error(`Private S3 report upload failed with status ${response.status}.`);
  }
}

async function deleteS3File(storage: PrivateStorageConfig, assetKey: string) {
  assertS3Configured(storage);
  const response = await fetch(presignS3Object(storage, "DELETE", assetKey, 300), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Private S3 delete failed with status ${response.status}.`);
  }
}

function assertS3Configured(storage: PrivateStorageConfig) {
  if (
    !storage.endpoint ||
    !storage.region ||
    !storage.bucket ||
    !storage.accessKeyId ||
    !storage.secretAccessKey
  ) {
    throw new Error("Private S3 storage is not configured.");
  }
}

function privateLocalPath(localRoot: string, assetKey: string) {
  const rootPath = resolve(localRoot);
  const filePath = resolve(rootPath, assetKey);
  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
    throw new Error("Private storage path resolved outside the configured root.");
  }
  return filePath;
}

function presignS3Object(
  storage: PrivateStorageConfig,
  method: "DELETE" | "PUT",
  assetKey: string,
  expiresSeconds: number,
) {
  const endpoint = new URL(storage.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${storage.region}/s3/aws4_request`;
  const credential = `${storage.accessKeyId}/${credentialScope}`;
  const canonicalUri = s3CanonicalUri(endpoint.pathname, storage.bucket, assetKey);
  const queryParams: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", credential],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = canonicalQueryString(queryParams);
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    `host:${endpoint.host}\n`,
    "host",
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
  const segments = [
    ...endpointPath.replace(/\/+$/, "").split("/").filter(Boolean),
    bucket,
    ...assetKey.split("/"),
  ];
  return `/${segments.map(encodeRfc3986).join("/")}`;
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

function stringSetting(values: ReadonlyMap<string, unknown>, key: string, fallback: string) {
  const value = values.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function booleanSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function normalizeLocalRoot(value: string) {
  return value.trim().replace(/[/\\]+$/, "") || "storage/private";
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function safeFileName(value: string) {
  return value.replaceAll("\\", "/").split("/").at(-1)?.replace(/[^a-zA-Z0-9._-]/g, "_") || "report.csv";
}
