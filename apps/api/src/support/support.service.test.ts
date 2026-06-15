import {
  EmailRecipientType,
  RoleCode,
  SupportRequesterType,
  SupportRequestSource,
  SupportRequestStatus,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { SupportService } from "./support.service";

describe("SupportService", () => {
  const notifications = {
    notifyEvent: vi.fn(),
    notifyAdminEvent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a public request with server-assigned source and richer context", async () => {
    const prisma = createPrisma();
    const service = new SupportService(prisma as never, notifications as never);

    const result = await service.createPublicRequest({
      name: "Public User",
      email: "PUBLIC@EXAMPLE.COM",
      phone: "9876543210",
      topic: "DELIVERY",
      requesterType: "GUEST",
      preferredContactChannel: "WHATSAPP",
      orderNumber: "ORD-FREE-TEXT",
      subject: "Delivery support",
      message: "Please check the current delivery status.",
    });

    expect(result).toMatchObject({
      email: "public@example.com",
      topic: "DELIVERY",
      requesterType: "GUEST",
      preferredContactChannel: "WHATSAPP",
      source: SupportRequestSource.WEB_CONTACT,
      orderNumber: "ORD-FREE-TEXT",
    });
    expect(prisma.client.supportRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: SupportRequestSource.WEB_CONTACT,
        topic: "DELIVERY",
        requesterType: "GUEST",
        preferredContactChannel: "WHATSAPP",
      }),
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: EMAIL_TRIGGER_EVENTS.SUPPORT_REQUEST_RECEIVED,
        recipientType: EmailRecipientType.SUPPORT_REQUESTER,
      }),
    );
  });

  it("derives authenticated contact fields and assigns account support source", async () => {
    const prisma = createPrisma();
    prisma.client.user.findUnique.mockResolvedValue({
      email: "account@example.com",
      phone: "9876543210",
      fullName: "Account User",
      customer: { displayName: "Account Display" },
    });
    const service = new SupportService(prisma as never, notifications as never);

    const result = await service.createAuthenticatedRequest(
      {
        id: "user_1",
        clerkUserId: "clerk_1",
        email: "session@example.com",
        roles: [RoleCode.CUSTOMER],
      },
      {
        topic: "ORDER",
        preferredContactChannel: "EMAIL",
        subject: "Order support",
        message: "Please help with my account order issue.",
      },
    );

    expect(result).toMatchObject({
      userId: "user_1",
      name: "Account User",
      email: "account@example.com",
      phone: "9876543210",
      requesterType: SupportRequesterType.CUSTOMER,
      source: SupportRequestSource.WEB_ACCOUNT_SUPPORT,
    });
  });

  it("lists only the authenticated customer's support requests newest first", async () => {
    const prisma = createPrisma();
    const service = new SupportService(prisma as never, notifications as never);

    await service.listCustomerRequests(
      {
        id: "user_1",
        clerkUserId: "clerk_1",
        email: "customer@example.com",
        roles: [RoleCode.CUSTOMER],
      },
      { topic: "ORDER", search: "late" },
    );

    expect(prisma.client.supportRequest.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user_1",
        topic: "ORDER",
        OR: [
          { subject: { contains: "late", mode: "insensitive" } },
          { message: { contains: "late", mode: "insensitive" } },
          { orderNumber: { contains: "late", mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  it("sends requester response email once for responseMessage plus RESPONDED", async () => {
    const prisma = createPrisma();
    prisma.client.supportRequest.findUnique.mockResolvedValue({
      id: "support_1",
      userId: null,
      name: "Requester",
      email: "requester@example.com",
      subject: "Support needed",
      status: SupportRequestStatus.IN_REVIEW,
      adminNote: null,
      responseMessage: null,
      respondedAt: null,
    });
    prisma.client.supportRequest.update.mockResolvedValue({
      id: "support_1",
      userId: null,
      name: "Requester",
      email: "requester@example.com",
      subject: "Support needed",
      status: SupportRequestStatus.RESPONDED,
      adminNote: "Checked",
      responseMessage: "We checked this for you.",
      respondedAt: new Date("2026-06-11T10:00:00.000Z"),
    });
    const service = new SupportService(prisma as never, notifications as never);

    await service.updateRequest(
      { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
      "support_1",
      {
        status: SupportRequestStatus.RESPONDED,
        adminNote: "Checked",
        responseMessage: "We checked this for you.",
      },
    );

    expect(notifications.notifyEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: EMAIL_TRIGGER_EVENTS.SUPPORT_REQUEST_RESPONDED,
        recipient: "requester@example.com",
        variables: expect.objectContaining({
          responseMessage: "We checked this for you.",
        }),
      }),
    );
  });

  it("does not duplicate requester response email after a response is already stored", async () => {
    const prisma = createPrisma();
    prisma.client.supportRequest.findUnique.mockResolvedValue({
      id: "support_1",
      userId: null,
      name: "Requester",
      email: "requester@example.com",
      subject: "Support needed",
      status: SupportRequestStatus.RESPONDED,
      adminNote: null,
      responseMessage: "Already sent.",
      respondedAt: new Date("2026-06-11T09:00:00.000Z"),
    });
    prisma.client.supportRequest.update.mockResolvedValue({
      id: "support_1",
      userId: null,
      name: "Requester",
      email: "requester@example.com",
      subject: "Support needed",
      status: SupportRequestStatus.RESPONDED,
      adminNote: "Internal only",
      responseMessage: "Updated text.",
      respondedAt: new Date("2026-06-11T09:00:00.000Z"),
    });
    const service = new SupportService(prisma as never, notifications as never);

    await service.updateRequest(
      { id: "admin_1", clerkUserId: null, email: "admin@example.com", roles: [RoleCode.ADMIN] },
      "support_1",
      {
        status: SupportRequestStatus.RESPONDED,
        adminNote: "Internal only",
        responseMessage: "Updated text.",
      },
    );

    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });
});

function createPrisma() {
  return {
    client: {
      user: {
        findUnique: vi.fn(),
      },
      supportRequest: {
        create: vi.fn(async ({ data }) => ({
          id: "support_1",
          ...data,
          status: data.status ?? SupportRequestStatus.OPEN,
        })),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(async ({ data }) => ({
          id: "support_1",
          name: "Requester",
          email: "requester@example.com",
          subject: "Support needed",
          userId: null,
          ...data,
        })),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
}
