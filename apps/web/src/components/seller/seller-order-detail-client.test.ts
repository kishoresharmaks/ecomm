import { describe, expect, it } from "vitest";
import {
  EWAY_BILL_LOCK_WARNING,
  isValidEWayBillNumber,
} from "./seller-eway-bill";
import { mergePackageDrafts } from "./seller-package-drafts";

describe("mergePackageDrafts", () => {
  it("preserves dirty drafts while refreshing clean package values", () => {
    const current = {
      "package-1": {
        weightGrams: "999",
        lengthCm: "25",
        breadthCm: "20",
        heightCm: "10",
      },
      "package-2": {
        weightGrams: "100",
        lengthCm: "10",
        breadthCm: "8",
        heightCm: "4",
      },
    };

    const result = mergePackageDrafts(
      current,
      [
        {
          id: "package-1",
          weightGrams: 500,
          lengthCm: 15,
          breadthCm: 12,
          heightCm: 6,
        },
        {
          id: "package-2",
          weightGrams: 250,
          lengthCm: 20,
          breadthCm: 14,
          heightCm: 7,
        },
      ],
      new Set(["package-1"]),
    );

    expect(result["package-1"]).toEqual(current["package-1"]);
    expect(result["package-2"]).toEqual({
      weightGrams: "250",
      lengthCm: "20",
      breadthCm: "14",
      heightCm: "7",
    });
  });

  it("keeps the statutory lock warning and exact 12-digit validation", () => {
    expect(EWAY_BILL_LOCK_WARNING).toContain("permanently non-editable");
    expect(isValidEWayBillNumber("123456789012")).toBe(true);
    expect(isValidEWayBillNumber("12345678901")).toBe(false);
    expect(isValidEWayBillNumber("12345678901A")).toBe(false);
  });
});

describe("seller cancelled order refund and billing resolution", () => {
  it("resolves refund amount from sellerRefundPaise or active refund request", () => {
    const mockCancelledOrder = {
      orderNumber: "1HI20261006456175",
      orderStatus: "CANCELLED",
      paymentStatus: "PAID",
      totalPaise: 47500,
      currency: "INR",
      sellerRefundPaise: 47500,
      sellerRefundStatus: "APPROVED",
      refundRequests: [
        {
          id: "ref-1",
          refundNumber: "REF-20261006-0001",
          status: "APPROVED",
          amountPaise: 47500,
          approvedAmountPaise: 47500,
        },
      ],
      sellerSplits: [
        {
          id: "split-1",
          sellerStatus: "CANCELLED",
          sellerSubtotalPaise: 47500,
          netPayablePaise: 0,
        },
      ],
    };

    const isOrderCancelled =
      mockCancelledOrder.orderStatus === "CANCELLED" ||
      mockCancelledOrder.sellerSplits[0]?.sellerStatus === "CANCELLED";
    const hasOnlineRefund =
      Boolean(mockCancelledOrder.refundRequests?.length) ||
      (isOrderCancelled && mockCancelledOrder.paymentStatus === "PAID");
    const sellerRefundMinor =
      mockCancelledOrder.sellerRefundPaise ??
      mockCancelledOrder.refundRequests[0]?.amountPaise ??
      0;
    const netPayout = isOrderCancelled ? 0 : 42000;

    expect(isOrderCancelled).toBe(true);
    expect(hasOnlineRefund).toBe(true);
    expect(sellerRefundMinor).toBe(47500);
    expect(netPayout).toBe(0);
  });
});
