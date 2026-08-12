import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const locationFieldsSource = readFileSync(new URL("./location-fields.tsx", import.meta.url), "utf8");
const checkoutPageSource = readFileSync(
  new URL("../storefront/checkout-page-client.tsx", import.meta.url),
  "utf8"
);

describe("location fields catalog boundary", () => {
  it("surfaces location API failures instead of rendering dead dropdowns", () => {
    expect(locationFieldsSource).toContain("Location options could not be loaded.");
    expect(locationFieldsSource).toContain("Retry location options");
    expect(locationFieldsSource).toContain("locationCatalogError");
  });

  it("isolates SelectField and AreaSearchField in dedicated z-index stacking contexts", () => {
    expect(locationFieldsSource).toContain('<div className="relative z-10">');
    expect(locationFieldsSource).toContain('<div className="relative z-20">');
    expect(locationFieldsSource).toContain("absolute z-30");
  });

  it("prevents checkout form onChange from overwriting location state with stale FormData", () => {
    expect(checkoutPageSource).toContain("syncManualAddressFromForm");
    expect(checkoutPageSource).toContain("setManualAddress((current) => ({");
    expect(checkoutPageSource).toContain("...current,");
    expect(checkoutPageSource).not.toContain("setManualAddress(addressFromForm(new FormData(form)))");
  });
});

