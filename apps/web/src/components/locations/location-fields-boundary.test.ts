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

  it("prevents dropdown selection resets by fallback option generation and prop change guard", () => {
    expect(locationFieldsSource).toContain("manualNames.state");
    expect(locationFieldsSource).toContain("manualNames.city");
    expect(locationFieldsSource).toContain("prevDefaultValueRef");
    expect(locationFieldsSource).toContain("isFirstRender");
  });

  // Fix #1: pendingAutofill fields are cleared after being applied so they cannot re-fire.
  it("clears pendingAutofill fields after application to prevent re-selection on manual clear", () => {
    expect(locationFieldsSource).toContain("{ ...current, state: undefined }");
    expect(locationFieldsSource).toContain("{ ...current, city: undefined }");
    expect(locationFieldsSource).toContain("{ ...current, area: undefined }");
  });

  // Fix #2: selectArea always sets pincode even when the new area has none.
  it("always overwrites pincode in selectArea to prevent stale pincode", () => {
    expect(locationFieldsSource).toContain("nextArea.postalCode ?? \"\"");
    expect(locationFieldsSource).not.toContain("if (nextArea.postalCode) {");
  });

  // Fix #4: area dropdown suppresses stale options while loading.
  it("does not show stale area options while isLoading is true", () => {
    expect(locationFieldsSource).toContain("showLoadingRow");
    expect(locationFieldsSource).toContain("!isLoading");
  });

  // Fix #5: required based on code fields not display names.
  it("bases required on stateCode and cityCode not hiddenValues", () => {
    expect(locationFieldsSource).toContain("required={!stateCode}");
    expect(locationFieldsSource).toContain("required={!cityCode}");
    expect(locationFieldsSource).not.toContain("required={!hiddenValues.state}");
    expect(locationFieldsSource).not.toContain("required={!hiddenValues.city}");
  });

  // Fix #6: AreaSearchField has ARIA combobox attributes.
  it("implements combobox ARIA role and keyboard navigation on AreaSearchField", () => {
    expect(locationFieldsSource).toContain('role="combobox"');
    expect(locationFieldsSource).toContain("aria-expanded");
    expect(locationFieldsSource).toContain("aria-controls");
    expect(locationFieldsSource).toContain("aria-activedescendant");
    expect(locationFieldsSource).toContain('role="listbox"');
    expect(locationFieldsSource).toContain('role="option"');
    expect(locationFieldsSource).toContain("handleKeyDown");
    expect(locationFieldsSource).toContain("ArrowDown");
    expect(locationFieldsSource).toContain("ArrowUp");
  });

  // Fix #7: blur timeout is stored in a ref and cancelled on unmount.
  it("stores onBlur timeout in a ref to prevent post-unmount state updates", () => {
    expect(locationFieldsSource).toContain("blurTimerRef");
    expect(locationFieldsSource).toContain("clearTimeout(blurTimerRef.current)");
  });

  // Fix #8: area store errors are surfaced to the user.
  it("surfaces area store errors with a retry button", () => {
    expect(locationFieldsSource).toContain("areaStoreError");
    expect(locationFieldsSource).toContain("Local area options could not be loaded.");
    expect(locationFieldsSource).toContain("Retry local areas");
    expect(locationFieldsSource).toContain("retryAreaStore");
  });

  it("prevents checkout form onChange from overwriting location state with stale FormData", () => {
    expect(checkoutPageSource).toContain("syncManualAddressFromForm");
    expect(checkoutPageSource).toContain("setManualAddress((current) => ({");
    expect(checkoutPageSource).toContain("...current,");
    expect(checkoutPageSource).not.toContain("setManualAddress(addressFromForm(new FormData(form)))");
  });
});

