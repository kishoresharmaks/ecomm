import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ChatConversationPriority,
  ChatConversationSensitivity,
  ChatConversationStatus,
  ChatEscalationReason,
  ChatMessageSenderType,
  ChatMessageType,
  ChatRateLimitAction,
  PaymentProvider,
  Prisma,
  RoleCode,
  SupportRequestSource,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { SupportService } from "../support/support.service";
import {
  AssignChatDto,
  ChatConversationQueryDto,
  ChatInternalNoteDto,
  GuidedChatActionDto,
  HandoverChatDto,
  SendChatMessageDto,
  StartChatConversationDto,
  UpdateChatConversationDto,
} from "./dto/chat.dto";

const chatRetentionYears = 3;
const firstResponseSlaMinutes = 30;
const terminalChatStatuses = new Set<ChatConversationStatus>([
  ChatConversationStatus.RESOLVED,
  ChatConversationStatus.CLOSED,
]);

type ChatEventPayload = {
  type: "message" | "conversation" | "clear-thread";
  conversationId: string;
  payload?: unknown;
};

type GuidedActionResponse = {
  body: string;
  metadata: Prisma.InputJsonObject;
};

@Injectable()
export class ChatService {
  private broadcaster: ((event: ChatEventPayload) => void) | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(SupportService) private readonly supportService: SupportService,
  ) {}

  setBroadcaster(broadcaster: (event: ChatEventPayload) => void) {
    this.broadcaster = broadcaster;
  }

  async listMine(actor: RequestUser) {
    await this.ensureChatEnabled();
    return this.prisma.client.chatConversation.findMany({
      where: { userId: actor.id },
      orderBy: { lastMessageAt: "desc" },
      take: 30,
      include: this.conversationInclude(false),
    });
  }

  async startConversation(actor: RequestUser, dto: StartChatConversationDto) {
    await this.ensureChatEnabled();
    await this.checkLimit(actor.id, ChatRateLimitAction.CONVERSATION_CREATE, "day", 10);
    await this.checkLimit(actor.id, ChatRateLimitAction.MESSAGE_SEND, "minute", 20);

    const now = new Date();
    const conversation = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.chatConversation.create({
        data: {
          userId: actor.id,
          requesterType: dto.requesterType,
          topic: dto.topic,
          subject: dto.subject.trim(),
          orderId: dto.orderId ?? null,
          productId: dto.productId ?? null,
          b2bEnquiryId: dto.b2bEnquiryId ?? null,
          status: ChatConversationStatus.OPEN,
          priority: ChatConversationPriority.NORMAL,
          sensitivity: ChatConversationSensitivity.NORMAL,
          retentionUntil: addYears(now, chatRetentionYears),
          lastMessageAt: now,
          lastUserMessageAt: now,
          staffUnreadCount: 1,
        },
      });
      await tx.chatMessage.create({
        data: {
          conversationId: created.id,
          senderUserId: actor.id,
          senderType: ChatMessageSenderType.USER,
          messageType: ChatMessageType.TEXT,
          body: dto.message.trim(),
        },
      });
      await tx.chatMessage.create({
        data: {
          conversationId: created.id,
          senderType: ChatMessageSenderType.BOT,
          messageType: ChatMessageType.GUIDED_ACTION,
          body: guidedReply(dto.topic, dto.requesterType),
          metadata: { intents: intentsForRequester(dto.requesterType) },
        },
      });
      await tx.chatConversationEvent.create({
        data: {
          conversationId: created.id,
          actorUserId: actor.id,
          eventType: "chat.conversation.created",
          newValue: {
            requesterType: dto.requesterType,
            topic: dto.topic,
            subject: dto.subject.trim(),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "chat.conversation.created",
          entityType: "chat_conversation",
          entityId: created.id,
          newValue: {
            requesterType: dto.requesterType,
            topic: dto.topic,
          },
        },
      });

      return created;
    });

    const full = await this.getMine(actor, conversation.id);
    this.broadcast({ type: "conversation", conversationId: conversation.id, payload: full });
    return full;
  }

  async getMine(actor: RequestUser, conversationId: string) {
    await this.ensureChatEnabled();
    const conversation = await this.prisma.client.chatConversation.findFirst({
      where: { id: conversationId, userId: actor.id },
      include: this.conversationInclude(true),
    });
    if (!conversation) {
      throw new NotFoundException("Chat conversation not found.");
    }
    return conversation;
  }

  async sendUserMessage(actor: RequestUser, conversationId: string, dto: SendChatMessageDto) {
    await this.ensureChatEnabled();
    await this.checkLimit(actor.id, ChatRateLimitAction.MESSAGE_SEND, "minute", 20);
    const existing = await this.prisma.client.chatConversation.findFirst({
      where: { id: conversationId, userId: actor.id },
      select: { id: true, sensitivity: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException("Chat conversation not found.");
    }
    if (terminalChatStatuses.has(existing.status)) {
      throw new BadRequestException("This chat is closed.");
    }

    const message = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId,
          senderUserId: actor.id,
          senderType: ChatMessageSenderType.USER,
          messageType: ChatMessageType.TEXT,
          body: dto.message.trim(),
          ...(dto.clientMessageId ? { metadata: { clientMessageId: dto.clientMessageId } } : {}),
        },
      });
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: created.createdAt,
          lastUserMessageAt: created.createdAt,
          staffUnreadCount: { increment: 1 },
        },
      });
      return created;
    });

    this.broadcast({ type: "message", conversationId, payload: message });
    return message;
  }

  async runGuidedAction(actor: RequestUser, conversationId: string, dto: GuidedChatActionDto) {
    await this.ensureChatEnabled();
    await this.checkLimit(actor.id, ChatRateLimitAction.BOT_TURN, "minute", 20);
    const existing = await this.prisma.client.chatConversation.findFirst({
      where: { id: conversationId, userId: actor.id },
      select: { id: true, status: true, topic: true, requesterType: true },
    });
    if (!existing) {
      throw new NotFoundException("Chat conversation not found.");
    }
    if (terminalChatStatuses.has(existing.status)) {
      throw new BadRequestException("This chat is closed.");
    }

    const action = normalizeGuidedAction(dto.action);
    const response = await this.buildGuidedActionResponse(actor, action, dto.selectedValue);
    const messages = await this.prisma.client.$transaction(async (tx) => {
      const userMessage = await tx.chatMessage.create({
        data: {
          conversationId,
          senderUserId: actor.id,
          senderType: ChatMessageSenderType.USER,
          messageType: ChatMessageType.GUIDED_ACTION,
          body: dto.action.trim(),
          metadata: {
            guidedAction: action,
            ...(dto.selectedValue ? { selectedValue: dto.selectedValue.trim() } : {}),
          },
        },
      });
      const botMessage = await tx.chatMessage.create({
        data: {
          conversationId,
          senderType: ChatMessageSenderType.BOT,
          messageType: ChatMessageType.GUIDED_ACTION,
          body: response.body,
          metadata: response.metadata,
        },
      });
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: botMessage.createdAt,
          lastUserMessageAt: userMessage.createdAt,
        },
      });
      return [userMessage, botMessage] as const;
    });

    for (const message of messages) {
      this.broadcast({ type: "message", conversationId, payload: message });
    }
    return { messages };
  }

  async requestHandover(actor: RequestUser, conversationId: string, dto: HandoverChatDto) {
    await this.ensureChatEnabled();
    const existing = await this.prisma.client.chatConversation.findFirst({
      where: { id: conversationId, userId: actor.id },
    });
    if (!existing) {
      throw new NotFoundException("Chat conversation not found.");
    }
    if (terminalChatStatuses.has(existing.status)) {
      throw new BadRequestException("This chat is closed.");
    }

    const now = new Date();
    const conversation = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          status: ChatConversationStatus.WAITING_FOR_STAFF,
          escalationReason: dto.reason ?? ChatEscalationReason.USER_REQUESTED_STAFF,
          handoverRequestedAt: now,
          firstResponseDueAt: existing.firstResponseDueAt ?? addMinutes(now, firstResponseSlaMinutes),
          nextResponseDueAt: existing.nextResponseDueAt ?? addMinutes(now, firstResponseSlaMinutes),
          staffUnreadCount: { increment: 1 },
        },
      });
      await tx.chatMessage.create({
        data: {
          conversationId,
          senderUserId: actor.id,
          senderType: ChatMessageSenderType.USER,
          messageType: ChatMessageType.STAFF_HANDOVER,
          body: dto.note?.trim() || "Talk to staff requested.",
        },
      });
      await tx.chatConversationEvent.create({
        data: {
          conversationId,
          actorUserId: actor.id,
          eventType: "chat.handover.requested",
          newValue: {
            reason: dto.reason ?? ChatEscalationReason.USER_REQUESTED_STAFF,
          },
        },
      });
      return updated;
    });

    this.broadcast({ type: "conversation", conversationId, payload: conversation });
    return this.getMine(actor, conversationId);
  }

  async listStaff(actor: RequestUser, query: ChatConversationQueryDto) {
    const where: Prisma.ChatConversationWhereInput = this.staffWhere(actor, query);
    return this.prisma.client.chatConversation.findMany({
      where,
      orderBy: [{ priority: "desc" }, { lastMessageAt: "desc" }],
      take: 100,
      include: this.conversationInclude(false),
    });
  }

  async getStaff(actor: RequestUser, conversationId: string) {
    const conversation = await this.prisma.client.chatConversation.findFirst({
      where: this.staffConversationWhere(actor, conversationId),
      include: this.conversationInclude(true),
    });
    if (!conversation) {
      throw new NotFoundException("Chat conversation not found.");
    }
    return {
      ...conversation,
      supportContext: await this.supportContext(conversation),
    };
  }

  async claim(actor: RequestUser, conversationId: string) {
    this.requireSupportOrAdmin(actor);
    const now = new Date();
    const result = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.chatConversation.updateMany({
        where: {
          id: conversationId,
          assignedToUserId: null,
          sensitivity: ChatConversationSensitivity.NORMAL,
          status: { in: [ChatConversationStatus.OPEN, ChatConversationStatus.WAITING_FOR_STAFF] },
        },
        data: {
          assignedToUserId: actor.id,
          status: ChatConversationStatus.IN_PROGRESS,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException("Chat is already claimed or unavailable.");
      }
      await tx.chatAssignment.create({
        data: {
          conversationId,
          assignedToId: actor.id,
          createdById: actor.id,
          action: "CLAIM",
        },
      });
      await tx.chatConversationEvent.create({
        data: {
          conversationId,
          actorUserId: actor.id,
          eventType: "chat.claim",
          newValue: { assignedToUserId: actor.id },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "chat.claim",
          entityType: "chat_conversation",
          entityId: conversationId,
          newValue: { assignedToUserId: actor.id, claimedAt: now.toISOString() },
        },
      });
      return tx.chatConversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: this.conversationInclude(false),
      });
    });

    this.broadcast({ type: "conversation", conversationId, payload: result });
    return result;
  }

  async replyStaff(actor: RequestUser, conversationId: string, dto: SendChatMessageDto) {
    await this.ensureStaffCanReply(actor, conversationId);
    const message = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId,
          senderUserId: actor.id,
          senderType: actor.roles.includes(RoleCode.ADMIN) ? ChatMessageSenderType.ADMIN : ChatMessageSenderType.SUPPORT_AGENT,
          messageType: ChatMessageType.TEXT,
          body: dto.message.trim(),
          ...(dto.clientMessageId ? { metadata: { clientMessageId: dto.clientMessageId } } : {}),
        },
      });
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          status: ChatConversationStatus.IN_PROGRESS,
          lastMessageAt: created.createdAt,
          lastStaffMessageAt: created.createdAt,
          userUnreadCount: { increment: 1 },
          staffUnreadCount: 0,
        },
      });
      return created;
    });
    this.broadcast({ type: "message", conversationId, payload: message });
    return message;
  }

  async addInternalNote(actor: RequestUser, conversationId: string, dto: ChatInternalNoteDto) {
    await this.ensureStaffCanManage(actor, conversationId);
    return this.prisma.client.chatMessage.create({
      data: {
        conversationId,
        senderUserId: actor.id,
        senderType: actor.roles.includes(RoleCode.ADMIN) ? ChatMessageSenderType.ADMIN : ChatMessageSenderType.SUPPORT_AGENT,
        messageType: ChatMessageType.INTERNAL_NOTE,
        visibleToUser: false,
        body: dto.note.trim(),
      },
    });
  }

  async updateConversation(actor: RequestUser, conversationId: string, dto: UpdateChatConversationDto) {
    await this.ensureStaffCanManage(actor, conversationId, { allowAdminSensitive: true });
    const existing = await this.prisma.client.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!existing) {
      throw new NotFoundException("Chat conversation not found.");
    }
    if (dto.sensitivity && dto.sensitivity !== existing.sensitivity && !actor.roles.includes(RoleCode.ADMIN)) {
      throw new ForbiddenException("Only admins can change chat sensitivity.");
    }

    const sensitiveUpgrade =
      existing.sensitivity === ChatConversationSensitivity.NORMAL &&
      dto.sensitivity &&
      dto.sensitivity !== ChatConversationSensitivity.NORMAL;
    const normalDowngrade =
      existing.sensitivity !== ChatConversationSensitivity.NORMAL &&
      dto.sensitivity === ChatConversationSensitivity.NORMAL;

    const shouldClose = dto.status ? terminalChatStatuses.has(dto.status) : false;
    const closeNote =
      dto.note?.trim() ||
      (shouldClose ? "This chat was closed. Start a new chat if you still need help." : null);

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const conversation = await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.priority ? { priority: dto.priority } : {}),
          ...(dto.topic ? { topic: dto.topic } : {}),
          ...(dto.sensitivity
            ? {
                sensitivity: dto.sensitivity,
                ...(sensitiveUpgrade ? { assignedToUserId: null } : {}),
                ...(normalDowngrade ? { assignedToUserId: existing.assignedToUserId } : {}),
              }
            : {}),
        },
      });
      if (shouldClose && !terminalChatStatuses.has(existing.status)) {
        await tx.chatMessage.create({
          data: {
            conversationId,
            senderUserId: actor.id,
            senderType: ChatMessageSenderType.SYSTEM,
            messageType: ChatMessageType.SYSTEM_EVENT,
            body: closeNote ?? "This chat was closed. Start a new chat if you still need help.",
          },
        });
      }
      await tx.chatConversationEvent.create({
        data: {
          conversationId,
          actorUserId: actor.id,
          eventType: "chat.conversation.updated",
          oldValue: {
            status: existing.status,
            priority: existing.priority,
            topic: existing.topic,
            sensitivity: existing.sensitivity,
            assignedToUserId: existing.assignedToUserId,
          },
          newValue: {
            status: dto.status ?? null,
            priority: dto.priority ?? null,
            topic: dto.topic ?? null,
            sensitivity: dto.sensitivity ?? null,
          },
          ...(closeNote ? { metadata: { note: closeNote } } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "chat.conversation.updated",
          entityType: "chat_conversation",
          entityId: conversationId,
          oldValue: {
            status: existing.status,
            priority: existing.priority,
            sensitivity: existing.sensitivity,
          },
          newValue: {
            status: conversation.status,
            priority: conversation.priority,
            sensitivity: conversation.sensitivity,
          },
        },
      });
      return conversation;
    });

    this.broadcast({
      type: sensitiveUpgrade ? "clear-thread" : "conversation",
      conversationId,
      payload: updated,
    });
    return updated;
  }

  async assign(actor: RequestUser, conversationId: string, dto: AssignChatDto) {
    if (!actor.roles.includes(RoleCode.ADMIN)) {
      throw new ForbiddenException("Only admins can assign or reassign chats.");
    }
    const updated = await this.prisma.client.$transaction(async (tx) => {
      const previous = await tx.chatConversation.findUniqueOrThrow({
        where: { id: conversationId },
        select: { assignedToUserId: true },
      });
      const conversation = await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          assignedToUserId: dto.assignedToUserId ?? null,
          ...(dto.assignedToUserId ? { status: ChatConversationStatus.IN_PROGRESS } : {}),
        },
      });
      await tx.chatAssignment.create({
        data: {
          conversationId,
          assignedToId: dto.assignedToUserId ?? null,
          createdById: actor.id,
          action: dto.assignedToUserId ? "ASSIGN" : "UNASSIGN",
          note: dto.note?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          action: "chat.assignment.updated",
          entityType: "chat_conversation",
          entityId: conversationId,
          oldValue: { assignedToUserId: previous.assignedToUserId },
          newValue: { assignedToUserId: dto.assignedToUserId ?? null },
        },
      });
      return conversation;
    });
    this.broadcast({ type: "conversation", conversationId, payload: updated });
    return updated;
  }

  async linkSupportRequest(actor: RequestUser, conversationId: string) {
    const conversation = await this.getStaff(actor, conversationId);
    if (conversation.supportRequestId) {
      return conversation;
    }
    const firstUserMessage = conversation.messages.find((message) => message.senderType === ChatMessageSenderType.USER);
    const supportRequest = await this.supportService.createPublicRequest(
      {
        name: conversation.user.fullName ?? conversation.user.email,
        email: conversation.user.email,
        topic: conversation.topic,
        requesterType: supportRequesterType(conversation.requesterType),
        preferredContactChannel: "EMAIL",
        subject: conversation.subject,
        message: firstUserMessage?.body ?? conversation.subject,
      },
      {
        id: conversation.user.id,
        clerkUserId: null,
        email: conversation.user.email,
        roles: [],
      },
      SupportRequestSource.API,
    );
    await this.prisma.client.chatConversation.update({
      where: { id: conversationId },
      data: { supportRequestId: supportRequest.id },
    });
    return this.getStaff(actor, conversationId);
  }

  async markRead(actor: RequestUser, conversationId: string, staff = false) {
    if (staff) {
      await this.ensureStaffCanManage(actor, conversationId);
      await this.prisma.client.chatConversation.update({
        where: { id: conversationId },
        data: { staffUnreadCount: 0 },
      });
    } else {
      const conversation = await this.getMine(actor, conversationId);
      await this.prisma.client.chatConversation.update({
        where: { id: conversation.id },
        data: { userUnreadCount: 0 },
      });
    }
    return { ok: true };
  }

  private staffWhere(actor: RequestUser, query: ChatConversationQueryDto): Prisma.ChatConversationWhereInput {
    const isAdmin = actor.roles.includes(RoleCode.ADMIN);
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.sensitivity ? { sensitivity: query.sensitivity } : {}),
      ...(query.requesterType ? { requesterType: query.requesterType } : {}),
      ...(query.assignment === "unassigned" ? { assignedToUserId: null } : {}),
      ...(query.assignment === "assigned" ? { assignedToUserId: { not: null } } : {}),
      ...(query.assignment === "mine" ? { assignedToUserId: actor.id } : {}),
      ...(!isAdmin
        ? {
            sensitivity: ChatConversationSensitivity.NORMAL,
            OR: [{ assignedToUserId: actor.id }, { assignedToUserId: null }],
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" } },
              { user: { email: { contains: query.search, mode: "insensitive" } } },
              { user: { fullName: { contains: query.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
  }

  private staffConversationWhere(actor: RequestUser, conversationId: string): Prisma.ChatConversationWhereInput {
    if (actor.roles.includes(RoleCode.ADMIN)) {
      return { id: conversationId };
    }
    this.requireSupportOrAdmin(actor);
    return {
      id: conversationId,
      sensitivity: ChatConversationSensitivity.NORMAL,
      OR: [{ assignedToUserId: actor.id }, { assignedToUserId: null }],
    };
  }

  private async ensureStaffCanReply(actor: RequestUser, conversationId: string) {
    const conversation = await this.prisma.client.chatConversation.findFirst({
      where: actor.roles.includes(RoleCode.ADMIN)
        ? { id: conversationId }
        : {
            id: conversationId,
            assignedToUserId: actor.id,
            sensitivity: ChatConversationSensitivity.NORMAL,
          },
      select: { id: true, status: true },
    });
    if (!conversation) {
      throw new ForbiddenException("You cannot reply to this chat.");
    }
    if (terminalChatStatuses.has(conversation.status)) {
      throw new BadRequestException("This chat is closed.");
    }
  }

  private async ensureStaffCanManage(
    actor: RequestUser,
    conversationId: string,
    options: { allowAdminSensitive?: boolean } = {},
  ) {
    const conversation = await this.prisma.client.chatConversation.findFirst({
      where:
        actor.roles.includes(RoleCode.ADMIN) && options.allowAdminSensitive
          ? { id: conversationId }
          : this.staffConversationWhere(actor, conversationId),
      select: { id: true },
    });
    if (!conversation) {
      throw new ForbiddenException("You cannot manage this chat.");
    }
  }

  private async supportContext(conversation: {
    orderId: string | null;
    productId: string | null;
    b2bEnquiryId: string | null;
    supportRequestId: string | null;
  }) {
    const [order, product, b2bEnquiry, supportRequest] = await Promise.all([
      conversation.orderId
        ? this.prisma.client.order.findUnique({
            where: { id: conversation.orderId },
            select: {
              orderNumber: true,
              orderStatus: true,
              paymentStatus: true,
              deliveryStatus: true,
              payments: {
                select: { provider: true, status: true, amountPaise: true, currency: true },
                where: { provider: { not: PaymentProvider.RAZORPAY } },
                take: 3,
              },
            },
          })
        : null,
      conversation.productId
        ? this.prisma.client.product.findUnique({
            where: { id: conversation.productId },
            select: {
              name: true,
              slug: true,
              status: true,
              approvalStatus: true,
              seller: { select: { storeName: true, status: true } },
            },
          })
        : null,
      conversation.b2bEnquiryId
        ? this.prisma.client.b2BEnquiry.findUnique({
            where: { id: conversation.b2bEnquiryId },
            select: { id: true, status: true, quantity: true, createdAt: true },
          })
        : null,
      conversation.supportRequestId
        ? this.prisma.client.supportRequest.findUnique({
            where: { id: conversation.supportRequestId },
            select: { id: true, status: true, subject: true, createdAt: true },
          })
        : null,
    ]);

    return { order, product, b2bEnquiry, supportRequest };
  }

  private async buildGuidedActionResponse(
    actor: RequestUser,
    action: string,
    selectedValue?: string,
  ): Promise<GuidedActionResponse> {
    if (action === "track_order") {
      if (selectedValue) {
        return this.buildOrderStatusResponse(actor, selectedValue);
      }
      return this.buildOrderListResponse(actor, "Select an order to view its live status.");
    }

    if (action === "cancel_or_change_order") {
      if (selectedValue) {
        return this.buildOrderStatusResponse(actor, selectedValue, {
          lead: "Here is the current order state before you request a change or cancellation.",
          nextActions: ["Open order details", "Talk to staff"],
        });
      }
      return this.buildOrderListResponse(actor, "Select the order you want to cancel or change.");
    }

    if (action === "wrong_or_missing_item") {
      if (selectedValue) {
        return this.buildOrderStatusResponse(actor, selectedValue, {
          lead: "Here is the order linked to your item issue. Share which item is wrong or missing.",
          nextActions: ["Talk to staff"],
        });
      }
      return this.buildOrderListResponse(actor, "Select the order with the wrong or missing item.");
    }

    return {
      body: guidedActionFallback(action),
      metadata: {
        kind: "guided_text",
        action,
        actions: ["Talk to staff"],
      },
    };
  }

  private async buildOrderListResponse(actor: RequestUser, body: string): Promise<GuidedActionResponse> {
    const orders = await this.prisma.client.order.findMany({
      where: { customer: { userId: actor.id } },
      select: {
        orderNumber: true,
        orderStatus: true,
        paymentStatus: true,
        deliveryStatus: true,
        totalPaise: true,
        currency: true,
        createdAt: true,
        items: {
          select: { productNameSnapshot: true, quantity: true },
          take: 2,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    if (!orders.length) {
      return {
        body: "I could not find any orders on your account yet.",
        metadata: {
          kind: "empty_state",
          action: "track_order",
          actions: ["Browse products", "Talk to staff"],
        },
      };
    }

    return {
      body,
      metadata: {
        kind: "order_picker",
        action: "track_order",
        orders: orders.map((order) => this.chatOrderSummary(order)),
      },
    };
  }

  private async buildOrderStatusResponse(
    actor: RequestUser,
    orderNumber: string,
    options: { lead?: string; nextActions?: string[] } = {},
  ): Promise<GuidedActionResponse> {
    const order = await this.prisma.client.order.findFirst({
      where: { orderNumber: orderNumber.trim().toUpperCase(), customer: { userId: actor.id } },
      select: {
        orderNumber: true,
        orderStatus: true,
        paymentStatus: true,
        deliveryStatus: true,
        totalPaise: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: { productNameSnapshot: true, quantity: true },
          take: 3,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return {
        body: "I could not find that order on your account.",
        metadata: {
          kind: "empty_state",
          action: "track_order",
          actions: ["Track my order", "Talk to staff"],
        },
      };
    }

    const summary = this.chatOrderSummary(order);
    return {
      body:
        options.lead ??
        `Order ${summary.orderNumber} is ${humanize(summary.orderStatus)}. Delivery is ${humanize(summary.deliveryStatus)} and payment is ${humanize(summary.paymentStatus)}.`,
      metadata: {
        kind: "order_status",
        action: "track_order",
        order: summary,
        actions: options.nextActions ?? ["Open order details", "Talk to staff"],
      },
    };
  }

  private chatOrderSummary(order: {
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    deliveryStatus: string;
    totalPaise: number;
    currency: string;
    createdAt: Date;
    updatedAt?: Date;
    items: Array<{ productNameSnapshot: string; quantity: number }>;
  }) {
    return {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      deliveryStatus: order.deliveryStatus,
      totalPaise: order.totalPaise,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      ...(order.updatedAt ? { updatedAt: order.updatedAt.toISOString() } : {}),
      items: order.items.map((item) => ({
        name: item.productNameSnapshot,
        quantity: item.quantity,
      })),
    };
  }

  private conversationInclude(includeMessages: boolean) {
    return {
      user: { select: { id: true, email: true, fullName: true, phone: true } },
      assignedTo: { select: { id: true, email: true, fullName: true } },
      ...(includeMessages
        ? {
            messages: {
              orderBy: { createdAt: "asc" as const },
              take: 200,
              select: {
                id: true,
                conversationId: true,
                senderUserId: true,
                senderType: true,
                messageType: true,
                body: true,
                visibleToUser: true,
                metadata: true,
                createdAt: true,
              },
            },
          }
        : {}),
    };
  }

  private async checkLimit(userId: string, action: ChatRateLimitAction, window: "minute" | "day", max: number) {
    const now = new Date();
    const bucketKey = window === "minute" ? minuteBucket(now) : dayBucket(now);
    const expiresAt = window === "minute" ? addMinutes(now, 2) : addDays(now, 2);
    const bucket = await this.prisma.client.chatRateLimitBucket.upsert({
      where: {
        scopeKey_action_bucketKey: {
          scopeKey: userId,
          action,
          bucketKey,
        },
      },
      update: { count: { increment: 1 }, expiresAt },
      create: { scopeKey: userId, action, bucketKey, count: 1, expiresAt },
    });
    if (bucket.count > max) {
      throw new HttpException("Too many chat actions. Please wait and try again.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private requireSupportOrAdmin(actor: RequestUser) {
    if (!actor.roles.includes(RoleCode.ADMIN) && !actor.roles.includes(RoleCode.CHAT_SUPPORT)) {
      throw new ForbiddenException("Chat support access is required.");
    }
  }

  private async ensureChatEnabled() {
    const config = await this.settingsService.getChatSupportConfig();
    if (!config.enabled) {
      throw new BadRequestException("Chat support is currently disabled.");
    }
  }

  private broadcast(event: ChatEventPayload) {
    this.broadcaster?.(event);
  }
}

function guidedReply(topic: string, _requesterType: string) {
  return `I can help with ${humanize(topic)}. Choose a guided option or select talk to staff for a support agent.`;
}

function normalizeGuidedAction(action: string) {
  const normalized = action
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const aliases: Record<string, string> = {
    track_my_order: "track_order",
    cancel_or_change_order: "cancel_or_change_order",
    wrong_or_missing_item: "wrong_or_missing_item",
  };
  return aliases[normalized] ?? normalized;
}

function guidedActionFallback(action: string) {
  const copy: Record<string, string> = {
    payment_failed: "For payment failures, check whether the amount was deducted. If it was deducted and the order is not paid, share the payment reference with staff.",
    refund_status: "Refund timelines depend on the payment provider and bank. Select talk to staff if you want us to check a specific payment.",
    cod_or_bank_transfer_help: "For COD or bank transfer help, keep the UTR/reference ready so finance support can verify faster.",
    delivery_delayed: "Delivery delays can happen after dispatch or failed attempts. Share your order number or select track order for the latest status.",
    change_delivery_address: "Delivery address changes are only possible before dispatch and may depend on seller/courier readiness.",
    courier_tracking_help: "Use track order for the latest delivery status. If the courier status looks wrong, talk to staff.",
    account_help: "For account help, describe the login, profile, or address issue and our support team can assist.",
    policy_question: "For policy questions, mention the order/product context if available so support can answer accurately.",
    report_an_issue: "Please describe the issue in one short message. You can also talk to staff for direct support.",
  };
  return copy[action] ?? "I can help with this. Select talk to staff if you want a support agent to continue.";
}

function intentsForRequester(requesterType: string) {
  const common = ["talk_to_staff"];
  if (requesterType === "SELLER") {
    return ["seller_onboarding", "product_listing", "seller_orders", "seller_payouts", "seller_subscriptions", ...common];
  }
  if (requesterType === "BUSINESS_BUYER") {
    return ["quotation", "enquiry_status", "company_profile", "bulk_order", ...common];
  }
  if (requesterType === "DELIVERY_PARTNER") {
    return ["pickup_issue", "route_address_issue", "customer_unavailable", "cod_mismatch", "delivery_status", "pod_guidance", ...common];
  }
  return ["order", "payment", "delivery", "return_refund", "account", ...common];
}

function supportRequesterType(requesterType: string) {
  if (requesterType === "SELLER") return "SELLER";
  if (requesterType === "BUSINESS_BUYER") return "BUSINESS_BUYER";
  if (requesterType === "DELIVERY_PARTNER") return "DELIVERY_PARTNER";
  return "CUSTOMER";
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86_400_000);
}

function addYears(value: Date, years: number) {
  const next = new Date(value);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function minuteBucket(value: Date) {
  return value.toISOString().slice(0, 16);
}

function dayBucket(value: Date) {
  return value.toISOString().slice(0, 10);
}

function humanize(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}
