import { describe, expect, it } from "vitest";
import {
  cleanBookingPayload,
  cleanCancellationPayload,
  cleanDisputePayload,
  cleanReviewPayload,
} from "./payloadCleaners";
import type { MobileServiceBookingFormValues } from "../types";

const addressSnapshot = {
  fullName: "Krish",
  phone: "9999999999",
  line1: "Main Road",
  city: "Salem",
  state: "Tamil Nadu",
  pincode: "636001",
  country: "India",
  countryCode: "IN",
};

const baseBooking: MobileServiceBookingFormValues = {
  idempotencyKey: "mobile_service_test_abc123456789",
  serviceSlug: "tv-repair",
  selectedPackageId: null,
  visitMode: "customer_location",
  savedAddressId: null,
  addressSnapshot,
  preferredDate: null,
  preferredTimeSlot: null,
  customerIssue: "The television turns on but the screen stays blank.",
  customerNote: "Call before arrival.",
};

describe("payload cleaners", () => {
  it("strips address data for remote mode", () => {
    const payload = cleanBookingPayload({ ...baseBooking, visitMode: "remote" });
    expect(payload.visitMode).toBe("REMOTE");
    expect(payload).not.toHaveProperty("addressId");
    expect(payload).not.toHaveProperty("addressSnapshot");
  });

  it("strips address data for provider location mode", () => {
    const payload = cleanBookingPayload({ ...baseBooking, visitMode: "provider_location" });
    expect(payload.visitMode).toBe("PROVIDER_LOCATION");
    expect(payload).not.toHaveProperty("addressSnapshot");
  });

  it("requires address data for customer location", () => {
    expect(() => cleanBookingPayload({ ...baseBooking, addressSnapshot: null })).toThrow("Select or enter a service address.");
  });

  it("uses saved address id for customer location", () => {
    const payload = cleanBookingPayload({ ...baseBooking, savedAddressId: "address-1", addressSnapshot: null });
    expect(payload.addressId).toBe("address-1");
    expect(payload).not.toHaveProperty("addressSnapshot");
  });

  it("maps package and scheduled date/time", () => {
    const payload = cleanBookingPayload({
      ...baseBooking,
      selectedPackageId: "pkg-1",
      preferredDate: "2026-07-01",
      preferredTimeSlot: "10:00-12:00",
    });
    expect(payload.servicePackageId).toBe("pkg-1");
    expect(payload.scheduledStartAt).toContain("2026-07-01");
  });

  it("includes idempotency key when provided", () => {
    expect(cleanBookingPayload(baseBooking).idempotencyKey).toBe("mobile_service_test_abc123456789");
  });

  it("cleans dispute payload", () => {
    expect(cleanDisputePayload({ selectedReason: "Quality issue", description: "Not fixed", rawEvidence: "a, b" })).toEqual({
      reason: "Quality issue - Not fixed",
      evidence: ["a", "b"],
    });
  });

  it("validates cancellation reason", () => {
    expect(() => cleanCancellationPayload({ reason: " no " })).toThrow();
    expect(cleanCancellationPayload({ reason: " valid " })).toEqual({ reason: "valid" });
  });

  it("validates review payload", () => {
    expect(() => cleanReviewPayload({ rating: 0 })).toThrow();
    expect(() => cleanReviewPayload({ rating: 6 })).toThrow();
    expect(cleanReviewPayload({ rating: 5, body: "  " })).toEqual({ rating: 5 });
  });
});
