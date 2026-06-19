import { describe, expect, it } from "vitest";
import {
  buildSellerProductUpdatePayload,
  hasImageListChanged,
  productToEditForm,
  validateProductEditForm,
  type ProductEditFormValues,
} from "./product-edit";
import type { ProductSummary } from "./seller-api";

const baseProduct: ProductSummary = {
  id: "product_1",
  name: "Existing product",
  description: "Existing product description",
  imageUrl: "indihub/sellers/seller_1/products/existing.jpg",
  attributes: {
    brand: "Local label",
    condition: "New",
    unitOfMeasure: "Pack",
    hsnCode: "100630",
    gstRatePercent: 5,
    returnEligibility: "Returnable",
    packageWeightGrams: 500,
  },
  category: { id: "category_1", name: "Grocery" },
  images: [
    {
      url: "indihub/sellers/seller_1/products/existing.jpg",
      altText: "Existing product",
      sortOrder: 0,
      isPrimary: true,
    },
  ],
  variants: [
    {
      id: "variant_1",
      sku: "SKU-1",
      variantName: "Default",
      pricePaise: 19900,
      stockQuantity: 5,
      status: "ACTIVE",
      packageWeightGrams: 500,
    },
  ],
};

function validValues(): ProductEditFormValues {
  return productToEditForm(baseProduct);
}

describe("buildSellerProductUpdatePayload", () => {
  it("preserves existing variant ids and omits images when the image list is unchanged", () => {
    const values = validValues();
    values.name = "Updated product";
    values.variants[0]!.price = "299.50";
    values.variants[0]!.stock = "7";

    const payload = buildSellerProductUpdatePayload(baseProduct, values);

    expect(payload).not.toHaveProperty("images");
    expect(payload.variants?.[0]).toMatchObject({
      id: "variant_1",
      pricePaise: 29950,
      stockQuantity: 7,
    });
    expect(payload.attributes).toMatchObject({
      brand: "Local label",
      hsnCode: "100630",
      gstRatePercent: 5,
    });
  });

  it("sends the full ordered image list when image metadata changes", () => {
    const values = validValues();
    values.images[0]!.altText = "New alt text";
    values.images.push({
      id: "new_image",
      url: "indihub/sellers/seller_1/products/new.jpg",
      altText: "Second image",
      sortOrder: 1,
      isPrimary: false,
    });

    const payload = buildSellerProductUpdatePayload(baseProduct, values);

    expect(payload.images).toEqual([
      {
        url: "indihub/sellers/seller_1/products/existing.jpg",
        isPrimary: true,
        sortOrder: 0,
        altText: "New alt text",
      },
      {
        url: "indihub/sellers/seller_1/products/new.jpg",
        isPrimary: false,
        sortOrder: 1,
        altText: "Second image",
      },
    ]);
  });

  it("adds new variants and marks removed existing variants inactive", () => {
    const values = validValues();
    values.variants = [
      {
        clientId: "new_variant",
        sku: "SKU-2",
        variantName: "2 KG Pack",
        price: "99.50",
        mrp: "",
        stock: "10",
        packageWeightGrams: "500",
        packageLengthCm: "",
        packageBreadthCm: "",
        packageHeightCm: "",
        status: "ACTIVE",
      },
    ];
    values.removedVariantIds = ["variant_1"];

    const payload = buildSellerProductUpdatePayload(baseProduct, values);

    expect(payload.variants).toEqual([
      expect.objectContaining({
        sku: "SKU-2",
        pricePaise: 9950,
        status: "ACTIVE",
      }),
      { id: "variant_1", status: "INACTIVE" },
    ]);
  });
});

describe("hasImageListChanged", () => {
  it("detects reordering as an image-list change", () => {
    const product: ProductSummary = {
      ...baseProduct,
      images: [
        { url: "one.jpg", altText: "One", sortOrder: 0, isPrimary: true },
        { url: "two.jpg", altText: "Two", sortOrder: 1, isPrimary: false },
      ],
    };
    const values = productToEditForm(product);

    expect(hasImageListChanged(product, [values.images[1]!, values.images[0]!])).toBe(true);
  });
});

describe("validateProductEditForm", () => {
  it("blocks saves beyond backend caps", () => {
    const values = validValues();
    values.images = Array.from({ length: 11 }, (_, index) => ({
      id: `image_${index}`,
      url: `image-${index}.jpg`,
      altText: `Image ${index}`,
      sortOrder: index,
      isPrimary: index === 0,
    }));
    const baseVariant = values.variants[0]!;
    values.variants = Array.from({ length: 21 }, (_, index) => ({
      clientId: `variant_${index}`,
      sku: `SKU-${index}`,
      variantName: baseVariant.variantName,
      price: baseVariant.price,
      mrp: baseVariant.mrp,
      stock: baseVariant.stock,
      packageWeightGrams: baseVariant.packageWeightGrams,
      packageLengthCm: baseVariant.packageLengthCm,
      packageBreadthCm: baseVariant.packageBreadthCm,
      packageHeightCm: baseVariant.packageHeightCm,
      status: baseVariant.status,
    }));

    const result = validateProductEditForm(values);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Add up to 10 product images.");
    expect(result.errors).toContain("Add up to 20 active variants.");
  });
});
