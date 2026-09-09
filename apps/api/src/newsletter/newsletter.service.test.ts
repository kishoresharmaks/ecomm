import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { NewsletterService } from "./newsletter.service";

describe("NewsletterService", () => {
  const prisma = {
    client: {
      newsletterSubscriber: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      emailSetting: {
        findFirst: vi.fn(),
      },
    },
  };

  const emailDelivery = {
    deliver: vi.fn(),
  };

  let service: NewsletterService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new NewsletterService(prisma as never, emailDelivery as never);
    prisma.client.emailSetting.findFirst.mockResolvedValue({
      senderName: "1HandIndia",
      senderEmail: "newsletter@1handindia.com",
    });
    emailDelivery.deliver.mockResolvedValue({ providerMessageId: "msg_123" });
  });

  describe("subscribe", () => {
    it("subscribes a new email and sends a welcome email", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue(null);
      prisma.client.newsletterSubscriber.create.mockResolvedValue({
        email: "test@example.com",
        name: "Test User",
        status: "ACTIVE",
      });

      const result = await service.subscribe({
        email: "TEST@EXAMPLE.COM ",
        name: "Test User",
        source: "footer",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("ACTIVE");
      expect(prisma.client.newsletterSubscriber.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          name: "Test User",
          source: "footer",
          ipAddress: null,
          userAgent: null,
        },
      });
      expect(emailDelivery.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: "test@example.com",
          subject: "Welcome to 1HandIndia!",
          templateCode: "NEWSLETTER_WELCOME",
        }),
      );
    });

    it("returns already subscribed when subscriber is active", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue({
        status: "ACTIVE",
        name: "Existing User",
      });

      const result = await service.subscribe({
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe("You are already subscribed.");
      expect(prisma.client.newsletterSubscriber.create).not.toHaveBeenCalled();
      expect(prisma.client.newsletterSubscriber.update).not.toHaveBeenCalled();
      expect(emailDelivery.deliver).not.toHaveBeenCalled();
    });

    it("reactivates an unsubscribed user and sends welcome email", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue({
        status: "UNSUBSCRIBED",
        name: "Old Name",
      });
      prisma.client.newsletterSubscriber.update.mockResolvedValue({
        email: "test@example.com",
        status: "ACTIVE",
      });

      const result = await service.subscribe({
        email: "test@example.com",
        name: "New Name",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Welcome back");
      expect(prisma.client.newsletterSubscriber.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          status: "ACTIVE",
          name: "New Name",
          unsubscribedAt: null,
        }),
      });
      expect(emailDelivery.deliver).toHaveBeenCalled();
    });
  });

  describe("listSubscribers", () => {
    it("returns paginated subscribers and total count", async () => {
      const subscribers = [
        { email: "user1@example.com", status: "ACTIVE" },
        { email: "user2@example.com", status: "ACTIVE" },
      ];
      prisma.client.newsletterSubscriber.findMany.mockResolvedValue(subscribers);
      prisma.client.newsletterSubscriber.count.mockResolvedValue(2);

      const result = await service.listSubscribers({
        page: 1,
        limit: 20,
        search: "example",
        status: "ACTIVE",
        source: "footer",
      });

      expect(result.items).toEqual(subscribers);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(prisma.client.newsletterSubscriber.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: "example", mode: "insensitive" } },
            { name: { contains: "example", mode: "insensitive" } },
          ],
          status: "ACTIVE",
          source: "footer",
        },
        orderBy: { subscribedAt: "desc" },
        skip: 0,
        take: 20,
      });
    });
  });

  describe("unsubscribe", () => {
    it("unsubscribes an existing active subscriber", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue({
        email: "test@example.com",
        status: "ACTIVE",
      });
      prisma.client.newsletterSubscriber.update.mockResolvedValue({
        email: "test@example.com",
        status: "UNSUBSCRIBED",
      });

      const result = await service.unsubscribe("test@example.com");

      expect(result.success).toBe(true);
      expect(result.message).toContain("unsubscribed");
      expect(prisma.client.newsletterSubscriber.update).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
        data: expect.objectContaining({
          status: "UNSUBSCRIBED",
        }),
      });
    });

    it("handles not found subscriber gracefully", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue(null);

      const result = await service.unsubscribe("unknown@example.com");

      expect(result.success).toBe(true);
      expect(result.message).toBe("You were not subscribed.");
      expect(prisma.client.newsletterSubscriber.update).not.toHaveBeenCalled();
    });
  });

  describe("resendWelcome", () => {
    it("resends welcome email to an active subscriber", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue({
        status: "ACTIVE",
        name: "Test User",
      });

      const result = await service.resendWelcome("test@example.com");

      expect(result.success).toBe(true);
      expect(emailDelivery.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: "test@example.com",
          subject: "Welcome to 1HandIndia!",
        }),
      );
    });

    it("throws NotFoundException if subscriber is not active", async () => {
      prisma.client.newsletterSubscriber.findUnique.mockResolvedValue({
        status: "UNSUBSCRIBED",
        name: "Test User",
      });

      await expect(service.resendWelcome("test@example.com")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
