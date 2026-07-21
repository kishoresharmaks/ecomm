import { describe, expect, it } from "vitest";
import { formatGstAddress, humanizeGstValue } from "./gst-document-presentation";

describe("GST document presentation", () => {
  it("formats only populated immutable recipient address fields", () => {
    expect(
      formatGstAddress({
        line1: "2 Trade Road",
        line2: "",
        area: "Fort",
        city: "Mumbai",
        state: "Maharashtra",
        stateCode: "27",
        postalCode: "400001",
        country: "India",
        countryCode: "IN",
      }),
    ).toBe("2 Trade Road, Fort, Mumbai, Maharashtra, 400001, India");
  });

  it("handles absent address data and readable enum labels", () => {
    expect(formatGstAddress(undefined)).toBe("Not recorded");
    expect(
      formatGstAddress({
        line1: "",
        line2: "",
        area: "",
        city: "",
        state: "",
        stateCode: "",
        postalCode: "",
        country: "",
        countryCode: "",
      }),
    ).toBe("Not recorded");
    expect(humanizeGstValue("BILL_OF_SUPPLY")).toBe("Bill Of Supply");
  });
});
