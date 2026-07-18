import { describe, expect, it } from "vitest";
import { validatePublicImageFile } from "../../lib/public-image-upload";
import { validateSellerDocument } from "../../lib/seller-document-upload";
import { sellerCollectedCodExpectedPaise } from "./seller-cod-calculations";
import { rupeesToPaise } from "./seller-money";
import {
  primaryCapabilityForMode,
  registrationModeFromQuery,
  sellerRegistrationPath,
} from "./seller-registration-navigation";
import { serviceImagesForSave } from "./seller-service-images";

describe("seller data correctness helpers", () => {
  it("parses grouped rupee amounts into paise", () => {
    expect(rupeesToPaise("1,299")).toBe(129900);
    expect(rupeesToPaise("1,29,999.50")).toBe(12999950);
    expect(rupeesToPaise("not-a-price")).toBe(0);
  });

  it("preserves all existing service images when the cover is unchanged", () => {
    const images = serviceImagesForSave(
      [
        { url: "cover.jpg", altText: "Cover", isPrimary: true },
        { url: "detail-1.jpg", altText: "Detail one" },
        { url: "detail-2.jpg", altText: "Detail two" },
      ],
      "cover.jpg",
      "AC repair",
    );

    expect(images.map((image) => image.url)).toEqual([
      "cover.jpg",
      "detail-1.jpg",
      "detail-2.jpg",
    ]);
    expect(images.filter((image) => image.isPrimary)).toHaveLength(1);
  });

  it("keeps old service images as secondary images when a new cover is selected", () => {
    const images = serviceImagesForSave(
      [
        { url: "old-cover.jpg", isPrimary: true },
        { url: "detail.jpg" },
      ],
      "new-cover.jpg",
      "AC repair",
    );

    expect(images.map((image) => image.url)).toEqual([
      "new-cover.jpg",
      "old-cover.jpg",
      "detail.jpg",
    ]);
    expect(images[0]?.isPrimary).toBe(true);
  });

  it("uses the order total as-is when seller split and shipment subtotals are missing", () => {
    expect(
      sellerCollectedCodExpectedPaise(
        {
          totalPaise: 11500,
          subtotalPaise: 10000,
          platformFeePaise: 300,
        },
        null,
        { shippingPaise: 1000, codSurchargePaise: 200 },
      ),
    ).toBe(11500);
  });

  it("calculates package COD from a shipment subtotal when the split is missing", () => {
    expect(
      sellerCollectedCodExpectedPaise(
        {
          totalPaise: 11500,
          subtotalPaise: 10000,
          platformFeePaise: 300,
        },
        null,
        {
          subtotalPaise: 10000,
          shippingPaise: 1000,
          codSurchargePaise: 200,
        },
      ),
    ).toBe(11500);
  });

  it("preserves seller registration mode and plan in the return path", () => {
    expect(sellerRegistrationPath("service", "plan pro")).toBe(
      "/seller/register?mode=service&plan=plan+pro",
    );
    expect(sellerRegistrationPath()).toBe("/seller/register");
  });

  it("shares registration mode parsing without importing the registration form", () => {
    expect(registrationModeFromQuery("services")).toBe("SERVICE");
    expect(registrationModeFromQuery("retail-service")).toBe("BOTH");
    expect(primaryCapabilityForMode("SERVICE")).toBe("SERVICE");
    expect(primaryCapabilityForMode("BOTH")).toBe("RETAIL");
  });

  it("rejects empty and oversized uploads before network work begins", () => {
    expect(() =>
      validatePublicImageFile({
        type: "image/png",
        size: 0,
      } as File),
    ).toThrow("Image must be 5 MB or smaller.");
    expect(() =>
      validateSellerDocument({
        type: "application/pdf",
        size: 10 * 1024 * 1024 + 1,
      } as File),
    ).toThrow("Document must be 10 MB or smaller.");
  });
});
