import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  EmailRecipientType,
  Prisma,
  RoleCode,
  SupportContactChannel as DbSupportContactChannel,
  SupportRequesterType as DbSupportRequesterType,
  SupportRequestSource,
  SupportRequestStatus,
  SupportRequestTopic as DbSupportRequestTopic,
} from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  AuthenticatedSupportRequestDto,
  CreateSupportRequestDto,
  SupportRequestQueryDto,
  UpdateSupportRequestDto,
} from "./dto/support-request.dto";

@Injectable()
export class SupportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async createPublicRequest(
    dto: CreateSupportRequestDto,
    actor?: RequestUser,
    source: SupportRequestSource = SupportRequestSource.WEB_CONTACT,
  ) {
    const supportRequest = await this.prisma.client.supportRequest.create({
      data: {
        userId: actor?.id ?? null,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: trimOrNull(dto.phone),
        topic: dto.topic as DbSupportRequestTopic,
        requesterType: dto.requesterType as DbSupportRequesterType,
        preferredContactChannel: dto.preferredContactChannel as DbSupportContactChannel,
        source,
        orderNumber: trimOrNull(dto.orderNumber),
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        status: SupportRequestStatus.OPEN,
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        ...(actor?.id ? { actor: { connect: { id: actor.id } } } : {}),
        action: "support.request.created",
        entityType: "support_request",
        entityId: supportRequest.id,
        newValue: {
          subject: supportRequest.subject,
          email: supportRequest.email,
          status: supportRequest.status,
          topic: supportRequest.topic,
          requesterType: supportRequest.requesterType,
          source: supportRequest.source,
          orderNumber: supportRequest.orderNumber,
        },
      },
    });

    await Promise.all([
      this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.SUPPORT_REQUEST_RECEIVED,
        recipientType: EmailRecipientType.SUPPORT_REQUESTER,
        recipient: supportRequest.email,
        userId: supportRequest.userId,
        variables: {
          name: supportRequest.name,
          subject: supportRequest.subject,
          requestId: supportRequest.id,
          topic: supportRequest.topic,
          orderNumber: supportRequest.orderNumber ?? "",
        },
      }),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.SUPPORT_REQUEST_ADMIN_ALERT, {
        name: supportRequest.name,
        email: supportRequest.email,
        subject: supportRequest.subject,
        requestId: supportRequest.id,
        topic: supportRequest.topic,
        requesterType: supportRequest.requesterType,
        orderNumber: supportRequest.orderNumber ?? "",
      }),
    ]);

    return supportRequest;
  }

  async createAuthenticatedRequest(actor: RequestUser, dto: AuthenticatedSupportRequestDto) {
    const profile = await this.prisma.client.user.findUnique({
      where: { id: actor.id },
      select: {
        email: true,
        phone: true,
        fullName: true,
        customer: {
          select: {
            displayName: true,
          },
        },
      },
    });
    const email = trimOrNull(dto.email) ?? profile?.email ?? actor.email;
    if (!email) {
      throw new BadRequestException("Authenticated support request requires an account email.");
    }
    const phone = trimOrNull(dto.phone) ?? trimOrNull(profile?.phone);
    const orderNumber = trimOrNull(dto.orderNumber);

    const createDto: CreateSupportRequestDto = {
      name:
        trimOrNull(dto.name) ??
        profile?.fullName?.trim() ??
        profile?.customer?.displayName?.trim() ??
        email,
      email,
      ...(phone ? { phone } : {}),
      topic: dto.topic,
      requesterType: (dto.requesterType ?? this.requesterTypeFromRoles(actor.roles)) as CreateSupportRequestDto["requesterType"],
      preferredContactChannel: dto.preferredContactChannel,
      subject: dto.subject,
      ...(orderNumber ? { orderNumber } : {}),
      message: dto.message,
    };

    return this.createPublicRequest(createDto, actor, SupportRequestSource.WEB_ACCOUNT_SUPPORT);
  }

  async listAdminRequests(query: SupportRequestQueryDto) {
    const where: Prisma.SupportRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.topic ? { topic: query.topic as DbSupportRequestTopic } : {}),
      ...(query.requesterType ? { requesterType: query.requesterType as DbSupportRequesterType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { subject: { contains: query.search, mode: "insensitive" } },
              { message: { contains: query.search, mode: "insensitive" } },
              { orderNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.client.supportRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async listCustomerRequests(actor: RequestUser, query: SupportRequestQueryDto) {
    const where: Prisma.SupportRequestWhereInput = {
      userId: actor.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.topic ? { topic: query.topic as DbSupportRequestTopic } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: "insensitive" } },
              { message: { contains: query.search, mode: "insensitive" } },
              { orderNumber: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.client.supportRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async updateRequest(actor: RequestUser, requestId: string, dto: UpdateSupportRequestDto) {
    const existing = await this.getRequestOrThrow(requestId);
    const responseMessage = trimOrNull(dto.responseMessage);
    const shouldSendRequesterResponse =
      dto.status === SupportRequestStatus.RESPONDED &&
      Boolean(responseMessage) &&
      !existing.respondedAt &&
      !existing.responseMessage?.trim();
    const supportRequest = await this.prisma.client.supportRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote ?? null } : {}),
        ...(dto.responseMessage !== undefined ? { responseMessage } : {}),
        ...(shouldSendRequesterResponse ? { respondedAt: new Date() } : {}),
      },
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "support.request.updated",
        entityType: "support_request",
        entityId: supportRequest.id,
        oldValue: {
          status: existing.status,
          adminNote: existing.adminNote,
          responseMessage: existing.responseMessage,
          respondedAt: existing.respondedAt?.toISOString() ?? null,
        },
        newValue: {
          status: supportRequest.status,
          adminNote: supportRequest.adminNote,
          responseMessage: supportRequest.responseMessage,
          respondedAt: supportRequest.respondedAt?.toISOString() ?? null,
        },
      },
    });

    if (shouldSendRequesterResponse && responseMessage) {
      await this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.SUPPORT_REQUEST_RESPONDED,
        recipientType: EmailRecipientType.SUPPORT_REQUESTER,
        recipient: supportRequest.email,
        userId: supportRequest.userId,
        variables: {
          name: supportRequest.name,
          subject: supportRequest.subject,
          requestId: supportRequest.id,
          responseMessage,
        },
      });
    }

    return supportRequest;
  }

  private requesterTypeFromRoles(roles: RoleCode[]) {
    if (roles.includes(RoleCode.BUSINESS_BUYER)) {
      return DbSupportRequesterType.BUSINESS_BUYER;
    }
    if (roles.includes(RoleCode.SELLER)) {
      return DbSupportRequesterType.SELLER;
    }
    if (roles.includes(RoleCode.DELIVERY_PARTNER)) {
      return DbSupportRequesterType.DELIVERY_PARTNER;
    }
    return DbSupportRequesterType.CUSTOMER;
  }

  private async getRequestOrThrow(requestId: string) {
    const supportRequest = await this.prisma.client.supportRequest.findUnique({
      where: { id: requestId },
    });
    if (!supportRequest) {
      throw new NotFoundException("Support request not found.");
    }
    return supportRequest;
  }
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
