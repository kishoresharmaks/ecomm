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
    const service = new ReportsService(createPrisma(tx) as never, createFinanceCalculator() as never, createMarketService() as never);

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
    tx.orderSellerSplit.findMany
      .mockResolvedValueOnce(Array.from({ length: 50 }, (_, index) => ({ id: `split_${index}` })))
      .mockResolvedValueOnce([]);
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
    const service = new ReportsService(prisma as never, createFinanceCalculator() as never, createMarketService() as never);

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

  it("calculates seller report commission for fresh order splits before payout stamping", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL"]
    });
    tx.orderSellerSplit.aggregate.mockResolvedValue({
      _count: 1,
      _sum: {
        sellerSubtotalPaise: 100000,
        commissionPaise: 0,
        gstOnCommissionPaise: 0,
        tdsPaise: 0,
        tcsPaise: 0,
        platformFeePaise: 0,
        couponSellerFundedDiscountPaise: 0,
        couponAdjustmentPaise: 0,
        refundAdjustmentPaise: 0
      }
    });
    const recentSplit = {
      id: "split_1",
      sellerSubtotalPaise: 100000,
      commissionPaise: 0,
      gstOnCommissionPaise: 0,
      tdsPaise: 0,
      tcsPaise: 0,
      platformFeePaise: 0,
      netPayablePaise: 0
    };
    tx.orderSellerSplit.findMany
      .mockResolvedValueOnce([recentSplit])
      .mockResolvedValueOnce([recentSplit]);
    tx.product.count.mockResolvedValueOnce(1);
    tx.productVariant.count.mockResolvedValueOnce(0);
    tx.productVariant.findMany.mockResolvedValue([]);
    tx.b2BEnquiry.count.mockResolvedValueOnce(0);
    tx.b2BEnquiry.groupBy.mockResolvedValue([]);
    tx.b2BOrder.aggregate.mockResolvedValue({
      _count: 0,
      _sum: {
        subtotalPaise: 0,
        buyerPayableAmountPaise: 0,
        paidAmountPaise: 0,
        commissionAmountPaise: 0,
        sellerPayoutAmountPaise: 0
      }
    });
    tx.b2BOrder.groupBy.mockResolvedValue([]);
    tx.b2BOrder.findMany.mockResolvedValue([]);
    tx.serviceListing.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    tx.serviceBooking.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { totalPayablePaise: 0, paidAmountPaise: 0 }
    });
    tx.serviceBooking.groupBy.mockResolvedValue([]);
    tx.servicePayment.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { amountPaise: 0 }
    });
    tx.servicePayment.groupBy.mockResolvedValue([]);
    tx.serviceBooking.findMany.mockResolvedValue([]);
    const calculator = createFinanceCalculator({
      commissionPaise: 5000,
      gstOnCommissionPaise: 900,
      tdsPaise: 1000,
      tcsPaise: 500,
      platformFeePaise: 2000,
      netPayablePaise: 90600
    });
    const service = new ReportsService(prisma as never, calculator as never, createMarketService() as never);

    const result = await service.sellerSales({ id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] }, {});

    expect(result.summary.commissionPaise).toBe(5000);
    expect(result.summary.gstOnCommissionPaise).toBe(900);
    expect(result.summary.platformFeePaise).toBe(2000);
    expect(result.summary.netSalesPaise).toBe(90600);
    expect(result.recentOrders[0]).toMatchObject({
      id: "split_1",
      commissionPaise: 5000,
      gstOnCommissionPaise: 900,
      tdsPaise: 1000,
      tcsPaise: 500,
      platformFeePaise: 2000,
      netPayablePaise: 90600
    });
    expect(calculator.calculateSplit).toHaveBeenCalledWith(recentSplit, tx);
  });

  it("calculates seller reports overview commission and net payable before payout stamping", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL"]
    });
    const freshSplit = freshUnstampedSplit();
    tx.orderSellerSplit.aggregate.mockResolvedValue({
      _count: 1,
      _sum: {
        sellerSubtotalPaise: 100000,
        commissionPaise: 0,
        gstOnCommissionPaise: 0,
        tdsPaise: 0,
        tcsPaise: 0,
        platformFeePaise: 0,
        couponSellerFundedDiscountPaise: 0,
        couponAdjustmentPaise: 0,
        refundAdjustmentPaise: 0,
        netPayablePaise: 0
      }
    });
    tx.orderSellerSplit.findMany.mockResolvedValue([freshSplit]);
    tx.sellerPayout.aggregate.mockResolvedValue({ _sum: { netPayablePaise: 0 }, _count: 0 });
    tx.productVariant.count.mockResolvedValue(0);
    tx.product.count.mockResolvedValue(1);
    tx.b2BOrder.count.mockResolvedValue(0);
    tx.returnRequest.count.mockResolvedValue(0);
    const calculator = createFinanceCalculator({
      commissionPaise: 5000,
      gstOnCommissionPaise: 900,
      tdsPaise: 1000,
      tcsPaise: 500,
      platformFeePaise: 2000,
      netPayablePaise: 90600
    });
    const service = new ReportsService(prisma as never, calculator as never, createMarketService() as never);

    const result = await service.sellerReportsOverview({ id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] }, {});

    expect(result.totalSalesPaise).toBe(100000);
    expect(result.commissionPaise).toBe(5000);
    expect(result.gstOnCommissionPaise).toBe(900);
    expect(result.totalDeductionsPaise).toBe(9400);
    expect(result.netSalesPaise).toBe(90600);
    expect(calculator.calculateSplit).toHaveBeenCalledWith(freshSplit, tx);
  });

  it("converts seller report overview amounts into the seller operating currency", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_sg",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL"],
      addresses: [{ countryCode: "SG" }],
    });
    tx.orderSellerSplit.aggregate.mockResolvedValue({
      _count: 1,
      _sum: {
        sellerSubtotalPaise: 100000,
        commissionPaise: 5000,
        gstOnCommissionPaise: 900,
        tdsPaise: 1000,
        tcsPaise: 500,
        platformFeePaise: 2000,
        couponSellerFundedDiscountPaise: 0,
        couponAdjustmentPaise: 0,
        refundAdjustmentPaise: 0,
        netPayablePaise: 90600,
      },
    });
    tx.orderSellerSplit.findMany.mockResolvedValue([]);
    tx.sellerPayout.aggregate.mockResolvedValue({ _sum: { netPayablePaise: 0 }, _count: 0 });
    tx.productVariant.count.mockResolvedValue(0);
    tx.product.count.mockResolvedValue(1);
    tx.b2BOrder.count.mockResolvedValue(0);
    tx.returnRequest.count.mockResolvedValue(0);
    const marketService = createMarketService({ countryCode: "SG", currency: "SGD", rate: 0.02 });
    const service = new ReportsService(prisma as never, createFinanceCalculator() as never, marketService as never);

    const result = await service.sellerReportsOverview(
      { id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] },
      {},
    );

    expect(result.currency).toBe("SGD");
    expect(result.totalSalesPaise).toBe(2000);
    expect(result.commissionPaise).toBe(100);
    expect(result.netSalesPaise).toBe(1812);
    expect(marketService.getMarketCurrency).toHaveBeenCalledWith("SG", { requireFresh: true, forceRefresh: true });
  });

  it("calculates seller finance report summary before payout stamping", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL"]
    });
    const freshSplit = freshUnstampedSplit();
    tx.orderSellerSplit.aggregate
      .mockResolvedValueOnce({
        _count: 1,
        _sum: {
          sellerSubtotalPaise: 100000,
          commissionPaise: 0,
          gstOnCommissionPaise: 0,
          tdsPaise: 0,
          tcsPaise: 0,
          platformFeePaise: 0,
          couponSellerFundedDiscountPaise: 0,
          couponAdjustmentPaise: 0,
          refundAdjustmentPaise: 0,
          netPayablePaise: 0
        }
      })
      .mockResolvedValueOnce({ _sum: { netPayablePaise: 0 }, _count: 0 });
    tx.orderSellerSplit.findMany.mockResolvedValue([freshSplit]);
    tx.sellerPayout.aggregate.mockResolvedValue({ _sum: { netPayablePaise: 0, grossSalesPaise: 0 }, _count: 0 });
    tx.sellerPayout.findMany.mockResolvedValue([]);
    tx.sellerLedgerEntry.findMany.mockResolvedValue([]);
    const service = new ReportsService(
      prisma as never,
      createFinanceCalculator({
        commissionPaise: 5000,
        gstOnCommissionPaise: 900,
        tdsPaise: 1000,
        tcsPaise: 500,
        platformFeePaise: 2000,
        netPayablePaise: 90600
      }) as never,
      createMarketService() as never,
    );

    const result = await service.sellerFinanceReport({ id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] }, {});

    expect(result.summary.grossSalesPaise).toBe(100000);
    expect(result.summary.commissionPaise).toBe(5000);
    expect(result.summary.platformFeePaise).toBe(2000);
    expect(result.summary.netPayablePaise).toBe(90600);
  });

  it("calculates seller tax report rows before payout stamping", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue({
      id: "seller_1",
      primaryCapability: "RETAIL",
      enabledCapabilities: ["RETAIL"]
    });
    const freshSplit = freshUnstampedSplit();
    tx.orderSellerSplit.aggregate.mockResolvedValue({
      _count: 1,
      _sum: {
        sellerSubtotalPaise: 100000,
        commissionPaise: 0,
        gstOnCommissionPaise: 0,
        tdsPaise: 0,
        tcsPaise: 0,
        platformFeePaise: 0,
        couponSellerFundedDiscountPaise: 0,
        couponAdjustmentPaise: 0,
        refundAdjustmentPaise: 0,
        netPayablePaise: 0
      }
    });
    tx.orderSellerSplit.findMany
      .mockResolvedValueOnce([freshSplit])
      .mockResolvedValueOnce([{ ...freshSplit, order: { orderNumber: "1HI-1", createdAt: new Date(), currency: "INR" } }])
      .mockResolvedValueOnce([freshSplit]);
    const service = new ReportsService(
      prisma as never,
      createFinanceCalculator({
        commissionPaise: 5000,
        gstOnCommissionPaise: 900,
        tdsPaise: 1000,
        tcsPaise: 500,
        platformFeePaise: 2000,
        netPayablePaise: 90600
      }) as never,
      createMarketService() as never,
    );

    const result = await service.sellerTaxReport({ id: "user_seller", clerkUserId: null, email: "seller@example.com", roles: [] }, {});

    expect(result.summary.commissionPaise).toBe(5000);
    expect(result.summary.totalDeductionsPaise).toBe(9400);
    expect(result.summary.netPayablePaise).toBe(90600);
    expect(result.splits[0]).toMatchObject({
      commissionPaise: 5000,
      platformFeePaise: 2000,
      netPayablePaise: 90600
    });
  });

  it("blocks seller reports for users without a seller account", async () => {
    const tx = createReportsTx();
    const prisma = createPrisma(tx);
    prisma.client.seller.findUnique.mockResolvedValue(null);
    const service = new ReportsService(prisma as never, createFinanceCalculator() as never, createMarketService() as never);

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
      findMany: vi.fn(),
      count: vi.fn()
    },
    sellerPayout: {
      aggregate: vi.fn(),
      findMany: vi.fn()
    },
    sellerLedgerEntry: {
      findMany: vi.fn()
    },
    returnRequest: {
      count: vi.fn()
    },
    supportRequest: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    }
  };
}

