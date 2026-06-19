import {
  NotificationStatus,
  PushNotificationBatchStatus,
  PushNotificationReceiptStatus,
  prisma,
} from "@indihub/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPendingPushReceipts,
  sendPushCampaignBatch,
  sweepStalePushCampaignBatches,
} from "./push-campaign-worker";

vi.mock("@indihub/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@indihub/database")>();
  return {
    ...actual,
    prisma: {
      pushNotificationCampaignBatch: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      pushNotificationCampaign: {
        update: vi.fn(),
      },
      customerPushToken: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      customerNotification: {
        upsert: vi.fn(),
      },
      notificationLog: {
        create: vi.fn(),
        update: vi.fn(),
      },
      pushNotificationReceipt: {
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

const db = prisma as unknown as {
  pushNotificationCampaignBatch: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  pushNotificationCampaign: { update: ReturnType<typeof vi.fn> };
  customerPushToken: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  customerNotification: { upsert: ReturnType<typeof vi.fn> };
  notificationLog: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  pushNotificationReceipt: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("push campaign worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-19T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reclaims stale claimed campaign batches", async () => {
    db.pushNotificationCampaignBatch.updateMany.mockResolvedValue({ count: 2 });

    await expect(sweepStalePushCampaignBatches()).resolves.toBe(2);

    expect(db.pushNotificationCampaignBatch.updateMany).toHaveBeenCalledWith({
      where: {
        status: PushNotificationBatchStatus.CLAIMED,
        claimedAt: { lt: new Date("2026-06-19T09:45:00.000Z") },
      },
      data: {
        status: PushNotificationBatchStatus.PENDING,
        claimedBy: null,
        claimedAt: null,
      },
    });
  });

  it("handles Expo ticket errors immediately and revokes DeviceNotRegistered tokens", async () => {
    db.pushNotificationCampaignBatch.findUnique.mockResolvedValue({
      id: "batch_1",
      campaignId: "campaign_1",
      status: PushNotificationBatchStatus.CLAIMED,
      recipientTokenIds: ["token_1"],
      campaign: {
        id: "campaign_1",
        title: "Sale",
        body: "Fresh offers",
        imageUrl: null,
        href: "/deals",
        segmentFilter: {},
      },
    });
    db.customerPushToken.findMany.mockResolvedValue([
      { id: "token_1", token: "ExponentPushToken[token-1]", userId: "user_1", customerId: "customer_1" },
    ]);
    db.customerNotification.upsert.mockResolvedValue({ id: "notification_1" });
    db.notificationLog.create.mockResolvedValue({ id: "log_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              status: "error",
              message: "DeviceNotRegistered",
              details: { error: "DeviceNotRegistered" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(sendPushCampaignBatch("batch_1")).resolves.toMatchObject({ failed: 1, revoked: 1 });

    expect(db.notificationLog.update).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({
        status: NotificationStatus.FAILED,
        errorMessage: "DeviceNotRegistered",
      }),
    });
    expect(db.customerPushToken.update).toHaveBeenCalledWith({
      where: { id: "token_1" },
      data: expect.objectContaining({ enabled: false }),
    });
    expect(db.pushNotificationCampaignBatch.update).toHaveBeenCalledWith({
      where: { id: "batch_1" },
      data: expect.objectContaining({
        status: PushNotificationBatchStatus.DONE,
        ticketErrors: [{ tokenId: "token_1", message: "DeviceNotRegistered", errorCode: "DeviceNotRegistered" }],
      }),
    });
  });

  it("stores receipt checks and revokes tokens on delayed DeviceNotRegistered", async () => {
    db.pushNotificationReceipt.findMany.mockResolvedValue([
      {
        id: "receipt_1",
        ticketId: "ticket_1",
        notificationLogId: "log_1",
        customerPushTokenId: "token_1",
        notificationLog: { pushCampaignBatchId: null },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              ticket_1: {
                status: "error",
                message: "DeviceNotRegistered",
                details: { error: "DeviceNotRegistered" },
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(checkPendingPushReceipts()).resolves.toBe(1);

    expect(db.pushNotificationReceipt.update).toHaveBeenCalledWith({
      where: { id: "receipt_1" },
      data: expect.objectContaining({
        status: PushNotificationReceiptStatus.FAILED,
        errorCode: "DeviceNotRegistered",
        checkedAt: new Date("2026-06-19T10:00:00.000Z"),
      }),
    });
    expect(db.notificationLog.update).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({ status: NotificationStatus.FAILED }),
    });
    expect(db.customerPushToken.update).toHaveBeenCalledWith({
      where: { id: "token_1" },
      data: expect.objectContaining({ enabled: false }),
    });
  });
});
