import { describe, expect, it } from "vitest";
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
  );
  return service as unknown as {
    firstTrimmedString: (...values: Array<string | undefined>) => string | undefined;
    trimmedStringOrUndefined: (value: string | undefined) => string | undefined;
    itemPolicyAllowsReturn: (snapshot: unknown) => boolean;
    returnLine: (
      item: Record<string, unknown>,
      quantity: number,
      pendingByOrderItem: Map<string, number>,
      orderSellerSplitId: string,
    ) => { quantity: number; buyerRefundPaise: number };
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

    expect(service.itemPolicyAllowsReturn({ returnEligibility: "Non-returnable" })).toBe(false);
    expect(service.itemPolicyAllowsReturn({ returnPolicy: "Returnable within 7 days" })).toBe(true);
    expect(service.itemPolicyAllowsReturn(null)).toBe(true);
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
    );

    expect(line.quantity).toBe(1);
    expect(line.buyerRefundPaise).toBe(1000);
  });
});
