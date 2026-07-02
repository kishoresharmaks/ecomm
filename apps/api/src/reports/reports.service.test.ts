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
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL", "SERVICE"]
    });
    tx.orderSellerSplit.aggregate.mockResolvedValue({
      _count: 75,
      _sum: {
        sellerSubtotalPaise: 900000,
        commissionPaise: 45000,
        gstOnCommissionPaise: 8100,
        tdsPaise: 9000,
        tcsPaise: 4500,
        platformFeePaise: 12000,
        couponSellerFundedDiscountPaise: 15000,
        couponAdjustmentPaise: 2000,
        refundAdjustmentPaise: -5000
      }
    });
    tx.orderSellerSplit.findMany.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ id: `split_${index}` })));
    tx.product.count.mockResolvedValueOnce(8);
    tx.productVariant.count.mockResolvedValueOnce(32);
    tx.productVariant.findMany.mockResolvedValue([]);
    tx.b2BEnquiry.count.mockResolvedValueOnce(4);
    tx.b2BEnquiry.groupBy.mockResolvedValue([{ status: "RESPONDED", _count: 2 }]);
    tx.b2BOrder.aggregate.mockResolvedValue({
      _count: 3,
      _sum: {
        subtotalPaise: 180000,
        buyerPayableAmountPaise: 210000,
        paidAmountPaise: 120000,
        commissionAmountPaise: 18000,
        sellerPayoutAmountPaise: 162000
      }
    });
    tx.b2BOrder.groupBy
      .mockResolvedValueOnce([{ status: "PO_ACCEPTED", _count: 1, _sum: { buyerPayableAmountPaise: 70000, sellerPayoutAmountPaise: 54000 } }])
      .mockResolvedValueOnce([{ paymentStatus: "PAID", _count: 1, _sum: { paidAmountPaise: 70000, buyerPayableAmountPaise: 70000 } }]);
    tx.b2BOrder.findMany.mockResolvedValue([{ id: "b2b_order_1", orderNumber: "B2B-1" }]);
    tx.serviceListing.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
    tx.serviceBooking.aggregate.mockResolvedValue({
      _count: 6,
      _sum: { totalPayablePaise: 420000, paidAmountPaise: 260000 }
    });
    tx.serviceBooking.groupBy.mockResolvedValue([{ status: "COMPLETED", _count: 2, _sum: { totalPayablePaise: 140000, paidAmountPaise: 140000 } }]);
    tx.servicePayment.aggregate.mockResolvedValue({
      _count: 4,
      _sum: { amountPaise: 260000 }
    });
    tx.servicePayment.groupBy.mockResolvedValue([{ status: "PAID", _count: 4, _sum: { amountPaise: 260000 } }]);
    tx.serviceBooking.findMany.mockResolvedValue([{ id: "service_booking_1", bookingNumber: "SB-1" }]);
    const service = new ReportsService(prisma as never);

    const result = await service.sellerSales({ id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] }, {});

    expect(result.seller).toEqual({
      id: "seller_1",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL", "SERVICE"]
    });
    expect(result.summary).toEqual({
      orderCount: 75,
      totalSalesPaise: 900000,
      commissionPaise: 45000,
      gstOnCommissionPaise: 8100,
      tdsPaise: 9000,
      tcsPaise: 4500,
      platformFeePaise: 12000,
      couponSellerFundedDiscountPaise: 15000,
      couponAdjustmentPaise: 2000,
      refundAdjustmentPaise: -5000,
      netSalesPaise: 803400,
      products: 8,
      lowStockCount: 32,
      b2bEnquiries: 4,
      b2bOrders: 3,
      b2bOrderValuePaise: 210000,
      serviceBookings: 6,
      serviceRevenuePaise: 260000,
      serviceListings: 5
    });
    expect(result.b2b).toMatchObject({
      enquiryCount: 4,
      orderCount: 3,
      buyerPayablePaise: 210000,
      paidAmountPaise: 120000,
      sellerPayoutPaise: 162000
    });
    expect(result.services).toMatchObject({
      listingCount: 5,
      activeListingCount: 3,
      bookingCount: 6,
      paidPaymentPaise: 260000
    });
    expect(tx.orderSellerSplit.aggregate).toHaveBeenCalledWith({
      where: {
        sellerId: "seller_1",
        order: { orderStatus: { not: OrderStatus.CANCELLED } }
      },
      _count: true,
      _sum: {
        sellerSubtotalPaise: true,
        commissionPaise: true,
        gstOnCommissionPaise: true,
        tdsPaise: true,
        tcsPaise: true,
        platformFeePaise: true,
        couponSellerFundedDiscountPaise: true,
        couponAdjustmentPaise: true,
        refundAdjustmentPaise: true
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
    serviceListing: {
      count: vi.fn()
    },
    serviceBooking: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    servicePayment: {
      aggregate: vi.fn(),
      groupBy: vi.fn()
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
    b2BOrder: {
      aggregate: vi.fn(),
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
