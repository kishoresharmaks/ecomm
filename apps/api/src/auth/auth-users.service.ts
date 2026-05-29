import { Inject, Injectable } from "@nestjs/common";
import { EmailRecipientType, RoleCode, UserStatus } from "@indihub/database";
import { EMAIL_TRIGGER_EVENTS } from "../notifications/email-trigger-catalog";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { SyncAuthUserDto } from "./dto/sync-auth-user.dto";

@Injectable()
export class AuthUsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  async syncAuthUser(dto: SyncAuthUserDto) {
    const roleCode = dto.defaultRole ?? RoleCode.CUSTOMER;

    const result = await this.prisma.client.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: {
          OR: [{ clerkUserId: dto.clerkUserId }, { email: dto.email }],
        },
      });

      const user = existingUser
        ? await tx.user.update({
            where: {
              id: existingUser.id,
            },
            data: {
              clerkUserId: dto.clerkUserId,
              email: dto.email,
              phone: dto.phone ?? null,
              fullName: dto.fullName ?? null,
              status: UserStatus.ACTIVE,
            },
          })
        : await tx.user.create({
            data: {
              clerkUserId: dto.clerkUserId,
              email: dto.email,
              phone: dto.phone ?? null,
              fullName: dto.fullName ?? null,
              status: UserStatus.ACTIVE,
            },
          });

      const role = await tx.role.upsert({
        where: { code: roleCode },
        update: {},
        create: {
          code: roleCode,
          name: this.roleName(roleCode),
          description: this.roleDescription(roleCode),
        },
      });

      await tx.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
        },
      });

      if (roleCode === RoleCode.CUSTOMER) {
        const customer = await tx.customer.upsert({
          where: {
            userId: user.id,
          },
          update: {
            displayName: dto.fullName ?? user.email,
            status: UserStatus.ACTIVE,
          },
          create: {
            userId: user.id,
            displayName: dto.fullName ?? user.email,
            status: UserStatus.ACTIVE,
          },
        });

        await tx.wishlist.upsert({
          where: {
            customerId: customer.id,
          },
          update: {},
          create: {
            customerId: customer.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: existingUser ? "auth.user.synced" : "auth.user.created",
          entityType: "user",
          entityId: user.id,
          newValue: {
            clerkUserId: user.clerkUserId,
            email: user.email,
            roleCode,
          },
        },
      });

      const userRoles = await tx.userRole.findMany({
        where: { userId: user.id },
        include: { role: true },
      });

      return {
        isNew: !existingUser,
        id: user.id,
        clerkUserId: user.clerkUserId,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
        roles: userRoles.map((userRole) => userRole.role.code),
      };
    });

    if (result.isNew && roleCode === RoleCode.CUSTOMER) {
      await this.notifications.notifyEvent({
        eventCode: EMAIL_TRIGGER_EVENTS.CUSTOMER_REGISTERED,
        recipientType: EmailRecipientType.CUSTOMER,
        recipient: result.email,
        userId: result.id,
        variables: {
          customerName: result.fullName ?? result.email,
        },
      });
    }

    const { isNew, ...response } = result;
    void isNew;
    return response;
  }

  private roleName(roleCode: RoleCode) {
    return roleCode
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private roleDescription(roleCode: RoleCode) {
    switch (roleCode) {
      case RoleCode.ADMIN:
        return "Platform admin and operations team.";
      case RoleCode.SELLER:
        return "Vendor, nearby store, or local shop.";
      case RoleCode.BUSINESS_BUYER:
        return "B2B buyer account for enquiries.";
      case RoleCode.CUSTOMER:
        return "B2C buyer account.";
      default:
        return "Operational platform role.";
    }
  }
}
