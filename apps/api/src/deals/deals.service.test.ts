import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  ApprovalStatus,
  CategoryStatus,
  DealParticipationStatus,
  DealProductEnrollmentStatus,
  DealStatus,
  ProductListingMode,
  ProductStatus,
  SellerStatus,
} from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealsService } from "./deals.service";

const actor = { id: "user_admin" };
const sellerActor = { id: "seller_user_1" };
const future = new Date("2099-06-10T00:00:00.000Z");
const past = new Date("2000-06-10T00:00:00.000Z");

function makeDeal(overrides: Record<string, unknown> = {}) {
  return {
    id: "deal_1",
    title: "Electronics Deal",
    description: null,
    categoryId: "category_root",
    discountBps: 2000,
    joinDeadline: future,
    startsAt: new Date("2099-06-11T00:00:00.000Z"),
    endsAt: new Date("2099-06-20T00:00:00.000Z"),
    status: DealStatus.PUBLISHED,
    maxSellers: null,
    maxProducts: null,
    participations: [],
    productEnrollments: [],
    _count: {
      participations: 0,
      productEnrollments: 0,
      orderItems: 0,
    },
    ...overrides,
  };
}

function approvedSeller() {
  return {
    id: "seller_1",
    userId: sellerActor.id,
    status: SellerStatus.APPROVED,
    approvalStatus: ApprovalStatus.APPROVED,
  };
}

function createTx() {
  return {
    deal: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([{ id: "product_1" }]),
      findFirst: vi.fn(),
    },
    dealParticipation: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    dealProductEnrollment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createPrisma(tx = createTx()) {
  return {
    tx,
    prisma: {
      client: {
        $transaction: vi.fn((callback) => callback(tx)),
        seller: {
          findUnique: vi.fn().mockResolvedValue(approvedSeller()),
        },
        category: {
          findFirst: vi.fn().mockResolvedValue({ id: "category_root", status: CategoryStatus.ACTIVE }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        deal: {
          create: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
        },
        auditLog: {
          create: vi.fn(),
        },
      },
    },
  };
}

describe("DealsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an admin deal using percent input as basis points", async () => {
    const { prisma } = createPrisma();
    prisma.client.deal.create.mockImplementation(async ({ data }) => makeDeal({ ...data, id: "deal_1" }));
    const service = new DealsService(prisma as never);

    await service.createDeal(actor as never, {
      title: "  Electronics Deal  ",
      categoryId: "category_root",
      discountPercent: 20,
      joinDeadline: "2099-06-09T00:00:00.000Z",
      startsAt: "2099-06-11T00:00:00.000Z",
      endsAt: "2099-06-20T00:00:00.000Z",
    });

    expect(prisma.client.deal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Electronics Deal",
          discountBps: 2000,
          createdById: actor.id,
        }),
      }),
    );
    expect(prisma.client.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "deal.created",
          entityType: "deal",
        }),
      }),
    );
  });

  it("rejects seller acceptance after the join deadline", async () => {
    const tx = createTx();
    tx.deal.findUnique.mockResolvedValue(makeDeal({ joinDeadline: past }));
    const { prisma } = createPrisma(tx);
    const service = new DealsService(prisma as never);

    await expect(service.acceptSellerDeal(sellerActor as never, "deal_1")).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.dealParticipation.upsert).not.toHaveBeenCalled();
  });

  it("lists published seller deals even when this seller has no matching products", async () => {
    const { prisma } = createPrisma();
    prisma.client.deal.findMany.mockResolvedValue([makeDeal()]);
    prisma.client.category.findMany.mockResolvedValue([]);
    const productFindMany = vi.fn().mockResolvedValue([]);
    Object.assign(prisma.client, {
      product: {
        findMany: productFindMany,
      },
    });
    const service = new DealsService(prisma as never);

    await expect(service.listSellerDeals(sellerActor as never)).resolves.toMatchObject({
      items: [
        {
          id: "deal_1",
          sellerEligibleProductCount: 0,
        },
      ],
    });
  });

  it("rejects accepting a visible deal when seller has no eligible products", async () => {
    const tx = createTx();
    tx.deal.findUnique.mockResolvedValue(makeDeal());
    tx.product.findMany.mockResolvedValue([]);
    const { prisma } = createPrisma(tx);
    const service = new DealsService(prisma as never);

    await expect(service.acceptSellerDeal(sellerActor as never, "deal_1")).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.dealParticipation.upsert).not.toHaveBeenCalled();
  });

  it("enforces seller cap before accepting a deal", async () => {
    const tx = createTx();
    tx.deal.findUnique.mockResolvedValue(makeDeal({ maxSellers: 1 }));
    tx.dealParticipation.findUnique.mockResolvedValue(null);
    tx.dealParticipation.count.mockResolvedValue(1);
    const { prisma } = createPrisma(tx);
    const service = new DealsService(prisma as never);

    await expect(service.acceptSellerDeal(sellerActor as never, "deal_1")).rejects.toBeInstanceOf(ConflictException);
    expect(tx.dealParticipation.upsert).not.toHaveBeenCalled();
  });

  it("rejects enrolling products outside the deal category tree", async () => {
    const tx = createTx();
    tx.deal.findUnique.mockResolvedValue(
      makeDeal({
        participations: [
          {
            sellerId: "seller_1",
            status: DealParticipationStatus.ACCEPTED,
          },
        ],
      }),
    );
    tx.dealParticipation.findUnique.mockResolvedValue({
      sellerId: "seller_1",
      status: DealParticipationStatus.ACCEPTED,
    });
    tx.product.findFirst.mockResolvedValue({
      id: "product_1",
      sellerId: "seller_1",
      categoryId: "category_other",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      listingMode: ProductListingMode.CART,
    });
    const { prisma } = createPrisma(tx);
    const service = new DealsService(prisma as never);

    await expect(
      service.enrollSellerProducts(sellerActor as never, "deal_1", { productIds: ["product_1"] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.dealProductEnrollment.upsert).not.toHaveBeenCalled();
  });

  it("rejects overlapping active deal enrollment for the same product", async () => {
    const tx = createTx();
    tx.deal.findUnique.mockResolvedValue(
      makeDeal({
        participations: [
          {
            sellerId: "seller_1",
            status: DealParticipationStatus.ACCEPTED,
          },
        ],
      }),
    );
    tx.dealParticipation.findUnique.mockResolvedValue({
      sellerId: "seller_1",
      status: DealParticipationStatus.ACCEPTED,
    });
    tx.product.findFirst.mockResolvedValue({
      id: "product_1",
      sellerId: "seller_1",
      categoryId: "category_root",
      status: ProductStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      listingMode: ProductListingMode.CART,
    });
    tx.dealProductEnrollment.findUnique.mockResolvedValue(null);
    tx.dealProductEnrollment.findFirst.mockResolvedValue({
      id: "enrollment_existing",
      status: DealProductEnrollmentStatus.ENROLLED,
      deal: { title: "Existing Deal" },
    });
    const { prisma } = createPrisma(tx);
    const service = new DealsService(prisma as never);

    await expect(
      service.enrollSellerProducts(sellerActor as never, "deal_1", { productIds: ["product_1"] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.dealProductEnrollment.upsert).not.toHaveBeenCalled();
  });
});
