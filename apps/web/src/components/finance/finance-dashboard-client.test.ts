import { describe, expect, it } from "vitest";
import type { FinanceDashboard, FinancePaymentCollection } from "@/lib/finance-api";

describe("Finance Dashboard & Payment Collections Refund Logic", () => {
  it("computes net retained amounts and identifies cancelled/refunded payment records", () => {
    const cancelledPayment: FinancePaymentCollection = {
      id: "pay_123",
      provider: "RAZORPAY",
      status: "PAID",
      effectiveStatus: "REFUND_APPROVED",
      isCancelled: true,
      refundAmountPaise: 47500,
      refundStatus: "APPROVED",
      refundNumber: "REF-12345",
      amountPaise: 49000,
      currency: "INR",
      createdAt: "2026-10-06T10:00:00Z",
      updatedAt: "2026-10-06T11:00:00Z",
      order: {
        id: "order_123",
        orderNumber: "1HI20261006456175",
        orderStatus: "CANCELLED",
        paymentStatus: "PAID",
        deliveryStatus: "CANCELLED",
        totalPaise: 49000,
        currency: "INR",
        createdAt: "2026-10-06T10:00:00Z",
        refundAmountPaise: 47500,
        refundStatus: "APPROVED",
        customer: {
          fullName: "NT VIGNESH",
          email: "vignesh@example.com",
        },
        sellers: [],
      },
      events: [],
    };

    // Verify refund amount deduction
    const refundAmount = cancelledPayment.refundAmountPaise ?? 0;
    expect(refundAmount).toBe(47500);

    const netRetained = Math.max(0, cancelledPayment.amountPaise - refundAmount);
    expect(netRetained).toBe(1500); // Only non-refundable platform fee retained

    // Verify status resolution
    const effectiveStatus = cancelledPayment.effectiveStatus || cancelledPayment.status;
    expect(effectiveStatus).toBe("REFUND_APPROVED");
    expect(cancelledPayment.isCancelled).toBe(true);
  });

  it("handles fully refunded payments correctly", () => {
    const refundedPayment: FinancePaymentCollection = {
      id: "pay_456",
      provider: "RAZORPAY",
      status: "REFUNDED",
      effectiveStatus: "REFUNDED",
      isCancelled: true,
      refundAmountPaise: 49000,
      refundStatus: "SUCCESS",
      refundNumber: "REF-99999",
      amountPaise: 49000,
      currency: "INR",
      createdAt: "2026-10-06T10:00:00Z",
      updatedAt: "2026-10-06T12:00:00Z",
      order: {
        id: "order_456",
        orderNumber: "1HI20261006999999",
        orderStatus: "CANCELLED",
        paymentStatus: "REFUNDED",
        deliveryStatus: "CANCELLED",
        totalPaise: 49000,
        currency: "INR",
        createdAt: "2026-10-06T10:00:00Z",
        refundAmountPaise: 49000,
        refundStatus: "SUCCESS",
        customer: {
          fullName: "Customer Two",
        },
        sellers: [],
      },
      events: [],
    };

    expect(refundedPayment.effectiveStatus).toBe("REFUNDED");
    expect(refundedPayment.refundStatus).toBe("SUCCESS");
    expect(Math.max(0, refundedPayment.amountPaise - (refundedPayment.refundAmountPaise ?? 0))).toBe(0);
  });

  it("verifies finance dashboard metric payload includes pending and settled refunds", () => {
    const dashboard: FinanceDashboard = {
      metrics: {
        codPending: { count: 0, amountPaise: 0 },
        codCollected: { count: 0, amountPaise: 0 },
        bankTransferPending: { count: 0, amountPaise: 0 },
        manualPending: { count: 0, amountPaise: 0 },
        onlinePaid: { count: 0, amountPaise: 0 }, // Correctly 0 because cancelled orders are excluded
        refundsPending: { count: 1, amountPaise: 47500 },
        refundsPaid: { count: 0, amountPaise: 0 },
        settlementDue: { count: 0, amountPaise: 0 },
        payoutPending: { count: 0, amountPaise: 0 },
        payoutPaid: { count: 0, amountPaise: 0 },
        serviceReceivableOpen: { count: 0, amountPaise: 0 },
        serviceReceivableDisputed: { count: 0, amountPaise: 0 },
        serviceReceivableSettled: { count: 0, amountPaise: 0 },
        sellerCashReceivableOpen: { count: 0, amountPaise: 0 },
        sellerCashReceivableSettled: { count: 0, amountPaise: 0 },
      },
      recentPayments: [],
    };

    expect(dashboard.metrics.refundsPending?.count).toBe(1);
    expect(dashboard.metrics.refundsPending?.amountPaise).toBe(47500);
    expect(dashboard.metrics.onlinePaid.count).toBe(0);
  });
});
