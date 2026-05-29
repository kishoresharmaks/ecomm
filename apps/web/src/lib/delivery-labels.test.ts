import { describe, expect, it } from "vitest";
import { customerDeliveryModeLabel, customerDeliveryOptions } from "./delivery-labels";

describe("customer delivery labels", () => {
  it("shows only customer-facing delivery options at checkout", () => {
    expect(customerDeliveryOptions.map((option) => option.label)).toEqual([
      "Store pickup",
      "Deliver to address"
    ]);
  });

  it("shows the three supported delivery modes clearly", () => {
    expect(customerDeliveryModeLabel("LOCAL_DELIVERY_PARTNER")).toBe("Local delivery partner");
    expect(customerDeliveryModeLabel("STORE_PICKUP")).toBe("Store pickup");
    expect(customerDeliveryModeLabel("THIRD_PARTY_COURIER")).toBe("Courier delivery");
  });

  it("keeps legacy delivery modes readable for old order records", () => {
    expect(customerDeliveryModeLabel("MANUAL_COURIER")).toBe("Courier delivery");
    expect(customerDeliveryModeLabel("SELLER_SELF_DELIVERY")).toBe("Local delivery partner");
  });
});
