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
});
