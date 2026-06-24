import type pino from "pino";
import {
  ChatConversationSensitivity,
  ChatConversationStatus,
  ChatMessageSenderType,
  ChatMessageType,
  prisma,
} from "@indihub/database";

type Logger = pino.Logger;

const terminalStatuses = [ChatConversationStatus.RESOLVED, ChatConversationStatus.CLOSED];
const activeStatuses = [
  ChatConversationStatus.OPEN,
  ChatConversationStatus.WAITING_FOR_STAFF,
  ChatConversationStatus.IN_PROGRESS,
];

export function startChatAutoClosePolling(logger: Logger) {
  if (process.env.CHAT_AUTO_CLOSE_WORKER_ENABLED === "false") {
    logger.info("Chat auto-close worker disabled by CHAT_AUTO_CLOSE_WORKER_ENABLED=false.");
    return;
  }

  const pollIntervalMs = positiveInteger(process.env.CHAT_AUTO_CLOSE_POLL_INTERVAL_MS, 60000);
  const batchSize = positiveInteger(process.env.CHAT_AUTO_CLOSE_BATCH_SIZE, 50);
  let running = false;

  const poll = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await closeInactiveNormalChats(batchSize);
      if (result.closed > 0) {
        logger.info(result, "Inactive normal support chats auto-closed");
      }
    } catch (error) {
      logger.error({ error }, "Chat auto-close poll failed");
    } finally {
      running = false;
    }
  };

  void poll();
  setInterval(() => {
    void poll();
  }, pollIntervalMs);

  logger.info({ pollIntervalMs, batchSize }, "Chat auto-close worker started");
}

export async function closeInactiveNormalChats(limit = 50, now = new Date()) {
  const take = Math.min(100, Math.max(1, Math.trunc(limit)));
  const noStaffMinutes = positiveInteger(process.env.CHAT_NO_STAFF_RESPONSE_CLOSE_MINUTES, 30);
  const userInactiveHours = positiveInteger(process.env.CHAT_USER_INACTIVE_AFTER_STAFF_CLOSE_HOURS, 24);
  const noStaffBefore = new Date(now.getTime() - noStaffMinutes * 60_000);
  const userInactiveBefore = new Date(now.getTime() - userInactiveHours * 60 * 60_000);

  const noStaffResponse = await prisma.chatConversation.findMany({
    where: {
      sensitivity: ChatConversationSensitivity.NORMAL,
      status: ChatConversationStatus.WAITING_FOR_STAFF,
      lastStaffMessageAt: null,
      OR: [{ firstResponseDueAt: { lte: now } }, { handoverRequestedAt: { lte: noStaffBefore } }],
    },
    select: { id: true, status: true },
    orderBy: [{ firstResponseDueAt: "asc" }, { handoverRequestedAt: "asc" }],
    take,
  });

  const remaining = Math.max(0, take - noStaffResponse.length);
  const noStaffIds = new Set(noStaffResponse.map((conversation) => conversation.id));
  const inactiveAfterStaffWhere = {
    sensitivity: ChatConversationSensitivity.NORMAL,
    status: { in: activeStatuses },
    ...(noStaffIds.size ? { id: { notIn: Array.from(noStaffIds) } } : {}),
    lastStaffMessageAt: { lte: userInactiveBefore },
  };
  const inactiveAfterStaff =
    remaining > 0
      ? (
          await prisma.chatConversation.findMany({
            where: inactiveAfterStaffWhere,
            select: {
              id: true,
              status: true,
              lastStaffMessageAt: true,
              lastUserMessageAt: true,
            },
            orderBy: { lastStaffMessageAt: "asc" },
            take: remaining,
          })
        ).filter(
          (conversation) =>
            conversation.lastStaffMessageAt &&
            (!conversation.lastUserMessageAt || conversation.lastUserMessageAt <= conversation.lastStaffMessageAt),
        )
      : [];

  const closures = [
    ...noStaffResponse.map((conversation) => ({
      id: conversation.id,
      oldStatus: conversation.status,
      reason: "NO_STAFF_RESPONSE",
      note: "This chat was closed because no staff response was available in time. Start a new chat if you still need help.",
    })),
    ...inactiveAfterStaff.map((conversation) => ({
      id: conversation.id,
      oldStatus: conversation.status,
      reason: "USER_INACTIVE_AFTER_STAFF_RESPONSE",
      note: "This chat was closed after inactivity. Start a new chat if you still need help.",
    })),
  ];

  if (!closures.length) {
    return { closed: 0, noStaffResponse: 0, inactiveAfterStaff: 0 };
  }

  const ids = closures.map((closure) => closure.id);
  await prisma.$transaction(async (tx) => {
    await tx.chatConversation.updateMany({
      where: {
        id: { in: ids },
        sensitivity: ChatConversationSensitivity.NORMAL,
        status: { notIn: terminalStatuses },
      },
      data: {
        status: ChatConversationStatus.CLOSED,
        userUnreadCount: { increment: 1 },
      },
    });

    await tx.chatMessage.createMany({
      data: closures.map((closure) => ({
        conversationId: closure.id,
        senderType: ChatMessageSenderType.SYSTEM,
        messageType: ChatMessageType.SYSTEM_EVENT,
        body: closure.note,
      })),
    });

    await tx.chatConversationEvent.createMany({
      data: closures.map((closure) => ({
        conversationId: closure.id,
        eventType: "chat.conversation.auto_closed",
        oldValue: { status: closure.oldStatus },
        newValue: { status: ChatConversationStatus.CLOSED },
        metadata: { reason: closure.reason, note: closure.note },
      })),
    });

    await tx.auditLog.createMany({
      data: closures.map((closure) => ({
        actorUserId: null,
        action: "chat.conversation.auto_closed",
        entityType: "chat_conversation",
        entityId: closure.id,
        oldValue: { status: closure.oldStatus },
        newValue: { status: ChatConversationStatus.CLOSED, reason: closure.reason },
      })),
    });
  });

  return {
    closed: closures.length,
    noStaffResponse: noStaffResponse.length,
    inactiveAfterStaff: inactiveAfterStaff.length,
  };
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
