import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../lib/mobile-telemetry", () => ({
  captureMobileException: vi.fn(),
  trackMobileEvent: vi.fn(),
}));

import {
  SERVICE_RAZORPAY_SESSION_MAX_AGE_MS,
  buildServiceRazorpayCheckoutOptions,
  canRetryServiceRazorpayPayment,
  clearServiceRazorpayPaymentSession,
  isServiceRazorpayVerificationPendingForPayment,
  recoverServiceRazorpayPaymentSession,
  saveServiceRazorpayPaymentSession,
} from "./service-razorpay-payment";
import type { MobileServiceBooking, MobileServicePayment } from "./types";

describe("mobile service Razorpay payment helpers", () => {
  beforeEach(() => {
    secureStoreMock.store.clear();
  });

  it("builds checkout options with service booking metadata", () => {
    expect(
      buildServiceRazorpayCheckoutOptions(
        {
          keyId: "rzp_test_key",
          razorpayOrderId: "order_123",
          amountPaise: 50000,
          currency: "INR",
          bookingNumber: "SRV-2026-ABCDEF",
          servicePaymentId: "service_payment_1",
          purpose: "FULL_PAYMENT",
        },
        {
          email: " customer@example.com ",
          phone: "+91 98765 43210",
          fullName: " Kishore ",
        },
      ),
    ).toEqual({
      key: "rzp_test_key",
      amount: 50000,
      currency: "INR",
      name: "1HandIndia",
      description: "Service booking SRV-2026-ABCDEF",
      order_id: "order_123",
      prefill: {
        email: "customer@example.com",
        contact: "919876543210",
        name: "Kishore",
      },
      notes: {
        bookingNumber: "SRV-2026-ABCDEF",
        purpose: "FULL_PAYMENT",
        servicePaymentId: "service_payment_1",
        source: "mobile-customer",
      },
      theme: {
        color: "#ED3500",
      },
    });
  });

  it("detects retryable service Razorpay payments without allowing obsolete balance", () => {
    const booking = serviceBooking({ totalPayablePaise: 50000, paidAmountPaise: 10000 });
    expect(canRetryServiceRazorpayPayment(booking, servicePayment({ amountPaise: 40000 }))).toBe(true);
    expect(canRetryServiceRazorpayPayment(booking, servicePayment({ amountPaise: 45000 }))).toBe(false);
    expect(canRetryServiceRazorpayPayment(booking, servicePayment({ status: "paid" }))).toBe(false);
  });

  it("stores checkout-success sessions for verification recovery", async () => {
    const startTime = Date.parse("2026-06-13T10:00:00.000Z");
    const session = {
      amountPaise: 50000,
      bookingNumber: "SRV-2026-ABCDEF",
      currency: "INR",
      lastUpdated: startTime,
      razorpayOrderId: "order_123",
      razorpayPaymentId: "pay_123",
      razorpaySignature: "signature",
      retryCount: 0,
      servicePaymentId: "service_payment_1",
      startTime,
      status: "checkout_succeeded_verification_pending" as const,
    };

    await saveServiceRazorpayPaymentSession(session);

    const recovered = await recoverServiceRazorpayPaymentSession(startTime + 1000);
    expect(recovered).toMatchObject({
      bookingNumber: "SRV-2026-ABCDEF",
      servicePaymentId: "service_payment_1",
      status: "checkout_succeeded_verification_pending",
    });
    expect(isServiceRazorpayVerificationPendingForPayment(recovered, "SRV-2026-ABCDEF", "service_payment_1")).toBe(true);
    await expect(recoverServiceRazorpayPaymentSession(startTime + SERVICE_RAZORPAY_SESSION_MAX_AGE_MS + 1)).resolves.toBeNull();
    await clearServiceRazorpayPaymentSession();
    await expect(recoverServiceRazorpayPaymentSession(startTime + 1000)).resolves.toBeNull();
  });
});

function serviceBooking(overrides: Partial<MobileServiceBooking> = {}): MobileServiceBooking {
  return {
    id: "booking_1",
    bookingNumber: "SRV-2026-ABCDEF",
    serviceSlug: "ac-repair",
    serviceName: "AC repair",
    packageId: null,
    packageName: null,
    status: "requested",
    visitMode: "customer_location",
    scheduledStartAt: null,
    scheduledEndAt: null,
    location: null,
    customerIssue: "Cooling issue",
    customerNote: null,
    providerName: "Provider",
    pricingModel: "fixed_price",
    subtotalPaise: 50000,
    inspectionFeePaise: 0,
    advanceAmountPaise: 0,
    totalPayablePaise: 50000,
    paidAmountPaise: 0,
    currency: "INR",
    quote: null,
    payments: [],
    dispute: null,
    review: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function servicePayment(overrides: Partial<MobileServicePayment> = {}): MobileServicePayment {
  return {
    id: "service_payment_1",
    amountPaise: 40000,
    currency: "INR",
    status: "pending",
    provider: "RAZORPAY",
    purpose: "FULL_PAYMENT",
    collectionType: null,
    cashCollectionStatus: null,
    providerOrderId: null,
    providerPaymentId: null,
    referenceNumber: null,
    paidAt: null,
    createdAt: null,
    description: null,
    ...overrides,
  };
}
