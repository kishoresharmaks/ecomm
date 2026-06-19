import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  NotificationChannel,
  NotificationStatus,
  Prisma,
  PushNotificationType,
} from "@indihub/database";
import { PrismaService } from "../prisma/prisma.service";

export type SellerPushPayload = {
  sellerId: string;
  templateCode: string;
  eventCode: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export type CustomerPushPayload = {
  customerId: string;
  type: PushNotificationType;
  templateCode: string;
  eventCode: string;
  title: string;
  body: string;
  href?: string | null;
  imageUrl?: string | null;
  sourceType: string;
  sourceId: string;
  metadata?: Prisma.InputJsonValue;
  promotionalPreference?: "dealAlertsEnabled" | "marketingCampaignsEnabled";
  data?: Record<string, string>;
};

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly endpoint = "https://exp.host/--/api/v2/push/send";

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async notifySeller(input: SellerPushPayload) {
    const tokens = await this.prisma.client.sellerPushToken.findMany({
      where: { sellerId: input.sellerId, enabled: true, revokedAt: null },
    });

    await Promise.allSettled(tokens.map((token) => this.deliver(input, token)));
  }

  async notifyCustomer(input: CustomerPushPayload) {
    const customer = await this.prisma.client.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        userId: true,
        dealAlertsEnabled: true,
        marketingCampaignsEnabled: true,
      },
    });
    if (!customer) {
      return null;
    }
    if (input.promotionalPreference && !customer[input.promotionalPreference]) {
      return null;
    }

    const uniqueWhere = {
      customerId_type_sourceType_sourceId: {
        customerId: input.customerId,
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    };
    const existing = await this.prisma.client.customerNotification.findUnique({
      where: uniqueWhere,
      select: { id: true },
    });
    if (existing) {
      return existing;
    }

    const created = await this.createCustomerNotificationOnce(input, uniqueWhere);
    const notification = created.notification;
    if (!notification) {
      return null;
    }
    if (!created.isNew) {
      return notification;
    }
    const tokens = await this.prisma.client.customerPushToken.findMany({
      where: { customerId: input.customerId, enabled: true, revokedAt: null },
    });

    await Promise.allSettled(tokens.map((token) => this.deliverCustomer(input, notification.id, token)));
    return notification;
  }

  private async createCustomerNotificationOnce(
    input: CustomerPushPayload,
    uniqueWhere: {
      customerId_type_sourceType_sourceId: {
        customerId: string;
        type: PushNotificationType;
        sourceType: string;
        sourceId: string;
      };
    },
  ) {
    try {
      return {
        notification: await this.prisma.client.customerNotification.create({
          data: {
            customerId: input.customerId,
            type: input.type,
            title: input.title,
            body: input.body,
            imageUrl: input.imageUrl ?? null,
            href: input.href ?? null,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            metadata: input.metadata ?? Prisma.JsonNull,
          },
        }),
        isNew: true,
      };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return {
          notification: await this.prisma.client.customerNotification.findUnique({
            where: uniqueWhere,
            select: { id: true },
          }),
          isNew: false,
        };
      }
      throw error;
    }
  }

  private async deliver(input: SellerPushPayload, token: { id: string; token: string; userId: string }) {
    const log = await this.prisma.client.notificationLog.create({
      data: {
        userId: token.userId,
        channel: NotificationChannel.PUSH,
        templateCode: input.templateCode,
        eventCode: input.eventCode,
        recipient: token.token,
        subject: input.title,
        body: input.body,
        variables: input.data,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token.token,
          title: input.title,
          body: input.body,
          data: input.data,
          sound: "default",
          channelId: "seller-alerts",
        }),
      });
      const result = (await response.json().catch(() => null)) as { data?: { id?: string; status?: string; message?: string } } | null;
      const receipt = result?.data;
      const failed = !response.ok || receipt?.status === "error";

      await this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: {
          status: failed ? NotificationStatus.FAILED : NotificationStatus.SENT,
          providerMessageId: receipt?.id ?? null,
          errorMessage: failed ? receipt?.message ?? `Expo Push API returned HTTP ${response.status}` : null,
          sentAt: failed ? null : new Date(),
        },
      });

      const normalizedMessage = receipt?.message?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
      if (failed && normalizedMessage.includes("devicenotregistered")) {
        await this.prisma.client.sellerPushToken.update({
          where: { id: token.id },
          data: { enabled: false, revokedAt: new Date() },
        });
      }
    } catch (error) {
      await this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.FAILED, errorMessage: error instanceof Error ? error.message : String(error) },
      });
      this.logger.warn(`Seller push failed for ${token.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async deliverCustomer(
    input: CustomerPushPayload,
    customerNotificationId: string,
    token: { id: string; token: string; userId: string },
  ) {
    const payload = {
      type: input.type,
      ...(input.href ? { href: input.href } : {}),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      ...input.data,
    };
    const log = await this.prisma.client.notificationLog.create({
      data: {
        userId: token.userId,
        customerNotificationId,
        customerPushTokenId: token.id,
        channel: NotificationChannel.PUSH,
        templateCode: input.templateCode,
        eventCode: input.eventCode,
        recipient: token.token,
        subject: input.title,
        body: input.body,
        variables: payload,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: token.token,
          title: input.title,
          body: input.body,
          data: payload,
          sound: "default",
          channelId: "customer-alerts",
          ...(input.imageUrl ? { richContent: { image: input.imageUrl } } : {}),
        }),
      });
      const result = (await response.json().catch(() => null)) as { data?: { id?: string; status?: string; message?: string; details?: unknown } } | null;
      const receipt = result?.data;
      const failed = !response.ok || receipt?.status === "error";

      await this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: {
          status: failed ? NotificationStatus.FAILED : NotificationStatus.SENT,
          providerMessageId: receipt?.id ?? null,
          errorMessage: failed ? receipt?.message ?? `Expo Push API returned HTTP ${response.status}` : null,
          sentAt: failed ? null : new Date(),
        },
      });

      const normalizedMessage = receipt?.message?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
      if (failed && normalizedMessage.includes("devicenotregistered")) {
        await this.prisma.client.customerPushToken.update({
          where: { id: token.id },
          data: { enabled: false, revokedAt: new Date() },
        });
      }
    } catch (error) {
      await this.prisma.client.notificationLog.update({
        where: { id: log.id },
        data: { status: NotificationStatus.FAILED, errorMessage: error instanceof Error ? error.message : String(error) },
      });
      this.logger.warn(`Customer push failed for ${token.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
