import pino from "pino";
import { Worker as BullWorker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { brandConfig } from "@indihub/config";
import { NotificationStatus, prisma } from "@indihub/database";
import { WorkerEmailDelivery } from "./email-delivery";
import { EMAIL_QUEUE_NAME, type EmailJobPayload, type EmailProviderConfig } from "./email-job";
import { startDeliveryAssignmentTimeoutPolling } from "./delivery-assignment-timeout-worker";
import { startPrivateUploadCleanupPolling } from "./private-upload-cleanup-worker";
import { startPushCampaignPolling } from "./push-campaign-worker";
import { startReturnPickupTimeoutPolling } from "./return-pickup-timeout-worker";
import { startSearchIndexPolling } from "./search-index-worker";

const logger = pino({
  name: "indihub-worker",
  level: process.env.LOG_LEVEL ?? "info",
});

const phaseOneQueues = [
  "email.notifications",
  "reports.basic",
  "audit.rollups",
  "future.search-index",
  "future.integration-retries",
] as const;

logger.info(
  {
    brand: brandConfig.name,
    queues: phaseOneQueues,
    redisConfigured: Boolean(process.env.REDIS_URL),
  },
  "1HandIndia worker scaffold ready",
);

startSearchIndexPolling(logger);
startDeliveryAssignmentTimeoutPolling(logger);
startReturnPickupTimeoutPolling(logger);
startPrivateUploadCleanupPolling(logger);
startPushCampaignPolling(logger);

const redisUrl = process.env.REDIS_URL;
const emailDelivery = new WorkerEmailDelivery(logger);
const emailQueueSendWindowMinutes = nonNegativeNumber(
  process.env.EMAIL_QUEUE_SEND_WINDOW_MINUTES,
  60,
);
const emailDeliveryLockStaleMinutes = nonNegativeNumber(
  process.env.EMAIL_DELIVERY_LOCK_STALE_MINUTES,
  10,
);
const earlySendSkewMs = 5000;
const emailDeliveryLockPrefix = "delivery-lock:";

if (redisUrl) {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  const emailWorker = new BullWorker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const payload = job.data;

      try {
        await processEmailJob(payload);
      } catch (error) {
        await prisma.notificationLog.updateMany({
          where: {
            id: payload.notificationLogId,
            status: NotificationStatus.PENDING,
            OR: [
              { providerMessageId: null },
              { providerMessageId: { startsWith: emailDeliveryLockPrefix } },
            ],
          },
          data: {
            status: NotificationStatus.FAILED,
            providerMessageId: null,
            errorMessage: String(error),
          },
        });
        throw error;
      }
    },
    { connection, maxStalledCount: 0 },
  );

  const queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, { connection });

  emailWorker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Email notification job completed");
  });

  emailWorker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Email notification job failed");
  });

  queueEvents.on("waiting", ({ jobId }) => {
    logger.info({ jobId }, "Email notification job waiting");
  });

  logger.info({ queue: EMAIL_QUEUE_NAME }, "Email notification worker started");

  const shutdown = async () => {
    logger.info("Stopping 1HandIndia worker");
    await emailWorker.close();
    await queueEvents.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
} else {
  logger.info("REDIS_URL is not configured. Email queue processors are ready but not started.");
}

if (process.env.WORKER_KEEP_ALIVE === "true") {
  logger.info("Worker keep-alive enabled.");
  setInterval(() => {
    logger.info("1HandIndia worker heartbeat");
  }, 30000);
}

