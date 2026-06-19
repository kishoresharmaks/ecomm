import type pino from "pino";
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
  PushNotificationBatchStatus,
  PushNotificationCampaignStatus,
  PushNotificationReceiptStatus,
  PushNotificationType,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;
type PushTicket = { id?: string; status?: string; message?: string; details?: { error?: string } };
type ExpoSendResponse = { data?: PushTicket | PushTicket[] };
type ExpoReceiptResponse = {
  data?: Record<string, { status?: string; message?: string; details?: { error?: string } }>;
};

const expoSendEndpoint = "https://exp.host/--/api/v2/push/send";
const expoReceiptEndpoint = "https://exp.host/--/api/v2/push/getReceipts";
const receiptDelayMinutes = positiveInteger(process.env.PUSH_RECEIPT_DELAY_MINUTES, 20);
const throttleMs = positiveInteger(process.env.PUSH_CAMPAIGN_THROTTLE_MS, 250);

export function startPushCampaignPolling(logger: Logger) {
  if (process.env.PUSH_CAMPAIGN_WORKER_ENABLED === "false") {
    logger.info("Push campaign worker disabled by PUSH_CAMPAIGN_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.PUSH_CAMPAIGN_POLL_INTERVAL_MS, 30000);
  const batchLimit = positiveInteger(process.env.PUSH_CAMPAIGN_BATCH_LIMIT, 5);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await runPushCampaignWorkerTick(`worker-${process.pid}`, batchLimit);
      if (result.claimed || result.receiptsChecked || result.swept) {
        logger.info(result, "Push campaign worker tick completed");
      }
    } catch (error) {
      logger.error({ error }, "Push campaign worker tick failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);
  logger.info({ pollIntervalMs, batchLimit }, "Push campaign worker started");
}

export async function runPushCampaignWorkerTick(workerId: string, limit = 5) {
  await activateDueCampaigns();
  const swept = await sweepStalePushCampaignBatches();
  let claimed = 0;
  for (let index = 0; index < limit; index += 1) {
    const batch = await claimNextPushCampaignBatch(workerId);
    if (!batch) {
      break;
    }
    await sendPushCampaignBatch(batch.id);
    claimed += 1;
    if (throttleMs > 0) {
      await sleep(throttleMs);
    }
  }
  const receiptsChecked = await checkPendingPushReceipts();
  await finalizeCompletedCampaigns();
  return { claimed, swept, receiptsChecked };
}

export async function activateDueCampaigns(now = new Date()) {
  const result = await prisma.pushNotificationCampaign.updateMany({
    where: {
      status: PushNotificationCampaignStatus.SCHEDULED,
      scheduledAt: { lte: now },
    },
    data: { status: PushNotificationCampaignStatus.SENDING },
  });
  return result.count;
}

export async function claimNextPushCampaignBatch(workerId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE push_notification_campaign_batches AS batch
    SET status = 'CLAIMED'::"PushNotificationBatchStatus",
        claimed_by = ${workerId},
        claimed_at = now(),
        attempt_count = attempt_count + 1,
        updated_at = now()
    WHERE batch.id = (
      SELECT b.id
      FROM push_notification_campaign_batches b
      JOIN push_notification_campaigns c ON c.id = b.campaign_id
      WHERE b.status = 'PENDING'::"PushNotificationBatchStatus"
        AND c.status = 'SENDING'::"PushNotificationCampaignStatus"
      ORDER BY b.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING batch.id
  `;
  return rows[0] ?? null;
}

export async function sweepStalePushCampaignBatches(now = new Date()) {
  const timeoutMinutes = positiveInteger(process.env.PUSH_CAMPAIGN_CLAIM_TIMEOUT_MINUTES, 15);
  const staleBefore = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
  const result = await prisma.pushNotificationCampaignBatch.updateMany({
    where: {
      status: PushNotificationBatchStatus.CLAIMED,
      claimedAt: { lt: staleBefore },
    },
    data: {
      status: PushNotificationBatchStatus.PENDING,
      claimedBy: null,
      claimedAt: null,
    },
  });
  return result.count;
}

export async function sendPushCampaignBatch(batchId: string) {
  const batch = await prisma.pushNotificationCampaignBatch.findUnique({
    where: { id: batchId },
    include: { campaign: true },
  });
  if (!batch || batch.status !== PushNotificationBatchStatus.CLAIMED) {
    return { sent: 0, failed: 0, revoked: 0 };
  }

  const tokens = await prisma.customerPushToken.findMany({
    where: {
      id: { in: batch.recipientTokenIds },
      enabled: true,
      revokedAt: null,
      customer: { status: "ACTIVE", marketingCampaignsEnabled: true },
    },
    include: { customer: true },
  });
  const notificationIdsByCustomer = new Map<string, string>();
  let sent = 0;
  let failed = 0;
  let revoked = 0;
  const ticketIds: string[] = [];
  const ticketErrors: Array<{ tokenId: string; message: string; errorCode?: string }> = [];

  for (const token of tokens) {
    const notification = await upsertCampaignNotification(batch.campaign, token.customerId);
    notificationIdsByCustomer.set(token.customerId, notification.id);
    const log = await prisma.notificationLog.create({
      data: {
        userId: token.userId,
        customerNotificationId: notification.id,
        customerPushTokenId: token.id,
        pushCampaignBatchId: batch.id,
        channel: NotificationChannel.PUSH,
        templateCode: "CUSTOMER_MARKETING_CAMPAIGN_PUSH",
        eventCode: "customer.push_campaign",
        recipient: token.token,
        subject: batch.campaign.title,
        body: batch.campaign.body,
        variables: campaignPayload(batch.campaign),
        status: NotificationStatus.PENDING,
      },
    });

    const ticket = await sendExpoPush(token.token, batch.campaign);
    const errorCode = ticket.details?.error;
    const ok = ticket.status !== "error" && Boolean(ticket.id);
    if (ok) {
      sent += 1;
      const ticketId = ticket.id as string;
      ticketIds.push(ticketId);
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.SENT, providerMessageId: ticketId, sentAt: new Date() },
      });
      await prisma.pushNotificationReceipt.create({
        data: {
          notificationLogId: log.id,
          customerPushTokenId: token.id,
          campaignBatchId: batch.id,
          ticketId,
          status: PushNotificationReceiptStatus.PENDING,
          checkAfter: new Date(Date.now() + receiptDelayMinutes * 60 * 1000),
        },
      });
    } else {
      failed += 1;
      ticketErrors.push({
        tokenId: token.id,
        message: ticket.message ?? "Expo push ticket failed.",
        ...(errorCode ? { errorCode } : {}),
      });
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: NotificationStatus.FAILED,
          providerMessageId: ticket.id ?? null,
          errorMessage: ticket.message ?? errorCode ?? "Expo push ticket failed.",
        },
      });
      if (errorCode === "DeviceNotRegistered") {
        revoked += 1;
        await revokeCustomerPushToken(token.id);
      }
    }
  }

  await prisma.pushNotificationCampaignBatch.update({
    where: { id: batch.id },
    data: {
      status: PushNotificationBatchStatus.DONE,
      ticketIds,
      ticketErrors: ticketErrors.length ? ticketErrors : Prisma.JsonNull,
      doneAt: new Date(),
    },
  });
  await prisma.pushNotificationCampaign.update({
    where: { id: batch.campaignId },
    data: {
      sentCount: { increment: sent },
      failedCount: { increment: failed },
      revokedCount: { increment: revoked },
    },
  });
  return { sent, failed, revoked, notifications: notificationIdsByCustomer.size };
}

export async function checkPendingPushReceipts(now = new Date()) {
  const receipts = await prisma.pushNotificationReceipt.findMany({
    where: {
      status: PushNotificationReceiptStatus.PENDING,
      checkAfter: { lte: now },
      ticketId: { not: null },
    },
    include: { notificationLog: true },
    take: 300,
    orderBy: { checkAfter: "asc" },
  });
  if (!receipts.length) {
    return 0;
  }

  const receiptMap = await fetchExpoReceipts(receipts.map((receipt) => receipt.ticketId as string));
  let checked = 0;
  for (const receipt of receipts) {
    const providerReceipt = receiptMap[receipt.ticketId as string];
    if (!providerReceipt) {
      continue;
    }
    const errorCode = providerReceipt.details?.error;
    const failed = providerReceipt.status === "error";
    await prisma.pushNotificationReceipt.update({
      where: { id: receipt.id },
      data: {
        status: failed ? PushNotificationReceiptStatus.FAILED : PushNotificationReceiptStatus.CHECKED,
        providerStatus: providerReceipt.status ?? null,
        providerDetails: providerReceipt.details ?? Prisma.JsonNull,
        errorCode: errorCode ?? null,
        errorMessage: providerReceipt.message ?? null,
        receiptId: receipt.ticketId,
        checkedAt: new Date(),
      },
    });
    if (failed) {
      await prisma.notificationLog.update({
        where: { id: receipt.notificationLogId },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: providerReceipt.message ?? errorCode ?? "Expo receipt failed.",
        },
      });
      if (errorCode === "DeviceNotRegistered" && receipt.customerPushTokenId) {
        await revokeCustomerPushToken(receipt.customerPushTokenId);
        if (receipt.notificationLog.pushCampaignBatchId) {
          await prisma.pushNotificationCampaign.update({
            where: { id: await campaignIdForBatch(receipt.notificationLog.pushCampaignBatchId) },
            data: { revokedCount: { increment: 1 }, failedCount: { increment: 1 } },
          }).catch(() => null);
        }
      }
    }
    checked += 1;
  }
  return checked;
}

export async function finalizeCompletedCampaigns() {
  const campaigns = await prisma.pushNotificationCampaign.findMany({
    where: { status: PushNotificationCampaignStatus.SENDING },
    include: { batches: { select: { status: true } } },
    take: 50,
  });
  let finalized = 0;
  for (const campaign of campaigns) {
    if (campaign.batches.length && campaign.batches.every((batch) => batch.status === PushNotificationBatchStatus.DONE)) {
      await prisma.pushNotificationCampaign.update({
        where: { id: campaign.id },
        data: { status: PushNotificationCampaignStatus.SENT, sentAt: new Date() },
      });
      finalized += 1;
    }
  }
  return finalized;
}

async function upsertCampaignNotification(
  campaign: {
    id: string;
    title: string;
    body: string;
    imageUrl: string | null;
    href: string | null;
    segmentFilter: Prisma.JsonValue;
  },
  customerId: string,
) {
  return prisma.customerNotification.upsert({
    where: {
      customerId_type_sourceType_sourceId: {
        customerId,
        type: PushNotificationType.CAMPAIGN,
        sourceType: "push_campaign",
        sourceId: campaign.id,
      },
    },
    update: {},
    create: {
      customerId,
      type: PushNotificationType.CAMPAIGN,
      title: campaign.title,
      body: campaign.body,
      imageUrl: campaign.imageUrl,
      href: campaign.href,
      sourceType: "push_campaign",
      sourceId: campaign.id,
      metadata: { segmentFilter: campaign.segmentFilter },
    },
  });
}

async function sendExpoPush(token: string, campaign: { title: string; body: string; href: string | null; imageUrl: string | null }) {
  const payload = campaignPayload(campaign);
  const response = await fetch(expoSendEndpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      to: token,
      title: campaign.title,
      body: campaign.body,
      data: payload,
      sound: "default",
      channelId: "customer-alerts",
      ...(campaign.imageUrl ? { richContent: { image: campaign.imageUrl } } : {}),
    }),
  });
  if (response.status === 429) {
    return { status: "error", message: "Expo push rate limit exceeded.", details: { error: "MessageRateExceeded" } };
  }
  const result = (await response.json().catch(() => null)) as ExpoSendResponse | null;
  const ticket = Array.isArray(result?.data) ? result?.data[0] : result?.data;
  if (!response.ok) {
    return ticket ?? { status: "error", message: `Expo Push API returned HTTP ${response.status}` };
  }
  return ticket ?? { status: "error", message: "Expo Push API returned no ticket." };
}

async function fetchExpoReceipts(ticketIds: string[]) {
  const response = await fetch(expoReceiptEndpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ ids: ticketIds }),
  });
  if (!response.ok) {
    throw new Error(`Expo receipt API returned HTTP ${response.status}`);
  }
  const result = (await response.json()) as ExpoReceiptResponse;
  return result.data ?? {};
}

async function revokeCustomerPushToken(tokenId: string) {
  await prisma.customerPushToken.update({
    where: { id: tokenId },
    data: { enabled: false, revokedAt: new Date() },
  });
}

async function campaignIdForBatch(batchId: string) {
  const batch = await prisma.pushNotificationCampaignBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { campaignId: true },
  });
  return batch.campaignId;
}

function campaignPayload(campaign: { href: string | null; imageUrl: string | null }) {
  return {
    type: "campaign",
    ...(campaign.href ? { href: campaign.href } : {}),
    ...(campaign.imageUrl ? { imageUrl: campaign.imageUrl } : {}),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
