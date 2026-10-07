import { describe, expect, it, vi } from "vitest";
import { CustomersService } from "../customers/customers.service";
import { SellerLedgerService } from "../finance/seller-ledger.service";
import { ExpoPushService } from "../notifications/expo-push.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReturnsService } from "./returns.service";

function returnsServiceForHelperTests() {
  const service = new ReturnsService(
    {} as unknown as PrismaService,
    {} as unknown as CustomersService,
    {} as unknown as SellerLedgerService,
    {} as unknown as NotificationsService,
    {} as unknown as ExpoPushService,
    {} as never,
  );
  return service as unknown as {
    firstTrimmedString: (...values: Array<string | undefined>) => string | undefined;
    trimmedStringOrUndefined: (value: string | undefined) => string | undefined;
    itemPolicyAllowsReturn: (
      snapshot: unknown,
      resolution: "REFUND" | "REPLACEMENT",
    ) => boolean;
    assertReturnWithinWindow: (
      order: Record<string, unknown>,
      resolution: "REFUND" | "REPLACEMENT",
      settings: { returnWindowDays: number; replacementWindowDays: number },
      productWindowDays: number | undefined,
      now: Date,
    ) => void;
    returnLine: (
      item: Record<string, unknown>,
      quantity: number,
      pendingByOrderItem: Map<string, number>,
      orderSellerSplitId: string,
      resolution: "REFUND" | "REPLACEMENT",
    ) => { quantity: number; buyerRefundPaise: number };
    applyReturnStockDisposition: (
      tx: Record<string, unknown>,
      request: {
        id: string;
        requestNumber: string;
        items: Array<{ id: string; productVariantId: string; quantity: number }>;
      },
      dispositions: Map<string, "RESTOCK" | "DO_NOT_RESTOCK">,
      actor: { id: string },
    ) => Promise<void>;
    postReversePickupFinance: (
      tx: Record<string, unknown>,
      returnRequestId: string,
      sellerId: string,
      actor: { id: string },
    ) => Promise<void>;
  };
}

describe("ReturnsService proof reference helpers", () => {
  it("normalizes proof references before they are stored", () => {
    const service = returnsServiceForHelperTests();

    expect(service.trimmedStringOrUndefined("  pickup-ref-001  ")).toBe("pickup-ref-001");
    expect(service.firstTrimmedString("   ", "  fallback-ref  ")).toBe("fallback-ref");
  });

  it("treats missing or blank proof references as absent", () => {
    const service = returnsServiceForHelperTests();

    expect(service.trimmedStringOrUndefined(undefined)).toBeUndefined();
    expect(service.trimmedStringOrUndefined("   ")).toBeUndefined();
    expect(service.firstTrimmedString(undefined, " ", "")).toBeUndefined();
  });
});

