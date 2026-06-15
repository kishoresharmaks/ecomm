import { EmailRecipientType, RoleCode, UserStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthUsersService } from "./auth-users.service";

describe("AuthUsersService", () => {
  const notifications = {
    notifyEvent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a customer user, assigns the role, creates customer records, and sends the welcome notification", async () => {
    const tx = createAuthTx();
    tx.user.findFirst.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({
      id: "user_1",
      clerkUserId: "clerk_1",
      email: "customer@example.com",
      fullName: "Indi Customer",
      phone: "9876543210",
      status: UserStatus.ACTIVE,
    });
    tx.role.upsert.mockResolvedValue({ id: "role_customer", code: RoleCode.CUSTOMER });
    tx.customer.upsert.mockResolvedValue({ id: "customer_1", userId: "user_1" });

    const service = new AuthUsersService(createPrisma(tx), notifications as never);

    const result = await service.syncAuthUser({
      clerkUserId: "clerk_1",
      email: "customer@example.com",
      fullName: "Indi Customer",
      phone: "9876543210",
    });

    expect(result).toEqual({ synced: true });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        clerkUserId: "clerk_1",
        email: "customer@example.com",
        phone: "9876543210",
        fullName: "Indi Customer",
        status: UserStatus.ACTIVE,
      },
    });
    expect(tx.customer.upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      update: {
        displayName: "Indi Customer",
        status: UserStatus.ACTIVE,
      },
      create: {
        userId: "user_1",
        displayName: "Indi Customer",
        status: UserStatus.ACTIVE,
      },
    });
    expect(tx.wishlist.upsert).toHaveBeenCalledWith({
      where: { customerId: "customer_1" },
      update: {},
      create: { customerId: "customer_1" },
    });
    expect(notifications.notifyEvent).toHaveBeenCalledWith({
      eventCode: "CUSTOMER_REGISTERED",
      recipientType: EmailRecipientType.CUSTOMER,
      recipient: "customer@example.com",
      userId: "user_1",
      variables: {
        customerName: "Indi Customer",
      },
    });
  });

  it("updates an existing business buyer without creating customer-only records or notifications", async () => {
    const tx = createAuthTx();
    tx.user.findFirst.mockResolvedValue({
      id: "user_2",
      clerkUserId: null,
      email: "buyer@example.com",
    });
    tx.user.update.mockResolvedValue({
      id: "user_2",
      clerkUserId: "clerk_buyer",
      email: "buyer@example.com",
      fullName: "Buyer Team",
      phone: null,
      status: UserStatus.ACTIVE,
    });
    tx.role.upsert.mockResolvedValue({ id: "role_b2b", code: RoleCode.BUSINESS_BUYER });

    const service = new AuthUsersService(createPrisma(tx), notifications as never);

    const result = await service.syncAuthUser({
      clerkUserId: "clerk_buyer",
      email: "buyer@example.com",
      fullName: "Buyer Team",
      defaultRole: RoleCode.BUSINESS_BUYER,
    });

    expect(result).toEqual({ synced: true });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user_2" },
      data: {
        clerkUserId: "clerk_buyer",
        email: "buyer@example.com",
        phone: null,
        fullName: "Buyer Team",
        status: UserStatus.ACTIVE,
      },
    });
    expect(tx.customer.upsert).not.toHaveBeenCalled();
    expect(tx.wishlist.upsert).not.toHaveBeenCalled();
    expect(notifications.notifyEvent).not.toHaveBeenCalled();
  });

  it("preserves app-edited customer profile fields during repeated auth sync", async () => {
    const tx = createAuthTx();
    tx.user.findFirst.mockResolvedValue({
      id: "user_3",
      clerkUserId: "clerk_customer",
      email: "customer@example.com",
      fullName: "App Edited Name",
      phone: "9876543210",
      customer: {
        displayName: "App Display",
      },
    });
    tx.user.update.mockResolvedValue({
      id: "user_3",
      clerkUserId: "clerk_customer",
      email: "customer@example.com",
      fullName: "App Edited Name",
      phone: "9876543210",
      status: UserStatus.ACTIVE,
    });
    tx.role.upsert.mockResolvedValue({ id: "role_customer", code: RoleCode.CUSTOMER });
    tx.customer.upsert.mockResolvedValue({ id: "customer_3", userId: "user_3" });

    const service = new AuthUsersService(createPrisma(tx), notifications as never);

    await service.syncAuthUser({
      clerkUserId: "clerk_customer",
      email: "customer@example.com",
      fullName: "Stale Clerk Name",
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user_3" },
      data: {
        clerkUserId: "clerk_customer",
        email: "customer@example.com",
        phone: "9876543210",
        fullName: "App Edited Name",
        status: UserStatus.ACTIVE,
      },
    });
    expect(tx.customer.upsert).toHaveBeenCalledWith({
      where: { userId: "user_3" },
      update: {
        displayName: "App Display",
        status: UserStatus.ACTIVE,
      },
      create: {
        userId: "user_3",
        displayName: "Stale Clerk Name",
        status: UserStatus.ACTIVE,
      },
    });
  });
});

function createAuthTx() {
  return {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    role: {
      upsert: vi.fn(),
    },
    userRole: {
      upsert: vi.fn(),
    },
    customer: {
      upsert: vi.fn(),
    },
    wishlist: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createAuthTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  } as never;
}
