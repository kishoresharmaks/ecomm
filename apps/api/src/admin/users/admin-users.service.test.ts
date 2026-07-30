import { BadRequestException } from "@nestjs/common";
import {
  RoleCode,
  SellerStatus,
  UserStatus,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUsersService } from "./admin-users.service";

vi.mock("../../auth/admin-password", () => ({
  hashAdminPassword: vi.fn().mockResolvedValue({ hash: "password_hash", salt: "password_salt" }),
}));

const actor = {
  id: "admin_actor",
  clerkUserId: null,
  email: "admin@example.com",
  roles: [RoleCode.ADMIN],
};

describe("AdminUsersService role removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suspends seller access while preserving associated seller data", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue(sellerUser());
    tx.role.findUnique.mockResolvedValue(role(RoleCode.SELLER));
    tx.product.count.mockResolvedValue(2);
    tx.orderSellerSplit.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(0);
    tx.sellerPayout.count.mockResolvedValue(0);
    tx.sellerLedgerEntry.count.mockResolvedValue(5);
    const service = new AdminUsersService(createPrisma(tx));

    await service.removeRole(actor, "user_seller", {
      roleCode: RoleCode.SELLER,
      note: "Reviewed seller data before access removal.",
    });

    expect(tx.seller.update).toHaveBeenCalledWith({
      where: { id: "seller_1" },
      data: { status: SellerStatus.SUSPENDED },
    });
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_seller", roleId: "role_SELLER" },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.user.role_removed",
        entityId: "user_seller",
        newValue: expect.objectContaining({
          removedRole: RoleCode.SELLER,
          associatedCounts: expect.objectContaining({
            products: 2,
            orderSplits: 8,
            sellerLedgerEntries: 5,
          }),
        }),
      }),
    });
  });

  it("blocks seller role removal when active seller orders or open payouts exist", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue(sellerUser());
    tx.role.findUnique.mockResolvedValue(role(RoleCode.SELLER));
    tx.orderSellerSplit.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    tx.sellerPayout.count.mockResolvedValue(1);
    const service = new AdminUsersService(createPrisma(tx));

    await expect(
      service.removeRole(actor, "user_seller", {
        roleCode: RoleCode.SELLER,
        note: "Trying to remove.",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
    expect(tx.seller.update).not.toHaveBeenCalled();
  });

  it("marks delivery partner unavailable while preserving wallet and COD history", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue(deliveryPartnerUser());
    tx.role.findUnique.mockResolvedValue(role(RoleCode.DELIVERY_PARTNER));
    tx.deliveryPartnerWalletEntry.count.mockResolvedValue(7);
    const service = new AdminUsersService(createPrisma(tx));

    await service.removeRole(actor, "user_delivery", {
      roleCode: RoleCode.DELIVERY_PARTNER,
      note: "Partner offboarded after wallet review.",
    });

    expect(tx.deliveryPartnerProfile.update).toHaveBeenCalledWith({
      where: { userId: "user_delivery" },
      data: { isAvailable: false },
    });
    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user_delivery", roleId: "role_DELIVERY_PARTNER" },
    });
  });

  it("blocks delivery partner role removal with active deliveries, unverified COD, or open payouts", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue(deliveryPartnerUser());
    tx.role.findUnique.mockResolvedValue(role(RoleCode.DELIVERY_PARTNER));
    tx.deliveryDetail.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    tx.orderShipment.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    tx.deliveryPartnerPayout.count.mockResolvedValue(1);
    const service = new AdminUsersService(createPrisma(tx));

    await expect(
      service.removeRole(actor, "user_delivery", {
        roleCode: RoleCode.DELIVERY_PARTNER,
        note: "Trying to remove.",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
    expect(tx.deliveryPartnerProfile.update).not.toHaveBeenCalled();
  });

  it("keeps self-admin and last-admin guards", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue({
      ...baseUser("admin_actor", RoleCode.ADMIN),
      userRoles: [{ role: { id: "role_ADMIN", code: RoleCode.ADMIN, name: "Admin" } }],
    });
    tx.role.findUnique.mockResolvedValue(role(RoleCode.ADMIN));
    tx.user.count.mockResolvedValue(1);
    const service = new AdminUsersService(createPrisma(tx));

    await expect(
      service.removeRole(actor, "admin_actor", {
        roleCode: RoleCode.ADMIN,
        note: "Trying to remove self.",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it("removes back-office credential and revokes sessions after final back-office role removal", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue(baseUser("finance_user", RoleCode.FINANCE));
    tx.role.findUnique.mockResolvedValue(role(RoleCode.FINANCE));
    tx.adminCredential.count.mockResolvedValue(1);
    tx.adminSession.count.mockResolvedValue(2);
    const service = new AdminUsersService(createPrisma(tx));

    await service.removeRole(actor, "finance_user", {
      roleCode: RoleCode.FINANCE,
      note: "Finance access revoked.",
    });

    expect(tx.adminCredential.deleteMany).toHaveBeenCalledWith({
      where: { userId: "finance_user" },
    });
    expect(tx.adminSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "finance_user", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe("AdminUsersService back-office password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates user status and writes its audit record in the same locked transaction", async () => {
    const tx = createUsersTx();
    const existing = adminUser("user_admin_2", UserStatus.ACTIVE);
    const updated = adminUser("user_admin_2", UserStatus.DISABLED);
    tx.user.findUnique.mockResolvedValue(existing);
    tx.user.count.mockResolvedValue(1);
    tx.user.update.mockResolvedValue(updated);
    const service = new AdminUsersService(createPrisma(tx));

    await service.updateStatus(actor, existing.id, {
      status: UserStatus.DISABLED,
      note: "Access removed after review.",
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { not: existing.id },
        status: UserStatus.ACTIVE,
      }),
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: { status: UserStatus.DISABLED },
      include: expect.any(Object),
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.user.status_updated",
        entityId: existing.id,
        oldValue: { status: UserStatus.ACTIVE },
        newValue: { status: UserStatus.DISABLED, note: "Access removed after review." },
      }),
    });
  });

  it("keeps the final active admin enabled", async () => {
    const tx = createUsersTx();
    const existing = adminUser("user_admin_2", UserStatus.ACTIVE);
    tx.user.findUnique.mockResolvedValue(existing);
    tx.user.count.mockResolvedValue(0);
    const service = new AdminUsersService(createPrisma(tx));

    await expect(
      service.updateStatus(actor, existing.id, { status: UserStatus.DISABLED }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it("updates the credential and revokes active sessions in one transaction", async () => {
    const tx = createUsersTx();
    tx.user.findUnique.mockResolvedValue(baseUser("admin_target", RoleCode.ADMIN));
    tx.adminSession.updateMany.mockResolvedValue({ count: 3 });
    const service = new AdminUsersService(createPrisma(tx));

    await expect(
      service.setBackOfficePassword(actor, "admin_target", {
        password: "NewSecurePassword123!",
        note: "Credential rotated after account review.",
      }),
    ).resolves.toEqual({ updated: true, userId: "admin_target", revokedSessions: 3 });

    expect(tx.adminCredential.upsert).toHaveBeenCalledWith({
      where: { userId: "admin_target" },
      update: expect.objectContaining({
        passwordHash: "password_hash",
        passwordSalt: "password_salt",
      }),
      create: expect.objectContaining({
        userId: "admin_target",
        passwordHash: "password_hash",
        passwordSalt: "password_salt",
      }),
    });
    expect(tx.adminSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "admin_target", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "admin.user.backoffice_password_set",
        entityId: "admin_target",
        newValue: expect.objectContaining({ revokedSessionCount: 3 }),
      }),
    });
  });
});

function role(code: RoleCode) {
  return { id: `role_${code}`, code, name: code };
}

function baseUser(id: string, roleCode: RoleCode) {
  return {
    id,
    email: `${id}@example.com`,
    phone: null,
    fullName: null,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [{ role: role(roleCode) }],
    customer: null,
    seller: null,
    businessBuyer: null,
    deliveryProfile: null,
  };
}

function sellerUser() {
  return {
    ...baseUser("user_seller", RoleCode.SELLER),
    seller: {
      id: "seller_1",
      status: SellerStatus.APPROVED,
    },
  };
}

function deliveryPartnerUser() {
  return {
    ...baseUser("user_delivery", RoleCode.DELIVERY_PARTNER),
    deliveryProfile: {
      id: "delivery_profile_1",
      userId: "user_delivery",
      phone: "9876543210",
      vehicleNumber: "TN30AB1234",
      isAvailable: true,
      priority: 100,
      serviceCountryCode: "IN",
      serviceStateCode: null,
      serviceCityCode: null,
      serviceAreas: [],
      codCashLimitPaise: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

function createUsersTx() {
  return {
    $executeRaw: vi.fn(),
    user: {
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    userRole: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    seller: {
      update: vi.fn(),
    },
    product: {
      count: vi.fn().mockResolvedValue(0),
    },
    orderSellerSplit: {
      count: vi.fn().mockResolvedValue(0),
    },
    sellerPayout: {
      count: vi.fn().mockResolvedValue(0),
    },
    sellerLedgerEntry: {
      count: vi.fn().mockResolvedValue(0),
    },
    deliveryDetail: {
      count: vi.fn().mockResolvedValue(0),
    },
    orderShipment: {
      count: vi.fn().mockResolvedValue(0),
    },
    deliveryPartnerPayout: {
      count: vi.fn().mockResolvedValue(0),
    },
    deliveryPartnerWalletEntry: {
      count: vi.fn().mockResolvedValue(0),
    },
    deliveryPartnerProfile: {
      update: vi.fn(),
      upsert: vi.fn(),
    },
    businessBuyer: {
      update: vi.fn(),
    },
    businessBuyerAddress: {
      count: vi.fn().mockResolvedValue(0),
    },
    b2BEnquiry: {
      count: vi.fn().mockResolvedValue(0),
    },
    customerAddress: {
      count: vi.fn().mockResolvedValue(0),
    },
    order: {
      count: vi.fn().mockResolvedValue(0),
    },
    adminCredential: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    adminSession: {
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createUsersTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  } as never;
}

function adminUser(id: string, status: UserStatus) {
  return {
    id,
    clerkUserId: null,
    email: `${id}@example.com`,
    phone: null,
    fullName: "Back Office Admin",
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [{ role: role(RoleCode.ADMIN) }],
    customer: null,
    seller: null,
    businessBuyer: null,
    deliveryProfile: null,
  };
}
