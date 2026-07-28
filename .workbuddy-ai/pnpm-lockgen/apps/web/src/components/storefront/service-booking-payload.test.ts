import { describe, expect, it } from "vitest";
import {
  buildCustomerServiceBookingPayload,
  hasManualServiceLocationInput,
  isManualServiceLocationReadyForQuery,
  serviceLocationQueryFromAddress,
  serviceLocationQueryFromManualAddress,
} from "./service-booking-payload";
import type { CustomerAddress } from "@/lib/account-api";

describe("service booking payload helpers", () => {
  it("does not send an address for remote or provider-location bookings", () => {
    const remote = buildCustomerServiceBookingPayload({
      serviceSlug: "washing-machine-repair",
      visitMode: "REMOTE",
      customerIssue: "Issue with water supply in the machine.",
      selectedAddress: savedAddress(),
      manualAddress: { city: "Salem", state: "Tamil Nadu", pincode: "636114", countryCode: "IN" },
    });
    const providerLocation = buildCustomerServiceBookingPayload({
      serviceSlug: "washing-machine-repair",
      visitMode: "PROVIDER_LOCATION",
      customerIssue: "Issue with water supply in the machine.",
      selectedAddress: savedAddress(),
      manualAddress: { city: "Salem", state: "Tamil Nadu", pincode: "636114", countryCode: "IN" },
    });

    expect(remote).not.toHaveProperty("addressId");
    expect(remote).not.toHaveProperty("addressSnapshot");
    expect(providerLocation).not.toHaveProperty("addressId");
    expect(providerLocation).not.toHaveProperty("addressSnapshot");
  });

  it("uses the selected saved address for customer-location bookings", () => {
    expect(
      buildCustomerServiceBookingPayload({
        serviceSlug: "washing-machine-repair",
        visitMode: "CUSTOMER_LOCATION",
        customerIssue: "Issue with water supply in the machine.",
        selectedAddress: savedAddress(),
        manualAddress: { city: "Salem", state: "Tamil Nadu", pincode: "636114", countryCode: "IN" },
      }),
    ).toMatchObject({
      serviceSlug: "washing-machine-repair",
      visitMode: "CUSTOMER_LOCATION",
      addressId: "address-1",
    });
  });

  it("uses manual address details when no saved address is selected", () => {
    expect(
      buildCustomerServiceBookingPayload({
        serviceSlug: "washing-machine-repair",
        visitMode: "CUSTOMER_LOCATION",
        customerIssue: "Issue with water supply in the machine.",
        selectedAddress: null,
        manualAddress: { city: " Salem ", state: " Tamil Nadu ", pincode: " 636114 ", countryCode: "" },
      }),
    ).toMatchObject({
      addressSnapshot: {
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636114",
        countryCode: "IN",
      },
    });
  });

  it("builds availability query params from saved and manual locations", () => {
    expect(serviceLocationQueryFromAddress(savedAddress())).toEqual({
      countryCode: "IN",
      stateCode: "IN-TN",
      cityCode: "IN-TN-SLM",
      localAreaCode: "IN-TN-SLM-FAIRLANDS",
      pincode: "636016",
    });
    expect(serviceLocationQueryFromManualAddress({ city: "Salem", state: "Tamil Nadu", pincode: "636114", countryCode: "IN" })).toEqual({
      countryCode: "IN",
      pincode: "636114",
    });
    expect(serviceLocationQueryFromManualAddress({ city: "Salem", state: "Tamil Nadu", pincode: "63", countryCode: "IN" })).toEqual({});
    expect(serviceLocationQueryFromManualAddress({ city: "Salem", state: "Tamil Nadu", pincode: "", countryCode: "IN" })).toEqual({});
  });

  it("waits for a complete manual pincode before serviceability checks", () => {
    expect(hasManualServiceLocationInput({ city: "", state: "", pincode: "", countryCode: "IN" })).toBe(false);
    expect(hasManualServiceLocationInput({ city: "Salem", state: "", pincode: "", countryCode: "IN" })).toBe(true);
    expect(isManualServiceLocationReadyForQuery({ city: "Salem", state: "Tamil Nadu", pincode: "6361", countryCode: "IN" })).toBe(false);
    expect(isManualServiceLocationReadyForQuery({ city: "Salem", state: "Tamil Nadu", pincode: "636114", countryCode: "IN" })).toBe(true);
  });
});

function savedAddress(): CustomerAddress {
  return {
    id: "address-1",
    customerId: "customer-1",
    fullName: "Customer",
    phone: "9876543210",
    line1: "14 Fairlands Road",
    area: "Fairlands",
    city: "Salem",
    state: "Tamil Nadu",
    pincode: "636016",
    country: "India",
    countryCode: "IN",
    stateCode: "IN-TN",
    cityCode: "IN-TN-SLM",
    localAreaCode: "IN-TN-SLM-FAIRLANDS",
    isDefault: true,
  };
}
