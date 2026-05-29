import { ForbiddenException } from "@nestjs/common";
import { OrderStatus } from "@indihub/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes cancelled orders from admin sales totals and payment grouping", async () => {
    const tx = createReportsTx();
    tx.order.aggregate.mockResolvedValue({
      _sum: { totalPaise: 25000, subtotalPaise: 23000, shippingPaise: 2000 },
      _count: 2
    });
    tx.payment.groupBy.mockResolvedValue([{ status: "PAID", provider: "RAZORPAY", _sum: { amountPaise: 25000 }, _count: 2 }]);
    tx.order.findMany.mockResolvedValue([]);
    const service = new ReportsService(createPrisma(tx) as never);

    const result = await service.sales({});

    expect(result.summary).toEqual({
      totalPaise: 25000,
      subtotalPaise: 23000,
      shippingPaise: 2000,
      orderCount: 2
    });
    expect(tx.order.aggregate).toHaveBeenCalledWith({
      where: { orderStatus: { not: OrderStatus.CANCELLED } },
      _sum: { totalPaise: true, subtotalPaise: true, shippingPaise: true },
      _count: true
    });
    expect(tx.payment.groupBy).toHaveBeenCalledWith({
      by: ["status", "provider"],
      where: { order: { orderStatus: { not: OrderStatus.CANCELLED } } },
      _sum: { amountPaise: true },
      _count: true
    });
  });

  it("uses aggregate totals for seller sales instead of the limited recent-order list", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue({ id: "seller_1" });
    tx.orderSellerSplit.aggregate.mockResolvedValue({
      _count: 75,
      _sum: { sellerSubtotalPaise: 900000, commissionPaise: 45000 }
    });
    tx.orderSellerSplit.findMany.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ id: `split_${index}` })));
    tx.product.count.mockResolvedValueOnce(8);
    tx.productVariant.count.mockResolvedValueOnce(32);
    tx.productVariant.findMany.mockResolvedValue([]);
    tx.b2BEnquiry.count.mockResolvedValueOnce(4);
    const service = new ReportsService(prisma as never);

    const result = await service.sellerSales({ id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] }, {});

    expect(result.summary).toEqual({
      orderCount: 75,
      totalSalesPaise: 900000,
      commissionPaise: 45000,
      netSalesPaise: 855000,
      products: 8,
      lowStockCount: 32,
      b2bEnquiries: 4
    });
    expect(tx.orderSellerSplit.aggregate).toHaveBeenCalledWith({
      where: {
        sellerId: "seller_1",
        order: { orderStatus: { not: OrderStatus.CANCELLED } }
      },
      _count: true,
      _sum: {
        sellerSubtotalPaise: true,
        commissionPaise: true
      }
    });
  });

  it("blocks seller reports for users without a seller account", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue(null);
    const service = new ReportsService(prisma as never);

    await expect(
      service.sellerSales({ id: "user_customer", clerkUserId: null, email: "customer@example.com", roles: [] }, {})
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.orderSellerSplit.aggregate).not.toHaveBeenCalled();
  });
});

function createReportsTx() {
  return {
    order: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    payment: {
      groupBy: vi.fn()
    },
    customer: {
      count: vi.fn()
    },
    seller: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    product: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    productVariant: {
      count: vi.fn(),
      findMany: vi.fn()
    },
    orderSellerSplit: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    orderItem: {
      groupBy: vi.fn()
    },
    b2BEnquiry: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    supportRequest: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    }
  };
}

function createPrisma(tx: ReturnType<typeof createReportsTx>) {
  return {
    client: {
      seller: {
        findUnique: vi.fn(),
        findMany: tx.seller.findMany
      },
      product: {
        findMany: tx.product.findMany
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx))
    }
  };
}
