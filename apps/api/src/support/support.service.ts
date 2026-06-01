import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EmailRecipientType, Prisma, SupportRequestStatus } from "@indihub/database";
import type { RequestUser } from "../auth/types/indihub-request";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
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

  async createPublicRequest(dto: CreateSupportRequestDto, actor?: RequestUser) {
    const supportRequest = await this.prisma.client.supportRequest.create({
      data: {
        userId: actor?.id ?? null,
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        subject: dto.subject,
        message: dto.message,
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
        },
      }),
      this.notifications.notifyAdminEvent(EMAIL_TRIGGER_EVENTS.SUPPORT_REQUEST_ADMIN_ALERT, {
        name: supportRequest.name,
        email: supportRequest.email,
        subject: supportRequest.subject,
        requestId: supportRequest.id,
      }),
    ]);

    return supportRequest;
  }

  async listAdminRequests(query: SupportRequestQueryDto) {
    const where: Prisma.SupportRequestWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { subject: { contains: query.search, mode: "insensitive" } },
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

  async updateRequest(actor: RequestUser, requestId: string, dto: UpdateSupportRequestDto) {
    const existing = await this.getRequestOrThrow(requestId);
    const supportRequest = await this.prisma.client.supportRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote ?? null } : {}),
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
        },
        newValue: {
          status: supportRequest.status,
          adminNote: supportRequest.adminNote,
        },
      },
    });

    return supportRequest;
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
