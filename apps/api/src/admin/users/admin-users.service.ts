import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  CodCollectionStatus,
  DeliveryAssignmentStatus,
  DeliveryPartnerPayoutStatus,
  DeliveryStatus,
  Prisma,
  RoleCode,
  SellerOrderStatus,
  SellerPayoutStatus,
  SellerStatus,
  UserStatus,
} from "@indihub/database";
import { hashAdminPassword } from "../../auth/admin-password";
import type { RequestUser } from "../../auth/types/indihub-request";
import { paginationFromQuery } from "../../common/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AdminUserQueryDto,
  SetBackOfficePasswordDto,
  UpdateDeliveryPartnerProfileDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from "./dto/admin-user.dto";

const userInclude = {
  userRoles: {
    include: {
      role: true
    }
  },
  customer: true,
  seller: true,
  businessBuyer: true,
  deliveryProfile: true
};

type AdminUserWithProfiles = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const backOfficeRoleCodes = new Set<RoleCode>([
  RoleCode.ADMIN,
  RoleCode.FINANCE,
  RoleCode.COURIER_MANAGER,
]);

const activeSellerOrderStatuses = [
  SellerOrderStatus.PENDING,
  SellerOrderStatus.ACCEPTED,
  SellerOrderStatus.PROCESSING,
  SellerOrderStatus.DISPATCHED,
] as const;

const openSellerPayoutStatuses = [
  SellerPayoutStatus.DRAFT,
  SellerPayoutStatus.PENDING_APPROVAL,
  SellerPayoutStatus.APPROVED,
  SellerPayoutStatus.HELD,
] as const;

const activeDeliveryAssignmentStatuses = [
  DeliveryAssignmentStatus.ASSIGNED,
  DeliveryAssignmentStatus.ACCEPTED,
] as const;

const activeDeliveryStatuses = [
  DeliveryStatus.PENDING,
  DeliveryStatus.PACKED,
  DeliveryStatus.DISPATCHED,
  DeliveryStatus.IN_TRANSIT,
] as const;

const openDeliveryPayoutStatuses = [
  DeliveryPartnerPayoutStatus.REQUESTED,
  DeliveryPartnerPayoutStatus.APPROVED,
] as const;

type AdminUsersDbClient = PrismaService["client"] | Prisma.TransactionClient;

export type RoleRemovalImpact = {
  userId: string;
  roleCode: RoleCode;
  canRemove: boolean;
  noteRequired: boolean;
  affectedProfile: "CUSTOMER" | "SELLER" | "BUSINESS_BUYER" | "DELIVERY_PARTNER" | "BACK_OFFICE" | null;
  blockers: string[];
  warnings: string[];
  cleanupActions: string[];
  associatedCounts: Record<string, number>;
};

