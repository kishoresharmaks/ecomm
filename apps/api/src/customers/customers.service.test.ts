import { RoleCode, UserStatus } from "@indihub/database";
import { describe, expect, it, vi } from "vitest";
import { CustomersService } from "./customers.service";

describe("CustomersService", () => {
  it("saves account-backed browsing location with audit log", async () => {
    const tx = createCustomerTx();
    const prisma = createPrisma(tx);
    prisma.client.customer.update.mockResolvedValue({
      browsingLocationLabel: "Mettu Street, Salem 636001",
      browsingCountryCode: "IN",
      browsingStateCode: "TN",
      browsingCityCode: "SALEM",
      browsingLocalAreaCode: "TN-SALEM-METTU-636001",
      browsingPincode: "636001",
    });
    const service = new CustomersService(prisma as never, {} as never);

    const result = await service.updateBrowsingLocation(
      {
        id: "user_1",
        clerkUserId: "clerk_1",
        email: "customer@example.com",
        roles: [RoleCode.CUSTOMER],
      },
      {
        label: "Mettu Street, Salem 636001",
        countryCode: "IN",
        stateCode: "TN",
        cityCode: "SALEM",
        localAreaCode: "TN-SALEM-METTU-636001",
        pincode: "636001",
      },
    );

    expect(tx.customer.upsert).toHaveBeenCalledWith({
      where: { userId: "user_1" },
      update: {},
      create: {
        userId: "user_1",
        displayName: "customer@example.com",
        status: UserStatus.ACTIVE,
      },
    });
    expect(prisma.client.customer.update).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: {
        browsingLocationLabel: "Mettu Street, Salem 636001",
        browsingCountryCode: "IN",
        browsingStateCode: "TN",
        browsingCityCode: "SALEM",
        browsingLocalAreaCode: "TN-SALEM-METTU-636001",
        browsingPincode: "636001",
      },
      select: {
        browsingLocationLabel: true,
        browsingCountryCode: true,
        browsingStateCode: true,
        browsingCityCode: true,
        browsingLocalAreaCode: true,
        browsingPincode: true,
      },
    });
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "customer.browsing_location.updated",
        entityType: "customer",
        entityId: "customer_1",
      }),
    });
    expect(result.location).toEqual({
      label: "Mettu Street, Salem 636001",
      countryCode: "IN",
      stateCode: "TN",
      cityCode: "SALEM",
      localAreaCode: "TN-SALEM-METTU-636001",
      pincode: "636001",
    });
  });
});

function createCustomerTx() {
  return {
    customer: {
      upsert: vi.fn().mockResolvedValue({
        id: "customer_1",
        userId: "user_1",
      }),
    },
    wishlist: {
      upsert: vi.fn(),
    },
  };
}

function createPrisma(tx: ReturnType<typeof createCustomerTx>) {
  return {
    client: {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      customer: {
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
}
