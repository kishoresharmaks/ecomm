import { BadRequestException } from "@nestjs/common";
import { PushNotificationCampaignStatus, UserStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PushCampaignsService } from "./push-campaigns.service";

describe("PushCampaignsService", () => {
  const prisma = {
    client: {
      pushNotificationCampaign: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      pushNotificationCampaignBatch: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
        updateMany: vi.fn(),
      },
      customerPushToken: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(prisma.client)),
    },
  };
  const storage = {
    publicImageUrl: vi.fn(),
  };
  const actor = { id: "admin_1", roles: ["ADMIN"] };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.client.customerPushToken.count.mockResolvedValue(7);
    prisma.client.customerPushToken.findMany.mockResolvedValue([]);
    storage.publicImageUrl.mockResolvedValue("https://ik.imagekit.io/indihub/1handindia/admin/admin_1/banners/push.webp");
  });

  it("validates image keys and href allow-list when creating a campaign", async () => {
    prisma.client.pushNotificationCampaign.create.mockResolvedValue({ id: "campaign_1" });
    const service = new PushCampaignsService(prisma as never, storage as never);

    await service.createCampaign(actor as never, {
      title: "Festive deal",
      body: "Fresh offers are live.",
      imageAssetKey: "1handindia/admin/admin_1/banners/push.webp",
      href: "/deals",
      segmentFilter: { countryCode: "in" },
    });

    expect(storage.publicImageUrl).toHaveBeenCalledWith("1handindia/admin/admin_1/banners/push.webp");
    expect(prisma.client.pushNotificationCampaign.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        href: "/deals",
        imageAssetKey: "1handindia/admin/admin_1/banners/push.webp",
        imageUrl: "https://ik.imagekit.io/indihub/1handindia/admin/admin_1/banners/push.webp",
        segmentFilter: { countryCode: "IN" },
        previewCount: 7,
      }),
    });
    expect(prisma.client.customerPushToken.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        enabled: true,
        revokedAt: null,
        customer: expect.objectContaining({
          status: UserStatus.ACTIVE,
          marketingCampaignsEnabled: true,
          AND: [
            {
              OR: [
                { browsingCountryCode: "IN" },
                { addresses: { some: { countryCode: "IN" } } },
                { AND: [{ browsingCountryCode: null }, { addresses: { none: {} } }] },
              ],
            },
          ],
        }),
      }),
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "push_campaign.created",
        entityType: "push_notification_campaign",
      }),
    });
  });

  it("rejects arbitrary image URLs and unapproved deep links", async () => {
    const service = new PushCampaignsService(prisma as never, storage as never);

    await expect(
      service.createCampaign(actor as never, {
        title: "Bad image",
        body: "Nope",
        imageAssetKey: "https://example.com/push.jpg",
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.createCampaign(actor as never, {
        title: "Bad link",
        body: "Nope",
        href: "https://example.com",
      }),
    ).rejects.toThrow("Campaign deep link is not allowed");
  });

  it("returns preview diagnostics and matches short and prefixed state codes", async () => {
    prisma.client.customerPushToken.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);
    const service = new PushCampaignsService(prisma as never, storage as never);

    await expect(
      service.previewCampaign({
        title: "Tamil Nadu offer",
        body: "Local deals are live.",
        segmentFilter: { countryCode: "in", stateCode: "tn" },
      }),
    ).resolves.toEqual({
      count: 3,
      diagnostics: {
        activeTokens: 8,
        countryMatchedTokens: 5,
        finalTokens: 3,
        optedInTokens: 6,
        stateMatchedTokens: 3,
        totalTokens: 10,
      },
      segmentFilter: { countryCode: "IN", stateCode: "TN" },
    });

    expect(prisma.client.customerPushToken.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        customer: expect.objectContaining({
          AND: [
            expect.any(Object),
            {
              OR: [
                { browsingStateCode: { in: ["TN", "IN-TN"] } },
                { addresses: { some: { stateCode: { in: ["TN", "IN-TN"] } } } },
                { addresses: { some: { state: { equals: "TN", mode: "insensitive" } } } },
              ],
            },
          ],
        }),
      }),
    });
  });

  it("prepares idempotent 100-token campaign batches and stores authoritative targeted count", async () => {
    const tokens = Array.from({ length: 205 }, (_, index) => ({ id: `token_${index + 1}` }));
    prisma.client.pushNotificationCampaign.findUnique.mockResolvedValue({
      id: "campaign_1",
      title: "Festive deal",
      body: "Fresh offers",
      imageAssetKey: null,
      imageUrl: null,
      href: "/deals",
      segmentFilter: {},
      status: PushNotificationCampaignStatus.DRAFT,
      scheduledAt: null,
    });
    prisma.client.customerPushToken.findMany.mockResolvedValue(tokens);
    prisma.client.pushNotificationCampaign.update.mockResolvedValue({
      id: "campaign_1",
      status: PushNotificationCampaignStatus.SENDING,
      previewCount: 205,
    });
    const service = new PushCampaignsService(prisma as never, storage as never);

    await service.sendNow(actor as never, "campaign_1");

    expect(prisma.client.pushNotificationCampaignBatch.deleteMany).toHaveBeenCalledWith({
      where: { campaignId: "campaign_1" },
    });
    expect(prisma.client.pushNotificationCampaignBatch.createMany).toHaveBeenCalledWith({
      data: [
        { campaignId: "campaign_1", recipientTokenIds: tokens.slice(0, 100).map((token) => token.id) },
        { campaignId: "campaign_1", recipientTokenIds: tokens.slice(100, 200).map((token) => token.id) },
        { campaignId: "campaign_1", recipientTokenIds: tokens.slice(200).map((token) => token.id) },
      ],
    });
    expect(prisma.client.pushNotificationCampaign.update).toHaveBeenCalledWith({
      where: { id: "campaign_1" },
      data: expect.objectContaining({
        status: PushNotificationCampaignStatus.SENDING,
        targetedCount: 205,
        sentCount: 0,
        failedCount: 0,
        revokedCount: 0,
      }),
    });
  });
});
