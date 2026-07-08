import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelRazorpayOrder,
  createRazorpayProviderOrder,
  getCheckoutSummary,
  placeOrder,
  verifyRazorpayPayment,
} from "./storefront-api";

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalFetch = globalThis.fetch;

describe("mobile Razorpay storefront API helpers", () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api";
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    globalThis.fetch = originalFetch;
  });

  it("creates a Razorpay provider order through the customer payment endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        keyId: "rzp_test_key",
        razorpayOrderId: "order_123",
        amountPaise: 350900,
        currency: "INR",
        orderNumber: "1HI/2026/001",
      }),
    );

    await createRazorpayProviderOrder({ bearerToken: "customer-token" }, "1HI/2026/001");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.com/api/payments/razorpay/orders/1HI%2F2026%2F001");
    expect(init).toMatchObject({
      method: "POST",
      body: "{}",
      headers: expect.objectContaining({
        Authorization: "Bearer customer-token",
        "Content-Type": "application/json",
      }),
    });
  });

  it("verifies Razorpay checkout signatures through the customer payment endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        received: true,
        paymentId: "payment-id",
        status: "PAID",
      }),
    );

    await verifyRazorpayPayment(
      { bearerToken: "customer-token" },
      {
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        razorpaySignature: "signature",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.com/api/payments/razorpay/verify");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pay_123",
        razorpaySignature: "signature",
      }),
      headers: expect.objectContaining({
        Authorization: "Bearer customer-token",
        "Content-Type": "application/json",
      }),
    });
  });

  it("cancels an unpaid Razorpay order through the customer payment endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        orderNumber: "1HI/2026/001",
        cancelled: true,
      }),
    );

    await cancelRazorpayOrder({ bearerToken: "customer-token" }, "1HI/2026/001");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.com/api/payments/razorpay/orders/1HI%2F2026%2F001/cancel");
    expect(init).toMatchObject({
      method: "PATCH",
      body: "{}",
      headers: expect.objectContaining({
        Authorization: "Bearer customer-token",
        "Content-Type": "application/json",
      }),
    });
  });

  it("sends checkout idempotency keys when placing customer orders", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        orderNumber: "1HI/2026/002",
        totalPaise: 11200,
        currency: "INR",
        paymentStatus: "PENDING",
      }),
    );

    await placeOrder(
      { bearerToken: "customer-token" },
      {
        buyerCountryCode: "IN",
        deliveryPreference: "DELIVER_TO_ADDRESS",
        idempotencyKey: "mobile_cart_abc12345",
        paymentMethod: "RAZORPAY",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.example.com/api/account/orders");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        buyerCountryCode: "IN",
        deliveryPreference: "DELIVER_TO_ADDRESS",
        idempotencyKey: "mobile_cart_abc12345",
        paymentMethod: "RAZORPAY",
      }),
      headers: expect.objectContaining({
        Authorization: "Bearer customer-token",
        "Content-Type": "application/json",
      }),
    });
  });

  it("sends coupon codes to checkout summary and order placement", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          buyerCountryCode: "AE",
          buyerCurrency: "AED",
          buyerTotalMinor: 4200,
          coupon: { code: "SAVE10", couponId: "coupon_1", title: "Save 10" },
          couponDiscountPaise: 1000,
          currency: "INR",
          itemCount: 1,
          platformFeePaise: 0,
          shippingPaise: 0,
          subtotalPaise: 12000,
          totalPaise: 11000,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          orderNumber: "1HI/2026/003",
          totalPaise: 11000,
          currency: "INR",
          paymentStatus: "PENDING",
        }),
      );

    await getCheckoutSummary(
      { bearerToken: "customer-token" },
      {
        buyerCountryCode: "AE",
        couponCode: "SAVE10",
        deliveryPreference: "DELIVER_TO_ADDRESS",
        paymentMethod: "COD",
      },
    );
    await placeOrder(
      { bearerToken: "customer-token" },
      {
        buyerCountryCode: "AE",
        couponCode: "SAVE10",
        deliveryPreference: "DELIVER_TO_ADDRESS",
        idempotencyKey: "mobile_cart_coupon",
        paymentMethod: "COD",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [summaryUrl] = fetchMock.mock.calls[0] ?? [];
    expect(String(summaryUrl)).toContain("couponCode=SAVE10");
    expect(String(summaryUrl)).toContain("buyerCountryCode=AE");

    const [, orderInit] = fetchMock.mock.calls[1] ?? [];
    expect(orderInit).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        buyerCountryCode: "AE",
        couponCode: "SAVE10",
        deliveryPreference: "DELIVER_TO_ADDRESS",
        idempotencyKey: "mobile_cart_coupon",
        paymentMethod: "COD",
      }),
    });
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