@Injectable()
export class AdminUsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUsers(query: AdminUserQueryDto) {
    const { page, skip, take } = paginationFromQuery(query);
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.roleCode ? { userRoles: { some: { role: { code: query.roleCode } } } } : {}),
      ...this.profileWhere(query.profile),
      ...(query.search
        ? {
            OR: [
              { email: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { fullName: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total] = await this.prisma.client.$transaction(async (tx) => {
      const items = await tx.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take
      });
      const total = await tx.user.count({ where });

      return [items, total] as const;
    });

    return { items, total, page, limit: take };
  }

  async getUser(userId: string) {
    return this.getUserOrThrow(userId);
  }

  async updateStatus(actor: RequestUser, userId: string, dto: UpdateUserStatusDto) {
    const existing = await this.getUserOrThrow(userId);

    if (existing.id === actor.id && dto.status !== UserStatus.ACTIVE) {
      throw new BadRequestException("Admin cannot disable their own active account.");
    }

    if (existing.userRoles.some((userRole) => userRole.role.code === RoleCode.ADMIN) && dto.status !== UserStatus.ACTIVE) {
      await this.ensureAnotherActiveAdmin(existing.id);
    }

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { status: dto.status },
      include: userInclude
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.status_updated",
        entityType: "user",
        entityId: user.id,
        oldValue: { status: existing.status },
        newValue: { status: user.status, note: dto.note }
      }
    });

    return user;
  }

  async addRole(actor: RequestUser, userId: string, dto: UpdateUserRoleDto) {
    const user = await this.getUserOrThrow(userId);
    const role = await this.prisma.client.role.upsert({
      where: { code: dto.roleCode },
      update: {},
      create: {
        code: dto.roleCode,
        name: this.roleName(dto.roleCode),
        description: "Admin-created platform role."
      }
    });

    await this.prisma.client.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id
        }
      },
      update: {},
      create: {
        userId,
        roleId: role.id
      }
    });

    if (dto.roleCode === RoleCode.DELIVERY_PARTNER) {
      await this.prisma.client.deliveryPartnerProfile.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          phone: user.phone,
          isAvailable: true,
        },
      });
    }

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.role_added",
        entityType: "user",
        entityId: user.id,
        oldValue: { roles: user.userRoles.map((userRole) => userRole.role.code) },
        newValue: { addedRole: dto.roleCode, note: dto.note }
      }
    });

    return this.getUserOrThrow(userId);
  }

  async getRoleRemovalImpact(
    actor: RequestUser,
    userId: string,
    roleCode: RoleCode,
  ): Promise<RoleRemovalImpact> {
    this.assertValidRoleCode(roleCode);
    const user = await this.getUserOrThrow(userId);
    const role = await this.prisma.client.role.findUnique({ where: { code: roleCode } });

    if (!role) {
      throw new NotFoundException("Role not found.");
    }

    return this.buildRoleRemovalImpact(this.prisma.client, actor, user, roleCode, role.id);
  }

  async removeRole(actor: RequestUser, userId: string, dto: UpdateUserRoleDto) {
    this.assertValidRoleCode(dto.roleCode);

    return this.prisma.client.$transaction(async (tx) => {
      const user = await this.getUserOrThrow(userId, tx);
      const role = await tx.role.findUnique({ where: { code: dto.roleCode } });

      if (!role) {
        throw new NotFoundException("Role not found.");
      }

      const impact = await this.buildRoleRemovalImpact(tx, actor, user, dto.roleCode, role.id);
      if (!impact.canRemove) {
        throw new BadRequestException(impact.blockers.join(" "));
      }

      const note = dto.note?.trim() ?? "";
      if (impact.noteRequired && !note) {
        throw new BadRequestException(
          "Admin note is required when removing a role with associated data or cleanup actions.",
        );
      }

      await this.applyRoleRemovalCleanup(tx, user, dto.roleCode);

      await tx.userRole.deleteMany({
        where: {
          userId,
          roleId: role.id
        }
      });

      await tx.auditLog.create({
        data: {
          actor: { connect: { id: actor.id } },
          action: "admin.user.role_removed",
          entityType: "user",
          entityId: user.id,
          oldValue: { roles: user.userRoles.map((userRole) => userRole.role.code) },
          newValue: {
            removedRole: dto.roleCode,
            note,
            cleanupActions: impact.cleanupActions,
            associatedCounts: impact.associatedCounts,
            warnings: impact.warnings,
          }
        }
      });

      return this.getUserOrThrow(userId, tx);
    });
  }

  async setBackOfficePassword(actor: RequestUser, userId: string, dto: SetBackOfficePasswordDto) {
    const user = await this.getUserOrThrow(userId);
    const canUseBackOffice = user.userRoles.some((userRole) =>
      backOfficeRoleCodes.has(userRole.role.code),
    );

    if (!canUseBackOffice) {
      throw new BadRequestException("Assign Admin, Finance Manager, or Courier Manager role before setting a back-office password.");
    }

    const hashed = await hashAdminPassword(dto.password);
    await this.prisma.client.adminCredential.upsert({
      where: { userId },
      update: {
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt",
        passwordUpdatedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null
      },
      create: {
        userId,
        passwordHash: hashed.hash,
        passwordSalt: hashed.salt,
        passwordAlgorithm: "scrypt"
      }
    });

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.user.backoffice_password_set",
        entityType: "user",
        entityId: user.id,
        newValue: {
          roles: user.userRoles.map((userRole) => userRole.role.code),
          note: dto.note ?? null
        }
      }
    });

    return { updated: true, userId };
  }

  async updateDeliveryPartnerProfile(
    actor: RequestUser,
    userId: string,
    dto: UpdateDeliveryPartnerProfileDto
  ) {
    const user = await this.getUserOrThrow(userId);
    const isDeliveryPartner = user.userRoles.some(
      (userRole) => userRole.role.code === RoleCode.DELIVERY_PARTNER
    );

    if (!isDeliveryPartner) {
      throw new BadRequestException("Assign Delivery Partner role before editing delivery profile.");
    }

    const profileData = this.deliveryProfileData(dto);
    const profile = await this.prisma.client.deliveryPartnerProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        phone: dto.phone ?? user.phone,
        isAvailable: dto.isAvailable === undefined ? true : this.booleanValue(dto.isAvailable),
        ...profileData,
      },
    });

    if (dto.phone !== undefined && dto.phone !== user.phone) {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { phone: dto.phone || null },
      });
    }

    await this.prisma.client.auditLog.create({
      data: {
        actor: { connect: { id: actor.id } },
        action: "admin.delivery_partner.profile_updated",
        entityType: "user",
        entityId: userId,
        ...(user.deliveryProfile
          ? { oldValue: this.deliveryProfileAuditValue(user.deliveryProfile) }
          : {}),
        newValue: this.deliveryProfileAuditValue(profile),
      },
    });

    return this.getUserOrThrow(userId);
  }

  private async getUserOrThrow(userId: string, db: AdminUsersDbClient = this.prisma.client) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: userInclude
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    return user;
  }

  private async ensureAnotherActiveAdmin(excludedUserId: string) {
    const otherAdminCount = await this.prisma.client.user.count({
      where: {
        id: { not: excludedUserId },
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: { code: RoleCode.ADMIN }
          }
        }
      }
    });

    if (otherAdminCount === 0) {
      throw new BadRequestException("At least one other active admin must remain.");
    }
  }

  private async buildRoleRemovalImpact(
    db: AdminUsersDbClient,
    actor: RequestUser,
    user: AdminUserWithProfiles,
    roleCode: RoleCode,
    roleId: string,
  ): Promise<RoleRemovalImpact> {
    const associatedCounts: Record<string, number> = {};
    const blockers: string[] = [];
    const warnings: string[] = [];
    const cleanupActions: string[] = [];
    let affectedProfile: RoleRemovalImpact["affectedProfile"] = null;

    const roleAssigned = user.userRoles.some((userRole) => userRole.role.code === roleCode);
    if (!roleAssigned) {
      blockers.push(`${this.roleName(roleCode)} role is not assigned to this user.`);
    }

    if (roleCode === RoleCode.ADMIN) {
      affectedProfile = "BACK_OFFICE";
      if (user.id === actor.id) {
        blockers.push("Admin cannot remove their own admin role.");
      }
      const otherAdminCount = await db.user.count({
        where: {
          id: { not: user.id },
          status: UserStatus.ACTIVE,
          userRoles: {
            some: {
              role: { code: RoleCode.ADMIN }
            }
          }
        }
      });
      if (otherAdminCount === 0) {
        blockers.push("At least one other active admin must remain.");
      }
    }

    if (roleCode === RoleCode.SELLER && user.seller) {
      affectedProfile = "SELLER";
      const sellerId = user.seller.id;
      const [products, orderSplits, activeOrders, openPayouts, ledgerEntries] = await Promise.all([
        db.product.count({ where: { sellerId } }),
        db.orderSellerSplit.count({ where: { sellerId } }),
        db.orderSellerSplit.count({
          where: { sellerId, sellerStatus: { in: [...activeSellerOrderStatuses] } },
        }),
        db.sellerPayout.count({
          where: { sellerId, status: { in: [...openSellerPayoutStatuses] } },
        }),
        db.sellerLedgerEntry.count({ where: { sellerId } }),
      ]);
      associatedCounts.products = products;
      associatedCounts.orderSplits = orderSplits;
      associatedCounts.activeSellerOrders = activeOrders;
      associatedCounts.openSellerPayouts = openPayouts;
      associatedCounts.sellerLedgerEntries = ledgerEntries;
      cleanupActions.push("Seller profile will be suspended. Products, orders, payouts, and ledger history remain preserved.");
      warnings.push("Seller access will be removed and the seller store will stop operating until restored by admin.");
      if (activeOrders > 0) {
        blockers.push("Resolve active seller orders before removing Seller role.");
      }
      if (openPayouts > 0) {
        blockers.push("Resolve open seller payouts before removing Seller role.");
      }
    }

    if (roleCode === RoleCode.DELIVERY_PARTNER) {
      affectedProfile = "DELIVERY_PARTNER";
      const [
        activeDeliveryDetails,
        activeShipments,
        unverifiedDeliveryCod,
        unverifiedShipmentCod,
        openPayouts,
        walletEntries,
      ] = await Promise.all([
        db.deliveryDetail.count({
          where: {
            deliveryPartnerUserId: user.id,
            assignmentStatus: { in: [...activeDeliveryAssignmentStatuses] },
            status: { in: [...activeDeliveryStatuses] },
          },
        }),
        db.orderShipment.count({
          where: {
            deliveryPartnerUserId: user.id,
            assignmentStatus: { in: [...activeDeliveryAssignmentStatuses] },
            status: { in: [...activeDeliveryStatuses] },
          },
        }),
        db.deliveryDetail.count({
          where: {
            codCollectionStatus: CodCollectionStatus.COLLECTED,
            OR: [{ codCollectedById: user.id }, { deliveryPartnerUserId: user.id }],
          },
        }),
        db.orderShipment.count({
          where: {
            codCollectionStatus: CodCollectionStatus.COLLECTED,
            OR: [{ codCollectedById: user.id }, { deliveryPartnerUserId: user.id }],
          },
        }),
        db.deliveryPartnerPayout.count({
          where: {
            partnerUserId: user.id,
            status: { in: [...openDeliveryPayoutStatuses] },
          },
        }),
        db.deliveryPartnerWalletEntry.count({ where: { partnerUserId: user.id } }),
      ]);
      associatedCounts.activeDeliveryDetails = activeDeliveryDetails;
      associatedCounts.activeOrderShipments = activeShipments;
      associatedCounts.unverifiedDeliveryCodCollections = unverifiedDeliveryCod;
      associatedCounts.unverifiedShipmentCodCollections = unverifiedShipmentCod;
      associatedCounts.openDeliveryPartnerPayouts = openPayouts;
      associatedCounts.deliveryPartnerWalletEntries = walletEntries;
      cleanupActions.push("Delivery partner profile will be marked unavailable. Wallet, COD, payout, and delivery history remain preserved.");
      warnings.push("Partner will lose delivery workspace access after the role is removed.");
      if (activeDeliveryDetails + activeShipments > 0) {
        blockers.push("Reassign or complete active assigned deliveries before removing Delivery Partner role.");
      }
      if (unverifiedDeliveryCod + unverifiedShipmentCod > 0) {
        blockers.push("Verify or reject pending COD cash collections before removing Delivery Partner role.");
      }
      if (openPayouts > 0) {
        blockers.push("Resolve requested or approved delivery partner payouts before removing Delivery Partner role.");
      }
    }

    if (roleCode === RoleCode.BUSINESS_BUYER && user.businessBuyer) {
      affectedProfile = "BUSINESS_BUYER";
      const [addresses, enquiries] = await Promise.all([
        db.businessBuyerAddress.count({ where: { businessBuyerId: user.businessBuyer.id } }),
        db.b2BEnquiry.count({ where: { businessBuyerId: user.businessBuyer.id } }),
      ]);
      associatedCounts.businessBuyerAddresses = addresses;
      associatedCounts.b2bEnquiries = enquiries;
      cleanupActions.push("Business buyer profile will be disabled. Enquiries and quotation history remain preserved.");
      warnings.push("B2B buyer portal access will be removed until the role is restored.");
    }

    if (roleCode === RoleCode.CUSTOMER && user.customer) {
      affectedProfile = "CUSTOMER";
      const [addresses, orders] = await Promise.all([
        db.customerAddress.count({ where: { customerId: user.customer.id } }),
        db.order.count({ where: { customerId: user.customer.id } }),
      ]);
      associatedCounts.customerAddresses = addresses;
      associatedCounts.customerOrders = orders;
      warnings.push("Customer profile, addresses, orders, wishlist, and support history remain preserved.");
    }

    if (backOfficeRoleCodes.has(roleCode)) {
      affectedProfile = affectedProfile ?? "BACK_OFFICE";
      const remainingBackOfficeRoles = user.userRoles.filter(
        (userRole) => userRole.role.id !== roleId && backOfficeRoleCodes.has(userRole.role.code),
      );
      if (remainingBackOfficeRoles.length === 0) {
        const [credentialCount, activeSessionCount] = await Promise.all([
          db.adminCredential.count({ where: { userId: user.id } }),
          db.adminSession.count({ where: { userId: user.id, revokedAt: null } }),
        ]);
        associatedCounts.backOfficeCredentials = credentialCount;
        associatedCounts.activeAdminSessions = activeSessionCount;
        cleanupActions.push("Back-office password will be removed and active admin sessions will be revoked.");
        warnings.push("This user will no longer be able to sign in to Admin, Finance, or Courier back-office workspaces.");
      }
    }

    if (roleCode === RoleCode.SUPPORT_STAFF) {
      warnings.push("Support staff access will be removed. Existing audit history remains preserved.");
    }

    const hasAssociatedData =
      cleanupActions.length > 0 ||
      Object.values(associatedCounts).some((count) => count > 0);

    return {
      userId: user.id,
      roleCode,
      canRemove: blockers.length === 0,
      noteRequired: hasAssociatedData,
      affectedProfile,
      blockers,
      warnings,
      cleanupActions,
      associatedCounts,
    };
  }

  private async applyRoleRemovalCleanup(
    db: Prisma.TransactionClient,
    user: AdminUserWithProfiles,
    roleCode: RoleCode,
  ) {
    if (roleCode === RoleCode.SELLER && user.seller) {
      await db.seller.update({
        where: { id: user.seller.id },
        data: { status: SellerStatus.SUSPENDED },
      });
    }

    if (roleCode === RoleCode.BUSINESS_BUYER && user.businessBuyer) {
      await db.businessBuyer.update({
        where: { id: user.businessBuyer.id },
        data: { status: UserStatus.DISABLED },
      });
    }

    if (roleCode === RoleCode.DELIVERY_PARTNER && user.deliveryProfile) {
      await db.deliveryPartnerProfile.update({
        where: { userId: user.id },
        data: { isAvailable: false },
      });
    }

    if (backOfficeRoleCodes.has(roleCode)) {
      const remainingBackOfficeRoles = user.userRoles.filter(
        (userRole) => userRole.role.code !== roleCode && backOfficeRoleCodes.has(userRole.role.code),
      );
      if (remainingBackOfficeRoles.length === 0) {
        await db.adminCredential.deleteMany({ where: { userId: user.id } });
        await db.adminSession.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }
  }

  private assertValidRoleCode(roleCode: RoleCode) {
    if (!Object.values(RoleCode).includes(roleCode)) {
      throw new BadRequestException("Unsupported role code.");
    }
  }

  private profileWhere(profile: AdminUserQueryDto["profile"]): Prisma.UserWhereInput {
    if (profile === "CUSTOMER") {
      return { customer: { isNot: null } };
    }

    if (profile === "SELLER") {
      return { seller: { isNot: null } };
    }

    if (profile === "BUSINESS_BUYER") {
      return { businessBuyer: { isNot: null } };
    }

    return {};
  }

  private roleName(roleCode: RoleCode) {
    return roleCode
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private deliveryProfileData(dto: UpdateDeliveryPartnerProfileDto) {
    return {
      ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
      ...(dto.vehicleNumber !== undefined ? { vehicleNumber: dto.vehicleNumber || null } : {}),
      ...(dto.isAvailable !== undefined ? { isAvailable: this.booleanValue(dto.isAvailable) } : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.serviceCountryCode !== undefined ? { serviceCountryCode: dto.serviceCountryCode || null } : {}),
      ...(dto.serviceStateCode !== undefined ? { serviceStateCode: dto.serviceStateCode || null } : {}),
      ...(dto.serviceCityCode !== undefined ? { serviceCityCode: dto.serviceCityCode || null } : {}),
      ...(dto.servicePincodes !== undefined ? { servicePincodes: this.csvValues(dto.servicePincodes) } : {}),
      ...(dto.serviceLocalAreaCodes !== undefined
        ? { serviceLocalAreaCodes: this.csvValues(dto.serviceLocalAreaCodes) }
        : {}),
      ...(dto.codCashLimitPaise !== undefined ? { codCashLimitPaise: dto.codCashLimitPaise } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
    };
  }

  private deliveryProfileAuditValue(profile: {
    phone?: string | null;
    vehicleNumber?: string | null;
    isAvailable?: boolean;
    priority?: number;
    serviceCountryCode?: string | null;
    serviceStateCode?: string | null;
    serviceCityCode?: string | null;
    servicePincodes?: string[];
    serviceLocalAreaCodes?: string[];
    codCashLimitPaise?: number | null;
    notes?: string | null;
  }) {
    return {
      phone: profile.phone ?? null,
      vehicleNumber: profile.vehicleNumber ?? null,
      isAvailable: profile.isAvailable ?? true,
      priority: profile.priority ?? 100,
      serviceCountryCode: profile.serviceCountryCode ?? null,
      serviceStateCode: profile.serviceStateCode ?? null,
      serviceCityCode: profile.serviceCityCode ?? null,
      servicePincodes: profile.servicePincodes ?? [],
      serviceLocalAreaCodes: profile.serviceLocalAreaCodes ?? [],
      codCashLimitPaise: profile.codCashLimitPaise ?? null,
      notes: profile.notes ?? null,
    };
  }

  private booleanValue(value: string) {
    return value === "true" || value === "1" || value === "yes";
  }

  private csvValues(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}