describe("ReturnsService return policy helpers", () => {
  it("blocks non-returnable policy snapshots", () => {
    const service = returnsServiceForHelperTests();

    expect(service.itemPolicyAllowsReturn({ returnEligibility: "Non-returnable" }, "REFUND")).toBe(false);
    expect(service.itemPolicyAllowsReturn({ returnEligibility: "Return only" }, "REFUND")).toBe(true);
    expect(service.itemPolicyAllowsReturn({ returnEligibility: "Return only" }, "REPLACEMENT")).toBe(false);
    expect(service.itemPolicyAllowsReturn({ returnEligibility: "Replacement only" }, "REPLACEMENT")).toBe(true);
    expect(service.itemPolicyAllowsReturn({ returnPolicy: "Returnable" }, "REFUND")).toBe(true);
    expect(service.itemPolicyAllowsReturn(null, "REFUND")).toBe(true);
  });

  it("uses active quantity without double-subtracting already returned units", () => {
    const service = returnsServiceForHelperTests();

    const line = service.returnLine(
      {
        id: "item_1",
        orderId: "order_1",
        sellerId: "seller_1",
        productId: "product_1",
        productVariantId: "variant_1",
        quantity: 2,
        activeQuantity: 1,
        cancelledQuantity: 0,
        returnedQuantity: 1,
        unitPricePaise: 1000,
        couponDiscountPaise: 0,
        couponPlatformFundedDiscountPaise: 0,
        couponSellerFundedDiscountPaise: 0,
        returnPolicySnapshot: { returnEligibility: "Returnable" },
      },
      1,
      new Map(),
      "split_1",
      "REFUND",
    );

    expect(line.quantity).toBe(1);
    expect(line.buyerRefundPaise).toBe(1000);
  });

  it("enforces the configured deadline from the recorded delivery time", () => {
    const service = returnsServiceForHelperTests();
    const deliveredOrder = {
      deliveryDetail: null,
      shipments: [
        {
          packages: [{ deliveredAt: new Date("2026-07-10T10:00:00.000Z") }],
          status: "DELIVERED",
          updatedAt: new Date("2026-07-10T10:00:00.000Z"),
        },
      ],
      statusEvents: [],
      updatedAt: new Date("2026-07-10T10:00:00.000Z"),
    };

    expect(() =>
      service.assertReturnWithinWindow(
        deliveredOrder,
        "REFUND",
        { returnWindowDays: 7, replacementWindowDays: 10 },
        undefined,
        new Date("2026-07-17T10:00:00.000Z"),
      ),
    ).not.toThrow();
    expect(() =>
      service.assertReturnWithinWindow(
        deliveredOrder,
        "REFUND",
        { returnWindowDays: 7, replacementWindowDays: 10 },
        undefined,
        new Date("2026-07-17T10:00:00.001Z"),
      ),
    ).toThrow("Return window expired");

    expect(() =>
      service.assertReturnWithinWindow(
        deliveredOrder,
        "REFUND",
        { returnWindowDays: 14, replacementWindowDays: 10 },
        5,
        new Date("2026-07-15T10:00:00.001Z"),
      ),
    ).toThrow("within 5 days");
  });

  it("restores sellable return stock once and leaves damaged stock untouched", async () => {
    const service = returnsServiceForHelperTests();
    const tx = {
      inventoryMovement: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      productVariant: {
        update: vi.fn().mockResolvedValue({}),
      },
    };

    await service.applyReturnStockDisposition(
      tx,
      {
        id: "return_1",
        requestNumber: "RET-1",
        items: [
          { id: "return_item_1", productVariantId: "variant_1", quantity: 2 },
          { id: "return_item_2", productVariantId: "variant_2", quantity: 1 },
        ],
      },
      new Map<string, "RESTOCK" | "DO_NOT_RESTOCK">([
        ["return_item_1", "RESTOCK"],
        ["return_item_2", "DO_NOT_RESTOCK"],
      ]),
      { id: "admin_1" },
    );

    expect(tx.productVariant.update).toHaveBeenCalledTimes(1);
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: "variant_1" },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(tx.inventoryMovement.create).toHaveBeenCalledTimes(1);

    tx.inventoryMovement.findFirst.mockResolvedValue({ id: "movement_1" });
    await service.applyReturnStockDisposition(
      tx,
      {
        id: "return_1",
        requestNumber: "RET-1",
        items: [{ id: "return_item_1", productVariantId: "variant_1", quantity: 2 }],
      },
      new Map<string, "RESTOCK" | "DO_NOT_RESTOCK">([
        ["return_item_1", "RESTOCK"],
      ]),
      { id: "admin_1" },
    );
    expect(tx.productVariant.update).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate reverse pickup earnings after the first finance post", async () => {
    const service = returnsServiceForHelperTests();
    const tx = {
      setting: {
        findMany: vi.fn().mockResolvedValue([
          {
            key: "delivery_partner.payout.reverse_pickup_base_pay_paise",
            value: 4000,
          },
          {
            key: "delivery_partner.payout.reverse_pickup_cost_bearer",
            value: "MARKETPLACE",
          },
        ]),
      },
      reverseShipment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "reverse_1",
            sellerId: "seller_1",
            assignedPartnerUserId: "partner_1",
            status: "RECEIVED",
            mode: "PLATFORM_PICKUP",
            orderId: "order_1",
            order: { orderNumber: "ORD-1", currency: "INR" },
            seller: { storeName: "Seller" },
            returnRequest: { requestNumber: "RET-1" },
          },
        ]),
      },
      deliveryPartnerWalletEntry: {
        findUnique: vi.fn().mockResolvedValue({ id: "wallet_1" }),
        create: vi.fn(),
      },
      orderSellerSplit: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      auditLog: { create: vi.fn() },
    };

    await service.postReversePickupFinance(tx, "return_1", "seller_1", { id: "admin_1" });

    expect(tx.deliveryPartnerWalletEntry.create).not.toHaveBeenCalled();
    expect(tx.orderSellerSplit.update).not.toHaveBeenCalled();
  });

  it("restocks items, creates approved refund request, and enables Razorpay auto-initiation on paid seller cancellation", async () => {
    const service = new ReturnsService(
      {} as unknown as PrismaService,
      {} as unknown as CustomersService,
      {} as unknown as SellerLedgerService,
      {} as unknown as NotificationsService,
      {} as unknown as ExpoPushService,
      {} as never,
    );

    const paidOrder = {
      id: "ord_101",
      orderNumber: "1HI-101",
      customerId: "cust_101",
      paymentStatus: "PAID",
      currency: "INR",
      shippingPaise: 5000,
      platformFeePaise: 200,
      items: [
        {
          id: "item_1",
          sellerId: "seller_1",
          productId: "prod_1",
          productVariantId: "var_1",
          quantity: 2,
          activeQuantity: 2,
          cancelledQuantity: 0,
          returnedQuantity: 0,
          unitPricePaise: 1500,
          couponDiscountPaise: 0,
          couponPlatformFundedDiscountPaise: 0,
          couponSellerFundedDiscountPaise: 0,
        },
      ],
      sellerSplits: [
        {
          id: "split_1",
          sellerId: "seller_1",
          sellerStatus: "PENDING",
          payout: null,
        },
      ],
      shipments: [],
      deliveryDetail: null,
      statusEvents: [],
      payments: [
        {
          id: "pay_1",
          status: "PAID",
          provider: "RAZORPAY",
          providerPaymentId: "pay_razor_123",
          currency: "INR",
        },
      ],
      couponRedemption: null,
      customer: { user: { id: "user_cust" } },
    };

    const tx = {
      order: {
        findUnique: vi.fn().mockResolvedValue(paidOrder),
      },
      orderItem: {
        update: vi.fn().mockResolvedValue({}),
      },
      productVariant: {
        update: vi.fn().mockResolvedValue({}),
      },
      inventoryMovement: {
        create: vi.fn().mockResolvedValue({}),
      },
      orderSellerSplit: {
        update: vi.fn().mockResolvedValue({}),
      },
      refundRequest: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "ref_req_1", refundNumber: "REF-20261006-0001" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const result = await service.processSellerSplitCancellation(tx as never, {
      orderId: "ord_101",
      sellerId: "seller_1",
      orderSellerSplitId: "split_1",
      actor: { id: "seller_user_1" } as never,
      note: "Out of stock",
    });

    expect(result.cancelledQuantity).toBe(2);
    expect(result.buyerRefundPaise).toBe(3000 + 5000 + 200); // Items + shipping + platform fee
    expect(result.canAutoInitiateRazorpay).toBe(true);
    expect(result.allItemsCancelled).toBe(true);
    expect(result.refundNumber).toBe("REF-20261006-0001");

    // Stock restocked
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: "var_1" },
      data: { stockQuantity: { increment: 2 } },
    });

    // Inventory movement recorded
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productVariantId: "var_1",
        quantity: 2,
        movementType: "RETURN",
        reason: "Order package cancelled by seller",
      }),
    });

    // Seller split marked ADJUSTED (since paid)
    expect(tx.orderSellerSplit.update).toHaveBeenCalledWith({
      where: { id: "split_1" },
      data: expect.objectContaining({
        sellerStatus: "CANCELLED",
        settlementStatus: "ADJUSTED",
      }),
    });

    // Refund request created with SELLER_NON_FULFILMENT and APPROVED
    expect(tx.refundRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "ord_101",
        customerId: "cust_101",
        paymentId: "pay_1",
        status: "APPROVED",
        reason: "SELLER_NON_FULFILMENT",
        amountPaise: 8200,
      }),
    });
  });
});

