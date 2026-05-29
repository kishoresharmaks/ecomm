import { describe, expect, it } from "vitest";
import {
  browsingLocationHeadline,
  browsingLocationLabel,
  browsingLocationQuery,
  defaultBrowsingLocationFromAddresses,
  locationMatchLabel,
  splitStoresByLocationMatch,
} from "./storefront-location-utils";

describe("storefront location helpers", () => {
  it("prefills browsing location from the default saved customer address", () => {
    const location = defaultBrowsingLocationFromAddresses([
      {
        id: "address_1",
        customerId: "customer_1",
        fullName: "Buyer",
        phone: "9876543210",
        line1: "12 Market Road",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        country: "India",
        countryCode: "IN",
        stateCode: "IN-TN",
        cityCode: "IN-TN-MAA",
        localAreaCode: "IN-TN-MAA-PAR",
        area: "Parrys",
        isDefault: false,
      },
      {
        id: "address_2",
        customerId: "customer_1",
        fullName: "Buyer",
        phone: "9876543210",
        line1: "14 Fairlands Road",
        city: "Salem",
        state: "Tamil Nadu",
        pincode: "636016",
        country: "India",
        countryCode: "in",
        stateCode: "in-tn",
        cityCode: "in-tn-slm",
        localAreaCode: "in-tn-slm-fr",
        area: "Fairlands",
        isDefault: true,
      },
    ]);

    expect(location).toEqual({
      countryCode: "IN",
      countryName: "India",
      stateCode: "IN-TN",
      stateName: "Tamil Nadu",
      cityCode: "IN-TN-SLM",
      cityName: "Salem",
      localAreaCode: "IN-TN-SLM-FR",
      areaName: "Fairlands",
      pincode: "636016",
    });
    expect(browsingLocationLabel(location)).toBe("Fairlands, Salem, Tamil Nadu, India");
    expect(browsingLocationHeadline(location)).toBe("Salem");
  });

  it("builds public store query params from the active browsing location", () => {
    expect(
      browsingLocationQuery(
        {
          countryCode: "IN",
          countryName: "India",
          stateCode: "IN-TN",
          stateName: "Tamil Nadu",
          cityCode: "IN-TN-SLM",
          cityName: "Salem",
          localAreaCode: "IN-TN-SLM-FR",
          areaName: "Fairlands",
          pincode: "636016",
        },
        6,
      ),
    ).toEqual({
      countryCode: "IN",
      stateCode: "IN-TN",
      cityCode: "IN-TN-SLM",
      localAreaCode: "IN-TN-SLM-FR",
      pincode: "636016",
      limit: 6,
    });
  });

  it("splits local and broader stores using backend match metadata", () => {
    const groups = splitStoresByLocationMatch([
      {
        id: "store_1",
        storeName: "Salem Store",
        slug: "salem-store",
        addresses: [],
        locationMatchLevel: "CITY",
      },
      {
        id: "store_2",
        storeName: "Bengaluru Store",
        slug: "bengaluru-store",
        addresses: [],
        locationMatchLevel: "COUNTRY",
      },
      {
        id: "store_3",
        storeName: "London Store",
        slug: "london-store",
        addresses: [],
        locationMatchLevel: "NONE",
      },
    ]);

    expect(groups.localStores.map((store) => store.slug)).toEqual([
      "salem-store",
      "bengaluru-store",
    ]);
    expect(groups.broaderStores.map((store) => store.slug)).toEqual(["london-store"]);
    expect(locationMatchLabel("LOCAL_AREA")).toBe("In your area");
    expect(locationMatchLabel("COUNTRY")).toBe("Same country");
  });
});
