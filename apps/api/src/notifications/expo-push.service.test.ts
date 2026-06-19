import { NotificationStatus, PushNotificationType } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { ExpoPushService } from "./expo-push.service";

describe("ExpoPushService", () => {
  it("sends seller push notifications and records a sent log", async () => {
    const prisma = createPrisma();
    prisma.client.sellerPushToken.findMany.mockResolvedValue([
      { id: "token_1", token: "ExponentPushToken[token-1]", userId: "user_1" },
    ]);
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_1" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "ticket_1", status: "ok" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new ExpoPushService(prisma as never);
    await service.notifySeller({
      sellerId: "seller_1",
      templateCode: "SELLER_ORDER_RECEIVED_PUSH",
      eventCode: "seller.order.received",
      title: "New order received",
      body: "Order ORD-1 is ready for seller action.",
      data: { href: "/orders/ORD-1", orderNumber: "ORD-1", type: "seller_order" },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          to: "ExponentPushToken[token-1]",
          title: "New order received",
          body: "Order ORD-1 is ready for seller action.",
          data: { href: "/orders/ORD-1", orderNumber: "ORD-1", type: "seller_order" },
          sound: "default",
          channelId: "seller-alerts",
        }),
      }),
    );
    expect(prisma.client.notificationLog.update).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({
        status: NotificationStatus.SENT,
        providerMessageId: "ticket_1",
      }),
    });
  });

  it("revokes stale Expo push tokens when the device is not registered", async () => {
    const prisma = createPrisma();
    prisma.client.sellerPushToken.findMany.mockResolvedValue([
      { id: "token_1", token: "ExponentPushToken[token-1]", userId: "user_1" },
    ]);
    prisma.client.notificationLog.create.mockResolvedValue({ id: "log_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { status: "error", message: "DeviceNotRegistered" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const service = new ExpoPushService(prisma as never);
    await service.notifySeller({
      sellerId: "seller_1",
      templateCode: "SELLER_ORDER_RECEIVED_PUSH",
      eventCode: "seller.order.received",
      title: "New order received",
      body: "Order ORD-1 is ready for seller action.",
      data: { href: "/orders/ORD-1" },
    });

    expect(prisma.client.notificationLog.update).toHaveBeenCalledWith({
      where: { id: "log_1" },
      data: expect.objectContaining({ status: NotificationStatus.FAILED }),
    });
    expect(prisma.client.sellerPushToken.update).toHaveBeenCalledWith({
      where: { id: "token_1" },
      data: expect.objectContaining({ enabled: false }),
    });
  });

  it("creates one customer inbox notification and fans out per token", async () => {
    const prisma = createPrisma();
    prisma.client.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      userId: "user_1",
      dealAlertsEnabled: true,
      marketingCampaignsEnabled: true,
    });
    prisma.client.customerNotification.findUnique.mockResolvedValue(null);
    prisma.client.customerNotification.create.mockResolvedValue({ id: "notification_1" });
    prisma.client.customerPushToken.findMany.mockResolvedValue([
      { id: "customer_token_1", token: "ExponentPushToken[token-1]", userId: "user_1" },
      { id: "customer_token_2", token: "ExponentPushToken[token-2]", userId: "user_1" },
    ]);
    prisma.client.notificationLog.create
      .mockResolvedValueOnce({ id: "log_1" })
      .mockResolvedValueOnce({ id: "log_2" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "ticket_1", status: "ok" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const service = new ExpoPushService(prisma as never);
    await service.notifyCustomer({
      customerId: "customer_1",
      type: PushNotificationType.ORDER_PLACED,
      templateCode: "CUSTOMER_ORDER_PLACED_PUSH",
      eventCode: "customer.order.placed",
      title: "Order placed",
      body: "Order ORD-1 has been placed successfully.",
      href: "/orders/ORD-1",
      sourceType: "order",
      sourceId: "order_1",
      data: { orderNumber: "ORD-1" },
    });

    expect(prisma.client.customerNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "customer_1",
          type: PushNotificationType.ORDER_PLACED,
          sourceType: "order",
          sourceId: "order_1",
        }),
      }),
    );
    expect(prisma.client.notificationLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.client.notificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerNotificationId: "notification_1",
        customerPushTokenId: "customer_token_1",
        recipient: "ExponentPushToken[token-1]",
      }),
    });
  });

  it("skips promotional customer push when the matching preference is disabled", async () => {
    const prisma = createPrisma();
    prisma.client.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      userId: "user_1",
      dealAlertsEnabled: false,
      marketingCampaignsEnabled: true,
    });

    const service = new ExpoPushService(prisma as never);
    await service.notifyCustomer({
      customerId: "customer_1",
      type: PushNotificationType.DEAL_PUBLISHED,
      templateCode: "CUSTOMER_DEAL_PUBLISHED_PUSH",
      eventCode: "deal.published.customer",
      title: "Deal live",
      body: "Deal body",
      sourceType: "deal",
      sourceId: "deal_1",
      promotionalPreference: "dealAlertsEnabled",
    });

    expect(prisma.client.customerNotification.create).not.toHaveBeenCalled();
    expect(prisma.client.customerPushToken.findMany).not.toHaveBeenCalled();
  });

  it("does not fan out customer push again when the inbox event already exists", async () => {
    const prisma = createPrisma();
    prisma.client.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      userId: "user_1",
      dealAlertsEnabled: true,
      marketingCampaignsEnabled: true,
    });
    prisma.client.customerNotification.findUnique.mockResolvedValue({ id: "notification_existing" });

    const service = new ExpoPushService(prisma as never);
    const result = await service.notifyCustomer({
      customerId: "customer_1",
      type: PushNotificationType.ORDER_DELIVERED,
      templateCode: "CUSTOMER_ORDER_DELIVERED_PUSH",
      eventCode: "customer.order.delivered",
      title: "Order delivered",
      body: "Order ORD-1 has been delivered.",
      href: "/orders/ORD-1",
      sourceType: "order",
      sourceId: "order_1",
      data: { orderNumber: "ORD-1" },
    });

    expect(result).toEqual({ id: "notification_existing" });
    expect(prisma.client.customerNotification.create).not.toHaveBeenCalled();
    expect(prisma.client.customerPushToken.findMany).not.toHaveBeenCalled();
    expect(prisma.client.notificationLog.create).not.toHaveBeenCalled();
  });

  it("does not fan out customer push when another worker creates the same inbox event first", async () => {
    const prisma = createPrisma();
    prisma.client.customer.findUnique.mockResolvedValue({
      id: "customer_1",
      userId: "user_1",
      dealAlertsEnabled: true,
      marketingCampaignsEnabled: true,
    });
    prisma.client.customerNotification.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "notification_existing" });
    prisma.client.customerNotification.create.mockRejectedValue({ code: "P2002" });

    const service = new ExpoPushService(prisma as never);
    const result = await service.notifyCustomer({
      customerId: "customer_1",
      type: PushNotificationType.ORDER_DELIVERED,
      templateCode: "CUSTOMER_ORDER_DELIVERED_PUSH",
      eventCode: "customer.order.delivered",
      title: "Order delivered",
      body: "Order ORD-1 has been delivered.",
      href: "/orders/ORD-1",
      sourceType: "order",
      sourceId: "order_1",
      data: { orderNumber: "ORD-1" },
    });

    expect(result).toEqual({ id: "notification_existing" });
    expect(prisma.client.customerPushToken.findMany).not.toHaveBeenCalled();
    expect(prisma.client.notificationLog.create).not.toHaveBeenCalled();
  });
});

function createPrisma() {
  return {
    client: {
      sellerPushToken: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      customer: {
        findUnique: vi.fn(),
      },
      customerPushToken: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      customerNotification: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      notificationLog: {
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  };
}
