import { describe, expect, it } from "vitest";
import {
  buildAdminLocationServiceabilityPath,
  serviceabilityLabel,
  serviceabilityTone
} from "./admin-location-serviceability-utils";

describe("admin location serviceability helpers", () => {
  it("builds a normalized admin serviceability path", () => {
    expect(
      buildAdminLocationServiceabilityPath({
        countryCode: " IN ",
        stateCode: " IN-TN ",
        cityCode: " IN-TN-CBE ",
        pincode: " 641012 ",
        localAreaCode: " IN-TN-CBE-RS ",
        subtotalPaise: 99949.7,
        paymentMethod: "COD"
      })
    ).toBe(
      "/api/admin/locations/serviceability?countryCode=IN&stateCode=IN-TN&cityCode=IN-TN-CBE&pincode=641012&localAreaCode=IN-TN-CBE-RS&paymentMethod=COD&subtotalPaise=99950"
    );
  });

  it("uses safe defaults for quick India COD checks", () => {
    expect(buildAdminLocationServiceabilityPath({})).toBe(
      "/api/admin/locations/serviceability?countryCode=IN&paymentMethod=COD"
    );
  });

  it("maps summary status to admin badge tone and readable labels", () => {
    expect(serviceabilityTone("READY")).toBe("success");
    expect(serviceabilityTone("PARTIAL")).toBe("warning");
    expect(serviceabilityTone("NOT_SERVICEABLE")).toBe("danger");
    expect(serviceabilityLabel("NOT_SERVICEABLE")).toBe("NOT SERVICEABLE");
  });
});
