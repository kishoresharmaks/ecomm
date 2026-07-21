import { createDecipheriv, createHash, createHmac, randomUUID } from "node:crypto";
import type pino from "pino";
import {
  B2BErpConnectionStatus,
  B2BIntegrationOutboxStatus,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;
type AuthConfig = {
  headers?: Record<string, string>;
  bearerToken?: string;
  username?: string;
  password?: string;
};

export function startB2BErpOutboxPolling(logger: Logger) {
  if (
    process.env.B2B_ORDER_TO_CASH_V2_ENABLED !== "true" ||
    process.env.B2B_ERP_OUTBOX_WORKER_ENABLED === "false"
  ) {
    logger.info("B2B ERP outbox worker is disabled.");
    return;
  }

  const pollIntervalMs = positiveInteger(
    process.env.B2B_ERP_OUTBOX_POLL_INTERVAL_MS,
    30_000,
  );
  const batchSize = positiveInteger(process.env.B2B_ERP_OUTBOX_BATCH_SIZE, 50);
  let running = false;

  const poll = async () => {
    if (running) return;
    running = true;
    try {
      const result = await deliverB2BErpOutbox(batchSize);
      if (result.checked > 0) logger.info(result, "B2B ERP outbox delivery completed");
    } catch (error) {
      logger.error({ error }, "B2B ERP outbox poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => void poll(), pollIntervalMs);
  logger.info({ pollIntervalMs, batchSize }, "B2B ERP outbox worker started");
}

export async function deliverB2BErpOutbox(limit = 50) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const now = new Date();
  const staleClaim = new Date(now.getTime() - 10 * 60_000);
  const candidates = await prisma.b2BIntegrationOutbox.findMany({
    where: {
      OR: [
        {
          status: {
            in: [B2BIntegrationOutboxStatus.PENDING, B2BIntegrationOutboxStatus.FAILED],
          },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        {
          status: B2BIntegrationOutboxStatus.PROCESSING,
          claimedAt: { lt: staleClaim },
        },
      ],
    },
    include: { connection: true },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take,
  });

  const workerId = `worker-${randomUUID()}`;
  let delivered = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const event of candidates) {
    const claimed = await prisma.b2BIntegrationOutbox.updateMany({
      where: {
        id: event.id,
        OR: [
          {
            status: {
              in: [B2BIntegrationOutboxStatus.PENDING, B2BIntegrationOutboxStatus.FAILED],
            },
            OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
          },
          {
            status: B2BIntegrationOutboxStatus.PROCESSING,
            claimedAt: { lt: staleClaim },
          },
        ],
      },
      data: {
        status: B2BIntegrationOutboxStatus.PROCESSING,
        claimedAt: now,
        claimedBy: workerId,
        attemptCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) continue;

    try {
      if (!event.connection || event.connection.status !== B2BErpConnectionStatus.ACTIVE) {
        throw new Error("ERP connection is missing or inactive.");
      }
      const body = JSON.stringify({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: event.createdAt.toISOString(),
        payload: event.payload,
      });
      const timestamp = new Date().toISOString();
      const signingSecret = decryptCredential(event.connection.encryptedSigningSecret);
      const authConfig = parseAuthConfig(
        decryptCredential(event.connection.encryptedAuthConfig),
      );
      const response = await fetch(event.connection.baseUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "1HandIndia-B2B-ERP/1.0",
          "x-1handindia-event-id": event.eventId,
          "x-1handindia-event-type": event.eventType,
          "x-1handindia-timestamp": timestamp,
          "x-1handindia-signature": `sha256=${createHmac("sha256", signingSecret)
            .update(`${timestamp}.${body}`)
            .digest("hex")}`,
          ...authHeaders(authConfig),
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      const responseBody = (await response.text()).slice(0, 2_000);
      if (!response.ok) {
        throw new DeliveryError(
          `ERP webhook returned HTTP ${response.status}.`,
          response.status,
          responseBody,
        );
      }
      await prisma.b2BIntegrationOutbox.update({
        where: { id: event.id },
        data: {
          status: B2BIntegrationOutboxStatus.DELIVERED,
          deliveredAt: new Date(),
          responseCode: response.status,
          responseBody,
          lastError: null,
          claimedAt: null,
          claimedBy: null,
          nextAttemptAt: null,
        },
      });
      await prisma.b2BErpConnection.update({
        where: { id: event.connection.id },
        data: { lastVerifiedAt: new Date(), lastError: null },
      });
      delivered += 1;
    } catch (error) {
      const attempts = event.attemptCount + 1;
      const maxAttempts = positiveInteger(process.env.B2B_ERP_MAX_RETRY_ATTEMPTS, 8);
      const deadLetter = attempts >= maxAttempts;
      const baseDelay = positiveInteger(process.env.B2B_ERP_RETRY_BASE_DELAY_MS, 30_000);
      const nextAttemptAt = deadLetter
        ? null
        : new Date(Date.now() + Math.min(86_400_000, baseDelay * 2 ** Math.max(0, attempts - 1)));
      const responseCode = error instanceof DeliveryError ? error.responseCode : null;
      const responseBody = error instanceof DeliveryError ? error.responseBody : null;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.b2BIntegrationOutbox.update({
        where: { id: event.id },
        data: {
          status: deadLetter
            ? B2BIntegrationOutboxStatus.DEAD_LETTER
            : B2BIntegrationOutboxStatus.FAILED,
          responseCode,
          responseBody,
          lastError: message.slice(0, 2_000),
          claimedAt: null,
          claimedBy: null,
          nextAttemptAt,
        },
      });
      if (event.connection) {
        await prisma.b2BErpConnection.update({
          where: { id: event.connection.id },
          data: { lastError: message.slice(0, 2_000) },
        });
      }
      if (deadLetter) deadLettered += 1;
      else failed += 1;
    }
  }

  return { checked: candidates.length, delivered, failed, deadLettered };
}

function decryptCredential(value: string) {
  const secret = process.env.B2B_ERP_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("B2B_ERP_CREDENTIAL_ENCRYPTION_KEY is not configured.");
  }
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Stored ERP credential is invalid.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function parseAuthConfig(value: string): AuthConfig {
  const parsed = JSON.parse(value) as AuthConfig;
  return parsed && typeof parsed === "object" ? parsed : {};
}

function authHeaders(config: AuthConfig) {
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  if (config.bearerToken) headers.authorization = `Bearer ${config.bearerToken}`;
  if (config.username && config.password) {
    headers.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }
  return headers;
}

class DeliveryError extends Error {
  constructor(
    message: string,
    readonly responseCode: number,
    readonly responseBody: string,
  ) {
    super(message);
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
