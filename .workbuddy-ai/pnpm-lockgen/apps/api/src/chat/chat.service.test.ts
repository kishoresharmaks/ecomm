import {
  ChatConversationStatus,
  ChatMessageSenderType,
  ChatMessageType,
  RoleCode,
} from "@indihub/database";
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatService } from "./chat.service";

describe("ChatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks user messages in resolved conversations", async () => {
    const prisma = createPrisma();
    prisma.client.chatConversation.findFirst.mockResolvedValue({
      id: "chat_1",
      sensitivity: "NORMAL",
      status: ChatConversationStatus.RESOLVED,
    });
    const service = new ChatService(prisma as never, settingsService() as never, {} as never);

    await expect(
      service.sendUserMessage(customerActor(), "chat_1", { message: "Still need help" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks handover in closed conversations", async () => {
    const prisma = createPrisma();
    prisma.client.chatConversation.findFirst.mockResolvedValue({
      id: "chat_1",
      status: ChatConversationStatus.CLOSED,
    });
    const service = new ChatService(prisma as never, settingsService() as never, {} as never);

    await expect(
      service.requestHandover(customerActor(), "chat_1", { note: "Talk to staff" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("writes a user-visible system message when admin closes a chat", async () => {
    const prisma = createPrisma();
    prisma.client.chatConversation.findFirst.mockResolvedValue({ id: "chat_1" });
    prisma.client.chatConversation.findUnique.mockResolvedValue({
      id: "chat_1",
      status: ChatConversationStatus.IN_PROGRESS,
      priority: "NORMAL",
      topic: "ORDER",
      sensitivity: "NORMAL",
      assignedToUserId: "admin_1",
    });
    prisma.client.$transaction.mockImplementation(async (callback: (tx: typeof prisma.client) => unknown) =>
      callback(prisma.client),
    );
    prisma.client.chatConversation.update.mockResolvedValue({
      id: "chat_1",
      status: ChatConversationStatus.CLOSED,
      priority: "NORMAL",
      topic: "ORDER",
      sensitivity: "NORMAL",
    });
    const service = new ChatService(prisma as never, settingsService() as never, {} as never);

    await service.updateConversation(adminActor(), "chat_1", { status: ChatConversationStatus.CLOSED });

    expect(prisma.client.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: "chat_1",
        senderType: ChatMessageSenderType.SYSTEM,
        messageType: ChatMessageType.SYSTEM_EVENT,
        body: "This chat was closed. Start a new chat if you still need help.",
      }),
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "chat.conversation.updated",
        newValue: expect.objectContaining({ status: ChatConversationStatus.CLOSED }),
      }),
    });
  });

  it("returns authenticated order choices for the track order guided action", async () => {
    const prisma = createPrisma();
    prisma.client.chatConversation.findFirst.mockResolvedValue({
      id: "chat_1",
      status: ChatConversationStatus.OPEN,
      topic: "ORDER",
      requesterType: "CUSTOMER",
    });
    prisma.client.order.findMany.mockResolvedValue([
      {
        orderNumber: "1HI001",
        orderStatus: "SHIPPED",
        paymentStatus: "PAID",
        deliveryStatus: "DISPATCHED",
        totalPaise: 129900,
        currency: "INR",
        createdAt: new Date("2026-06-21T08:00:00.000Z"),
        items: [{ productNameSnapshot: "Test product", quantity: 1 }],
      },
    ]);
    prisma.client.$transaction.mockImplementation(async (callback: (tx: typeof prisma.client) => unknown) =>
      callback(prisma.client),
    );
    prisma.client.chatMessage.create
      .mockResolvedValueOnce({ id: "msg_user", conversationId: "chat_1", createdAt: new Date("2026-06-21T08:01:00.000Z") })
      .mockResolvedValueOnce({ id: "msg_bot", conversationId: "chat_1", createdAt: new Date("2026-06-21T08:01:01.000Z") });
    const service = new ChatService(prisma as never, settingsService() as never, {} as never);

    await service.runGuidedAction(customerActor(), "chat_1", { action: "Track my order" });

    expect(prisma.client.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customer: { userId: "user_1" } },
      take: 8,
    }));
    expect(prisma.client.chatMessage.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        senderType: ChatMessageSenderType.BOT,
        messageType: ChatMessageType.GUIDED_ACTION,
        metadata: expect.objectContaining({
          kind: "order_picker",
          orders: [expect.objectContaining({ orderNumber: "1HI001" })],
        }),
      }),
    });
  });

  it("blocks customer chat actions when support chat is disabled", async () => {
    const prisma = createPrisma();
    const service = new ChatService(prisma as never, settingsService(false) as never, {} as never);

    await expect(service.listMine(customerActor())).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.client.chatConversation.findFirst).not.toHaveBeenCalled();
  });
});

function customerActor() {
  return {
    id: "user_1",
    clerkUserId: "clerk_1",
    email: "customer@example.com",
    roles: [RoleCode.CUSTOMER],
    permissions: [],
    authProvider: "CLERK" as const,
  };
}

function adminActor() {
  return {
    id: "admin_1",
    clerkUserId: null,
    email: "admin@example.com",
    roles: [RoleCode.ADMIN],
    permissions: ["chat.manage"],
    authProvider: "ADMIN_SESSION" as const,
  };
}

function settingsService(enabled = true) {
  return {
    getChatSupportConfig: vi.fn(async () => ({ enabled })),
  };
}

function createPrisma() {
  return {
    client: {
      chatConversation: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      chatMessage: {
        create: vi.fn(),
      },
      chatConversationEvent: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      chatRateLimitBucket: {
        upsert: vi.fn(async () => ({ count: 1 })),
      },
      $transaction: vi.fn(),
    },
  };
}
