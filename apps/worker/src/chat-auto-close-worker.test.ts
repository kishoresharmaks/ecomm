import {
  ChatConversationSensitivity,
  ChatConversationStatus,
  ChatMessageSenderType,
  ChatMessageType,
  prisma,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeInactiveNormalChats } from "./chat-auto-close-worker";

vi.mock("@indihub/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@indihub/database")>();
  return {
    ...actual,
    prisma: {
      chatConversation: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      chatMessage: {
        createMany: vi.fn(),
      },
      chatConversationEvent: {
        createMany: vi.fn(),
      },
      auditLog: {
        createMany: vi.fn(),
      },
      $transaction: vi.fn(async (callback) =>
        callback({
          chatConversation: db.chatConversation,
          chatMessage: db.chatMessage,
          chatConversationEvent: db.chatConversationEvent,
          auditLog: db.auditLog,
        }),
      ),
    },
  };
});

const db = prisma as unknown as {
  chatConversation: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  chatMessage: { createMany: ReturnType<typeof vi.fn> };
  chatConversationEvent: { createMany: ReturnType<typeof vi.fn> };
  auditLog: { createMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("chat auto-close worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.chatConversation.updateMany.mockResolvedValue({ count: 1 });
  });

  it("closes normal chats with no staff response after the timeout", async () => {
    db.chatConversation.findMany
      .mockResolvedValueOnce([{ id: "chat_1", status: ChatConversationStatus.WAITING_FOR_STAFF }])
      .mockResolvedValueOnce([]);

    await expect(closeInactiveNormalChats(10, new Date("2026-06-21T10:00:00.000Z"))).resolves.toMatchObject({
      closed: 1,
      noStaffResponse: 1,
      inactiveAfterStaff: 0,
    });

    expect(db.chatConversation.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        sensitivity: ChatConversationSensitivity.NORMAL,
        status: ChatConversationStatus.WAITING_FOR_STAFF,
        lastStaffMessageAt: null,
      }),
    }));
    expect(db.chatConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        sensitivity: ChatConversationSensitivity.NORMAL,
        status: { notIn: [ChatConversationStatus.RESOLVED, ChatConversationStatus.CLOSED] },
      }),
      data: expect.objectContaining({ status: ChatConversationStatus.CLOSED }),
    }));
    expect(db.chatMessage.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          conversationId: "chat_1",
          senderType: ChatMessageSenderType.SYSTEM,
          messageType: ChatMessageType.SYSTEM_EVENT,
        }),
      ],
    });
  });

  it("closes normal chats when the user is inactive after staff response", async () => {
    db.chatConversation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "chat_2",
          status: ChatConversationStatus.IN_PROGRESS,
          lastStaffMessageAt: new Date("2026-06-20T09:00:00.000Z"),
          lastUserMessageAt: new Date("2026-06-20T08:30:00.000Z"),
        },
      ]);

    await expect(closeInactiveNormalChats(10, new Date("2026-06-21T10:00:00.000Z"))).resolves.toMatchObject({
      closed: 1,
      noStaffResponse: 0,
      inactiveAfterStaff: 1,
    });

    expect(db.chatConversation.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        sensitivity: ChatConversationSensitivity.NORMAL,
        status: { in: [ChatConversationStatus.OPEN, ChatConversationStatus.WAITING_FOR_STAFF, ChatConversationStatus.IN_PROGRESS] },
      }),
    }));
  });

  it("does not sweep sensitive conversations", async () => {
    db.chatConversation.findMany.mockResolvedValue([]);

    await expect(closeInactiveNormalChats(10, new Date("2026-06-21T10:00:00.000Z"))).resolves.toMatchObject({
      closed: 0,
    });

    expect(db.chatConversation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sensitivity: ChatConversationSensitivity.NORMAL }),
    }));
    expect(db.chatConversation.updateMany).not.toHaveBeenCalled();
  });
});