describe("ReturnsService historical cancelled orders reconciliation", () => {
  it("lists unrefunded cancelled orders that have no active refund requests", async () => {
    const mockPrisma = {
      client: {
        order: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "ord_unref_1",
              orderNumber: "ORD-20261007-0001",
              orderStatus: "CANCELLED",
              deliveryStatus: "CANCELLED",
              paymentStatus: "PAID",
              totalPaise: 5000,
              currency: "INR",
              createdAt: new Date(),
              paidAt: new Date(),
              customer: {
                id: "cust_1",
                user: { id: "user_1", fullName: "Test Customer", email: "test@example.com", phone: "9999999999" },
              },
              sellerSplits: [
                {
                  id: "split_1",
                  sellerId: "seller_1",
                  sellerStatus: "CANCELLED",
                  deliveryStatus: "CANCELLED",
                  subtotalPaise: 4000,
                  cancelledAt: new Date(),
                  cancellationReason: "Cancelled by courier",
                  seller: { id: "seller_1", storeName: "Vendor Store", slug: "vendor-store" },
                },
              ],
              items: [
                {
                  id: "item_1",
                  quantity: 1,
                  activeQuantity: 0,
                  cancelledQuantity: 1,
                  unitPricePaise: 4000,
                  couponDiscountPaise: 0,
                  productVariantId: "var_1",
                  productVariant: { id: "var_1", sku: "SKU1", variantName: "V1", stockQuantity: 5 },
                  seller: { id: "seller_1", storeName: "Vendor Store" },
                },
              ],
              refundRequests: [],
              payments: [{ id: "pay_1", provider: "RAZORPAY", status: "PAID", amountPaise: 5000 }],
            },
          ]),
        },
      },
    };

    const service = new ReturnsService(
      mockPrisma as unknown as PrismaService,
      {} as unknown as CustomersService,
      {} as unknown as SellerLedgerService,
      {} as unknown as NotificationsService,
      {} as unknown as ExpoPushService,
      {} as never,
    );

    const result = await service.listUnrefundedCancelledOrders();
    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.orderNumber).toBe("ORD-20261007-0001");
    expect(result.items[0]?.paymentProvider).toBe("RAZORPAY");
  });

  it("reconciles an unrefunded cancelled order by creating an approved refund request and restock", async () => {
    const mockOrder = {
      id: "ord_rec_1",
      orderNumber: "ORD-REC-001",
      customerId: "c1111111-1111-1111-1111-111111111111",
      orderStatus: "CANCELLED",
      paymentStatus: "PAID",
      totalPaise: 5500,
      subtotalPaise: 5000,
      shippingPaise: 400,
      platformFeePaise: 100,
      currency: "INR",
      sellerSplits: [
        {
          id: "split_rec_1",
          sellerId: "s1111111-1111-1111-1111-111111111111",
          sellerStatus: "CANCELLED",
          deliveryStatus: "CANCELLED",
          subtotalPaise: 5000,
          payout: null,
        },
      ],
      items: [
        {
          id: "item_rec_1",
          productId: "prod_1",
          productVariantId: "var_rec_1",
          quantity: 2,
          activeQuantity: 0,
          cancelledQuantity: 2,
          returnedQuantity: 0,
          unitPricePaise: 2500,
          couponDiscountPaise: 0,
          productVariant: { id: "var_rec_1", stockQuantity: 10 },
          seller: { id: "s1111111-1111-1111-1111-111111111111", storeName: "Vendor Store" },
        },
      ],
      refundRequests: [],
      payments: [
        {
          id: "pay_rec_1",
          provider: "RAZORPAY",
          providerPaymentId: "pay_razorpay_123",
          status: "PAID",
          amountPaise: 5500,
        },
      ],
      customer: { user: { id: "u1111111-1111-1111-1111-111111111111" } },
    };

    const mockPrisma = {
      client: {
        order: {
          findUnique: vi.fn().mockResolvedValue(mockOrder),
        },
        refundRequest: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn().mockImplementation(async (callback) => {
          const tx = {
            orderItem: { update: vi.fn().mockResolvedValue({}) },
            productVariant: { update: vi.fn().mockResolvedValue({}) },
            inventoryMovement: {
              findMany: vi.fn().mockResolvedValue([]),
              create: vi.fn().mockResolvedValue({}),
            },
            refundRequest: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue({
                id: "ref_new_1",
                refundNumber: "REF-REC-001",
                status: "APPROVED",
                amountPaise: 5500,
              }),
            },
            orderSellerSplit: { update: vi.fn().mockResolvedValue({}) },
            auditLog: { create: vi.fn().mockResolvedValue({}) },
          };
          return callback(tx);
        }),
      },
    };

    const service = new ReturnsService(
      mockPrisma as unknown as PrismaService,
      {} as unknown as CustomersService,
      {} as unknown as SellerLedgerService,
      {} as unknown as NotificationsService,
      {} as unknown as ExpoPushService,
      {} as never,
    );

    vi.spyOn(service, "initiateRefund").mockResolvedValue({
      refundNumber: "REF-REC-001",
      status: "PROCESSING",
    } as never);

    const result = await service.reconcileUnrefundedCancelledOrder(
      { id: "a1111111-1111-1111-1111-111111111111", role: "ADMIN" } as never,
      "ORD-REC-001",
      { autoInitiate: true },
    );

    expect(result.orderNumber).toBe("ORD-REC-001");
    expect(result.refundNumber).toMatch(/^1HI-RFD-/);
    expect(result.reconciled).toBe(true);
    expect(result.initiated).toBe(true);
  });
});
