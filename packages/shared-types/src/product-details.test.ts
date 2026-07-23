import { describe, expect, it } from "vitest";
import { buildProductDetailContent } from "./product-details";

describe("product detail content", () => {
  it("shows customer-relevant seller data with units and hides internal discovery metadata", () => {
    const content = buildProductDetailContent(
      {
        taxClassification: "TAXABLE",
        hsnCode: "851713",
        gstRatePercent: 18,
        hsnMaster: { description: "Smartphones" },
        attributes: {
          brand: "1HandIndia",
          highlights: ["Dual SIM", "Fast charging"],
          manufacturerAddress: "Chennai, Tamil Nadu",
          packageBreadthCm: 8,
          returnWindowDays: 7,
          searchTags: ["phone", "mobile"],
          seoTitle: "Internal SEO title",
          color: "Orange",
        },
      },
      {
        sku: "PHONE-ORANGE",
        variantName: "128 GB",
        packageWeightGrams: 220,
      },
    );

    expect(content.highlights).toEqual(["Dual SIM", "Fast charging"]);
    expect(content.sections.flatMap((section) => section.rows)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Tax classification", value: "Taxable" }),
        expect.objectContaining({ label: "GST rate %", value: "18%" }),
        expect.objectContaining({ label: "Package width cm", value: "8 cm" }),
        expect.objectContaining({ label: "Manufacturer address", value: "Chennai, Tamil Nadu" }),
        expect.objectContaining({ label: "Color", value: "Orange" }),
        expect.objectContaining({ label: "SKU", value: "PHONE-ORANGE" }),
        expect.objectContaining({ label: "Packed weight", value: "220 g" }),
      ]),
    );
    expect(JSON.stringify(content)).not.toContain("Internal SEO title");
    expect(JSON.stringify(content)).not.toContain("phone, mobile");
  });

  it("includes category product and selected-variant specification fields without duplicates", () => {
    const content = buildProductDetailContent(
      {
        attributes: { material: "Cotton" },
        category: {
          productTemplate: {
            fields: [
              { fieldKey: "material", label: "Material", scope: "PRODUCT", sortOrder: 1 },
              { fieldKey: "size", label: "Size", scope: "VARIANT", sortOrder: 2 },
            ],
          },
        },
      },
      { attributes: { size: "Large" } },
    );

    expect(content.sections.find((section) => section.key === "SPECIFICATIONS")?.rows).toEqual([
      expect.objectContaining({ label: "Material", value: "Cotton" }),
    ]);
    expect(content.sections.find((section) => section.key === "VARIANT")?.rows).toEqual([
      expect.objectContaining({ label: "Size", value: "Large" }),
    ]);
  });
});