async function processEmailJob(payload: EmailJobPayload) {
  const log = await prisma.notificationLog.findUnique({
    where: { id: payload.notificationLogId },
    select: {
      id: true,
      status: true,
      providerMessageId: true,
      recipient: true,
      subject: true,
      body: true,
      templateCode: true,
      createdAt: true,
      scheduledFor: true,
    },
  });

  if (!log) {
    logger.warn(
      { notificationLogId: payload.notificationLogId },
      "Email log not found; skipping job",
    );
    return;
  }

  if (log.status !== NotificationStatus.PENDING) {
    logger.info(
      { notificationLogId: log.id, status: log.status },
      "Email log is no longer pending; skipping job",
    );
    return;
  }

  if (log.providerMessageId) {
    if (isStaleDeliveryLock(log.providerMessageId)) {
      await markEmailFailed(
        log.id,
        "Email delivery lock expired before the send was marked complete. Review provider logs before retrying from the admin email workspace.",
      );
      return;
    }

    logger.info(
      { notificationLogId: log.id, providerMessageId: log.providerMessageId },
      "Email log already has a provider id or delivery lock; skipping duplicate job",
    );
    return;
  }

  const now = new Date();
  if (log.scheduledFor && log.scheduledFor.getTime() > now.getTime() + earlySendSkewMs) {
    await markEmailSkipped(
      log.id,
      "Queued email ran before its scheduled time. It was skipped to prevent unexpected early delivery.",
    );
    return;
  }

  const dueAt = log.scheduledFor ?? log.createdAt;
  if (isPastSendWindow(dueAt, now)) {
    await markEmailSkipped(
      log.id,
      `Queued email skipped because it is older than the ${emailQueueSendWindowMinutes}-minute send window. This prevents old transactional emails from being sent unexpectedly.`,
    );
    return;
  }

  const setting = await prisma.emailSetting.findFirst({ orderBy: { createdAt: "asc" } });
  if (!setting?.isEnabled) {
    await markEmailSkipped(log.id, "Email sending is disabled in email settings.");
    return;
  }

  if (!log.recipient || !log.subject || !log.body) {
    await markEmailSkipped(log.id, "Queued email log is missing recipient, subject, or body.");
    return;
  }

  const sendPayload: EmailJobPayload = {
    notificationLogId: log.id,
    provider: setting.provider,
    providerConfig: emailProviderConfig(setting.providerConfig),
    recipient: log.recipient,
    subject: log.subject,
    body: log.body,
    fromName: setting.senderName,
    fromEmail: setting.senderEmail,
    templateCode: log.templateCode,
  };

  const deliveryLockId = deliveryLock(log.id);
  const claimed = await claimEmailLog(log.id, deliveryLockId);
  if (!claimed) {
    logger.info({ notificationLogId: log.id }, "Email log was already claimed; skipping job");
    return;
  }

  const result = await emailDelivery.deliver(sendPayload);
  const providerMessageId = result.providerMessageId ?? `sent-without-provider-id:${log.id}`;
  const updated = await prisma.notificationLog.updateMany({
    where: {
      id: log.id,
      status: NotificationStatus.PENDING,
      providerMessageId: deliveryLockId,
    },
    data: {
      status: NotificationStatus.SENT,
      providerMessageId,
      errorMessage: null,
      sentAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    logger.warn(
      { notificationLogId: log.id },
      "Email was delivered, but the log status changed before it could be marked sent",
    );
  }
}

async function claimEmailLog(notificationLogId: string, deliveryLockId: string) {
  const updated = await prisma.notificationLog.updateMany({
    where: {
      id: notificationLogId,
      status: NotificationStatus.PENDING,
      providerMessageId: null,
      sentAt: null,
    },
    data: {
      providerMessageId: deliveryLockId,
      errorMessage: "Email delivery in progress. Duplicate sends are blocked by a delivery lock.",
    },
  });

  return updated.count === 1;
}

async function markEmailSkipped(notificationLogId: string, errorMessage: string) {
  await prisma.notificationLog.updateMany({
    where: {
      id: notificationLogId,
      status: NotificationStatus.PENDING,
      OR: [
        { providerMessageId: null },
        { providerMessageId: { startsWith: emailDeliveryLockPrefix } },
      ],
    },
    data: {
      status: NotificationStatus.SKIPPED,
      providerMessageId: null,
      errorMessage,
    },
  });
  logger.warn({ notificationLogId, errorMessage }, "Email job skipped");
}

async function markEmailFailed(notificationLogId: string, errorMessage: string) {
  await prisma.notificationLog.updateMany({
    where: {
      id: notificationLogId,
      status: NotificationStatus.PENDING,
      providerMessageId: { startsWith: emailDeliveryLockPrefix },
    },
    data: {
      status: NotificationStatus.FAILED,
      providerMessageId: null,
      errorMessage,
    },
  });
  logger.warn({ notificationLogId, errorMessage }, "Email job failed by safety guard");
}

function isPastSendWindow(dueAt: Date, now: Date) {
  if (emailQueueSendWindowMinutes <= 0) {
    return false;
  }

  return now.getTime() - dueAt.getTime() > emailQueueSendWindowMinutes * 60 * 1000;
}

function nonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function deliveryLock(notificationLogId: string) {
  return `${emailDeliveryLockPrefix}${notificationLogId}:${Date.now()}`;
}

function isStaleDeliveryLock(providerMessageId: string) {
  if (!providerMessageId.startsWith(emailDeliveryLockPrefix)) {
    return false;
  }

  if (emailDeliveryLockStaleMinutes <= 0) {
    return true;
  }

  const lockParts = providerMessageId.split(":");
  const lockedAt = Number(lockParts[lockParts.length - 1]);
  return (
    Number.isFinite(lockedAt) && Date.now() - lockedAt > emailDeliveryLockStaleMinutes * 60 * 1000
  );
}

function emailProviderConfig(value: unknown): EmailProviderConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const input = value as Record<string, unknown>;
  const config: EmailProviderConfig = {};

  if (typeof input.brevoApiKey === "string" && input.brevoApiKey.trim()) {
    config.brevoApiKey = input.brevoApiKey.trim();
  }

  if (typeof input.resendApiKey === "string" && input.resendApiKey.trim()) {
    config.resendApiKey = input.resendApiKey.trim();
  }

  if (typeof input.sendgridApiKey === "string" && input.sendgridApiKey.trim()) {
    config.sendgridApiKey = input.sendgridApiKey.trim();
  }

  if (typeof input.smtpHost === "string" && input.smtpHost.trim()) {
    config.smtpHost = input.smtpHost.trim();
  }

  const smtpPort =
    typeof input.smtpPort === "number"
      ? input.smtpPort
      : typeof input.smtpPort === "string" && input.smtpPort.trim()
        ? Number(input.smtpPort)
        : Number.NaN;
  if (Number.isInteger(smtpPort) && smtpPort > 0 && smtpPort <= 65535) {
    config.smtpPort = smtpPort;
  }

  if (typeof input.smtpUsername === "string" && input.smtpUsername.trim()) {
    config.smtpUsername = input.smtpUsername.trim();
  }

  if (typeof input.smtpPassword === "string" && input.smtpPassword.trim()) {
    config.smtpPassword = input.smtpPassword.trim();
  }

  if (typeof input.smtpSecure === "boolean") {
    config.smtpSecure = input.smtpSecure;
  }

  if (typeof input.smtpBridgeUrl === "string" && input.smtpBridgeUrl.trim()) {
    config.smtpBridgeUrl = input.smtpBridgeUrl.trim();
  }

  return config;
}
