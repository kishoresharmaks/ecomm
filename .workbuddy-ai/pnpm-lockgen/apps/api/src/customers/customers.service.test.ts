import { RoleCode, UserStatus } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { CustomersService } from "./customers.service";

const actor = {
  id: "user_1",
  clerkUserId: "clerk_1",
  email: "customer@example.com",
  roles: [RoleCode.CUSTOMER],
};

describe("CustomersService", () => {
  it("saves account-backed browsing location with audit log", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customer.update.mockResolvedValue({
      browsingLocationLabel: "Mettu Street, Salem 636001",
      browsingCountryCode: "IN",
      browsingStateCode: "TN",
      browsingCityCode: "SALEM",
      browsingLocalAreaCode: "TN-SALEM-METTU-636001",
      browsingPincode: "636001",
    });
    const service = new CustomersService(prisma as never, {} as never);

    const result = await service.updateBrowsingLocation(
      actor,
      {
        label: "Mettu Street, Salem 636001",
        countryCode: "IN",
        stateCode: "TN",
        cityCode: "SALEM",
        localAreaCode: "TN-SALEM-METTU-636001",
        pincode: "636001",
      },
    );

    expect(tx.customer.upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      update: {},
      create: {
        userId: "user_1",
        displayName: "customer@example.com",
        status: UserStatus.ACTIVE,
      },
    });
    expect(prisma.client.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        browsingLocationLabel: "Mettu Street, Salem 636001",
        browsingCountryCode: "IN",
        browsingStateCode: "TN",
        browsingCityCode: "SALEM",
        browsingLocalAreaCode: "TN-SALEM-METTU-636001",
        browsingPincode: "636001",
      },
      select: {
        browsingLocationLabel: true,
        browsingCountryCode: true,
        browsingStateCode: true,
        browsingCityCode: true,
        browsingLocalAreaCode: true,
        browsingPincode: true,
      },
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "customer.browsing_location.updated",
        entityType: "customer",
        entityId: "customer_1",
      }),
    });
    expect(result.location).toEqual({
      label: "Mettu Street, Salem 636001",
      countryCode: "IN",
      stateCode: "TN",
      cityCode: "SALEM",
      localAreaCode: "TN-SALEM-METTU-636001",
      pincode: "636001",
    });
  });

  it("upserts rotated customer push tokens for the authenticated customer", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customerPushToken.upsert.mockResolvedValue({ id: "push_token_1" });
    const service = new CustomersService(prisma as never, {} as never);

    await expect(
      service.registerPushToken(actor, {
        token: "ExponentPushToken[token-1]",
        platform: "android",
        deviceId: " device-1 ",
        appVersion: "1.0.0",
      }),
    ).resolves.toEqual({ registered: true, tokenId: "push_token_1" });

    expect(prisma.client.customerPushToken.upsert).toHaveBeenCalledWith({
      where: { token: "ExponentPushToken[token-1]" },
      update: expect.objectContaining({
        customerId: "customer_1",
        userId: "user_1",
        enabled: true,
        revokedAt: null,
        deviceId: "device-1",
      }),
      create: expect.objectContaining({
        customerId: "customer_1",
        userId: "user_1",
        token: "ExponentPushToken[token-1]",
      }),
    });
  });

  it("upserts current Expo push token format for customer devices", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customerPushToken.upsert.mockResolvedValue({ id: "push_token_1" });
    const service = new CustomersService(prisma as never, {} as never);

    await expect(
      service.registerPushToken(actor, {
        token: "ExpoPushToken[token-1]",
        platform: "android",
      }),
    ).resolves.toEqual({ registered: true, tokenId: "push_token_1" });

    expect(prisma.client.customerPushToken.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: "ExpoPushToken[token-1]" },
      }),
    );
  });

  it("revokes only this user's customer push token", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    const service = new CustomersService(prisma as never, {} as never);

    await expect(service.revokePushToken(actor, { token: "ExponentPushToken[token-1]" })).resolves.toEqual({ revoked: true });

    expect(prisma.client.customerPushToken.updateMany).toHaveBeenCalledWith({
      where: { token: "ExponentPushToken[token-1]", userId: "user_1" },
      data: expect.objectContaining({
        enabled: false,
        revokedAt: expect.any(Date),
      }),
    });
  });

  it("updates only promotional notification preference toggles", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customer.update.mockResolvedValue({
      dealAlertsEnabled: false,
      marketingCampaignsEnabled: true,
    });
    const service = new CustomersService(prisma as never, {} as never);

    await expect(
      service.updateNotificationPreferences(actor, {
        dealAlertsEnabled: false,
      }),
    ).resolves.toEqual({
      dealAlertsEnabled: false,
      marketingCampaignsEnabled: true,
    });

    expect(prisma.client.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        dealAlertsEnabled: false,
      },
      select: {
        dealAlertsEnabled: true,
        marketingCampaignsEnabled: true,
      },
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "customer.notification_preferences.updated",
        entityType: "customer",
        entityId: "customer_1",
      }),
    });
  });

  it("returns cursor-paginated customer inbox notifications", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    const createdAt = new Date("2026-06-19T10:00:00.000Z");
    prisma.client.customerNotification.findMany.mockResolvedValue([
      { id: "notification_2", customerId: "customer_1", createdAt },
      { id: "notification_1", customerId: "customer_1", createdAt },
    ]);
    const service = new CustomersService(prisma as never, {} as never);

    const result = await service.listNotifications(actor, { limit: 1 });

    expect(prisma.client.customerNotification.findMany).toHaveBeenCalledWith({
      where: { customerId: "customer_1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
    });
    expect(result.items).toHaveLength(1);
    expect(result.pageInfo.hasNextPage).toBe(true);
    expect(result.pageInfo.nextCursor).toEqual(expect.any(String));
  });

  it("marks only owned customer notifications as read", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customerNotification.findFirst.mockResolvedValue({
      id: "notification_1",
      customerId: "customer_1",
      readAt: null,
    });
    prisma.client.customerNotification.update.mockResolvedValue({
      id: "notification_1",
      customerId: "customer_1",
      readAt: new Date("2026-06-19T10:00:00.000Z"),
    });
    const service = new CustomersService(prisma as never, {} as never);

    await service.markNotificationRead(actor, "notification_1");

    expect(prisma.client.customerNotification.findFirst).toHaveBeenCalledWith({
      where: { id: "notification_1", customerId: "customer_1" },
    });
    expect(prisma.client.customerNotification.update).toHaveBeenCalledWith({
      where: { id: "notification_1" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("marks all unread customer notifications as read", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customerNotification.updateMany.mockResolvedValue({ count: 3 });
    const service = new CustomersService(prisma as never, {} as never);

    await expect(service.markAllNotificationsRead(actor)).resolves.toEqual({ updated: 3 });

    expect(prisma.client.customerNotification.updateMany).toHaveBeenCalledWith({
      where: { customerId: "customer_1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});

function createCustomerTx() {
  return {
    customer: {
      upsert: vi.fn().mockResolvedValue({
        id: "customer_1",
        userId: "user_1",
      }),
    },
    wishlist: {
      upsert: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createCustomerTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      customer: {
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      customerPushToken: {
        upsert: vi.fn(),
        updateMany: vi.fn(),
      },
      customerNotification: {
        count: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
}