function createFinanceCalculator(overrides: Record<string, number> = {}) {
  return {
    calculateSplit: vi.fn(async () => ({
      commissionPaise: 0,
      gstOnCommissionPaise: 0,
      tdsPaise: 0,
      tcsPaise: 0,
      platformFeePaise: 0,
      netPayablePaise: 0,
      ...overrides
    }))
  };
}

function createMarketService(overrides: { currency?: string; countryCode?: string; rate?: number } = {}) {
  const market = {
    countryCode: overrides.countryCode ?? "IN",
    countryName: overrides.countryCode === "SG" ? "Singapore" : "India",
    currency: overrides.currency ?? "INR",
    locale: overrides.currency === "SGD" ? "en-SG" : "en-IN",
    baseCurrency: "INR",
    rate: overrides.rate ?? 1,
    provider: "test",
    fetchedAt: new Date(),
    expiresAt: new Date(),
    isStale: false,
  };

  return {
    getMarketCurrency: vi.fn(async () => market),
    convertMinorUnits: vi.fn((baseMinor: number) =>
      market.currency === market.baseCurrency ? baseMinor : Math.round((baseMinor / 100) * market.rate * 100),
    ),
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
      orderSellerSplit: tx.orderSellerSplit,
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx))
    }
  };
}

function freshUnstampedSplit() {
  return {
    id: "split_1",
    sellerId: "seller_1",
    sellerSubtotalPaise: 100000,
    commissionPaise: 0,
    gstOnCommissionPaise: 0,
    tdsPaise: 0,
    tcsPaise: 0,
    platformFeePaise: 0,
    couponSellerFundedDiscountPaise: 0,
    couponAdjustmentPaise: 0,
    refundAdjustmentPaise: 0,
    netPayablePaise: 0,
    createdAt: new Date(),
    order: {
      createdAt: new Date(),
      items: [{ id: "item_1", sellerId: "seller_1", productId: "product_1", lineTotalPaise: 100000, couponSellerFundedDiscountPaise: 0, product: { categoryId: "category_1" } }]
    }
  };
}
