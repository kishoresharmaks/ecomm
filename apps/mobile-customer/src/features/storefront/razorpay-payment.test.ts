import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileApiError } from "../../lib/api";

const secureStoreMock = vi.hoisted(() => ({
  store: new Map<string, string>(),
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(secureStoreMock.store.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStoreMock.store.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    secureStoreMock.store.delete(key);
    return Promise.resolve();
  }),
}));

import {
  RAZORPAY_CHECKOUT_CANCELLED_ERROR,
  RAZORPAY_CHECKOUT_TIMEOUT_ERROR,
  RAZORPAY_SESSION_MAX_AGE_MS,
  MobileRazorpayPaymentError,
  buildRazorpayCheckoutOptions,
  canRetryRazorpayPayment,
  clearRazorpayPaymentSession,
  isPaidRazorpayStatus,
  isRazorpayActionInFlight,
  isTransientRazorpayProviderOrderError,
  markRazorpayPaymentSessionStatus,
  razorpayStatusRetryMessage,
  recoverRazorpayPaymentSession,
  runWithRazorpayTimeout,
  saveRazorpayPaymentSession,
} from "./razorpay-payment";

describe("mobile Razorpay payment helpers", () => {
  beforeEach(() => {
    secureStoreMock.store.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds native checkout options with order metadata and customer prefill", () => {
    expect(
      buildRazorpayCheckoutOptions(
        {
          keyId: "rzp_test_key",
          razorpayOrderId: "order_123",
          amountPaise: 11200,
          currency: "INR",
          orderNumber: "1HI20260613001",
        },
        {
          email: " customer@example.com ",
          phone: "+91 98765 43210",
          fullName: " Kishore ",
        },
      ),
    ).toEqual({
      key: "rzp_test_key",
      amount: 11200,
      currency: "INR",
      name: "1HandIndia",
      description: "Order 1HI20260613001",
      order_id: "order_123",
      prefill: {
        email: "customer@example.com",
        contact: "919876543210",
        name: "Kishore",
      },
      notes: {
        orderNumber: "1HI20260613001",
        source: "mobile-customer",
      },
      theme: {
        color: "#ED3500",
      },
    });
  });

  it("detects retryable pending Razorpay payments", () => {
    const now = new Date("2026-06-13T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(
      canRetryRazorpayPayment({
        createdAt: "2026-06-13T09:30:00.000Z",
        paymentStatus: "PENDING",
        payments: [
          {
            id: "payment",
            method: "RAZORPAY",
            provider: "RAZORPAY",
            status: "PENDING",
            createdAt: "2026-06-13T09:45:00.000Z",
          },
        ],
      }),
    ).toBe(true);
    expect(
      canRetryRazorpayPayment({
        createdAt: "2026-06-13T09:30:00.000Z",
        paymentStatus: "PAID",
        payments: [{ id: "payment", method: "RAZORPAY", provider: "RAZORPAY", status: "PAID" }],
      }),
    ).toBe(false);
    expect(
      canRetryRazorpayPayment({
        createdAt: "2026-06-13T08:30:00.000Z",
        paymentStatus: "PENDING",
        payments: [{ id: "payment", method: "RAZORPAY", provider: "RAZORPAY", status: "PENDING" }],
      }),
    ).toBe(false);
  });

  it("keeps duplicate payment actions blocked while either flow is pending", () => {
    expect(isRazorpayActionInFlight(true, false)).toBe(true);
    expect(isRazorpayActionInFlight(false, true)).toBe(true);
    expect(isRazorpayActionInFlight(false, false)).toBe(false);
  });

  it("normalizes paid statuses and retry copy", () => {
    expect(isPaidRazorpayStatus("PAID")).toBe(true);
    expect(isPaidRazorpayStatus("captured")).toBe(true);
    expect(isPaidRazorpayStatus("PENDING")).toBe(false);
    expect(razorpayStatusRetryMessage("PENDING")).toBe(
      "Order placed, but online payment is Pending. Please retry payment from your order.",
    );
  });

  it("times out a hanging native Razorpay checkout promise", async () => {
    vi.useFakeTimers();
    const result = runWithRazorpayTimeout(new Promise(() => undefined), 1000).catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(1000);

    await expect(result).resolves.toMatchObject({
      stage: "checkout",
      message: RAZORPAY_CHECKOUT_TIMEOUT_ERROR,
    });
  });

  it("clears the timeout when native Razorpay resolves before the deadline", async () => {
    vi.useFakeTimers();
    const result = runWithRazorpayTimeout(Promise.resolve("paid"), 1000);

    await expect(result).resolves.toBe("paid");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe("paid");
  });

  it("stores, updates, expires, and clears a recoverable payment session", async () => {
    const startTime = Date.parse("2026-06-13T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(startTime);

    await saveRazorpayPaymentSession({
      amountPaise: 11200,
      currency: "INR",
      lastUpdated: startTime,
      orderNumber: "1HI20260613001",
      razorpayOrderId: "order_123",
      retryCount: 0,
      startTime,
      status: "pending",
    });

    await expect(recoverRazorpayPaymentSession(startTime + 1000)).resolves.toMatchObject({
      orderNumber: "1HI20260613001",
      razorpayOrderId: "order_123",
      status: "pending",
    });

    await markRazorpayPaymentSessionStatus("timed_out");
    await expect(recoverRazorpayPaymentSession(startTime + 2000)).resolves.toMatchObject({
      retryCount: 1,
      status: "timed_out",
    });

    await expect(recoverRazorpayPaymentSession(startTime + RAZORPAY_SESSION_MAX_AGE_MS + 1)).resolves.toBeNull();

    await saveRazorpayPaymentSession({
      amountPaise: 11200,
      currency: "INR",
      lastUpdated: startTime,
      orderNumber: "1HI20260613001",
      razorpayOrderId: "order_123",
      retryCount: 0,
      startTime,
      status: "pending",
    });
    await clearRazorpayPaymentSession();
    await expect(recoverRazorpayPaymentSession(startTime + 1000)).resolves.toBeNull();
  });

  it("classifies provider order retry errors conservatively", () => {
    expect(isTransientRazorpayProviderOrderError(new MobileApiError("offline", 0))).toBe(true);
    expect(isTransientRazorpayProviderOrderError(new MobileApiError("rate limited", 429))).toBe(true);
    expect(isTransientRazorpayProviderOrderError(new MobileApiError("server", 500))).toBe(true);
    expect(isTransientRazorpayProviderOrderError(new MobileApiError("bad request", 400))).toBe(false);
  });

  it("keeps payment error codes and helper methods explicit", () => {
    const cancelled = new MobileRazorpayPaymentError("checkout", RAZORPAY_CHECKOUT_CANCELLED_ERROR, {
      code: "PAYMENT_CANCELLED",
      orderNumber: "1HI20260613001",
      razorpayOrderId: "order_123",
    });

    expect(cancelled.isUserCancelled()).toBe(true);
    expect(cancelled.isTimeout()).toBe(false);
    expect(cancelled).toMatchObject({
      code: "PAYMENT_CANCELLED",
      orderNumber: "1HI20260613001",
      razorpayOrderId: "order_123",
    });
  });
});
