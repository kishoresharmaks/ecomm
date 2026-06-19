import { describe, expect, it } from "vitest";
import {
  buildUpdateProductPayload,
  buildCreateProductPayload,
  coerceDynamicAttributes,
  createBlankProductFormState,
  generateVariantName,
  productEditFormToProductFormState,
  productFormReducer,
  validateProductForm,
  type ProductFormVariant,
} from "./product-form";
import {
  createBlankProductEditForm,
  type ProductImageFormValue,
} from "./product-edit";
import type { ProductSummary, ProductTemplateField } from "./seller-api";

const fashionProductFields: ProductTemplateField[] = [
  field("gender", "Gender", "SELECT", "PRODUCT", true),
  field("fabric", "Fabric", "TEXT", "PRODUCT", false),
  field("fit", "Fit", "SELECT", "PRODUCT", false),
];

const fashionVariantFields: ProductTemplateField[] = [
  field("size", "Size", "SELECT", "VARIANT", true),
  field("color", "Color", "TEXT", "VARIANT", true),
];

describe("productFormReducer", () => {
  it("adds variants and updates dynamic variant attributes", () => {
    let state = createBlankProductFormState();
    state = productFormReducer(state, { type: "addVariant" });
    const variant = state.variants[1]!;

    state = productFormReducer(state, {
      type: "setVariantAttribute",
      clientId: variant.clientId,
      key: "size",
      value: "M",
    });

    expect(state.variants).toHaveLength(2);
    expect(state.variants[1]?.attributes.size).toBe("M");
  });

  it("reorders images and keeps one primary image", () => {
    let state = createBlankProductFormState();
    state = productFormReducer(state, {
      type: "addImage",
      image: { id: "one", url: "one.jpg", altText: "One", isPrimary: true, sortOrder: 0 },
    });
    state = productFormReducer(state, {
      type: "addImage",
      image: { id: "two", url: "two.jpg", altText: "Two", isPrimary: false, sortOrder: 1 },
    });
    state = productFormReducer(state, { type: "moveImage", id: "two", direction: -1 });

    expect(state.images.map((image) => image.id)).toEqual(["two", "one"]);
    expect(state.images.filter((image) => image.isPrimary)).toHaveLength(1);
  });
});

describe("dynamic attribute helpers", () => {
  it("coerces field values by template field type", () => {
    const fields: ProductTemplateField[] = [
      field("count", "Count", "NUMBER", "PRODUCT", false),
      field("organic", "Organic", "BOOLEAN", "PRODUCT", false),
      field("tags", "Tags", "MULTI_SELECT", "PRODUCT", false),
    ];

    expect(coerceDynamicAttributes(fields, { count: "12", organic: "true", tags: "red, cotton" })).toEqual({
      count: 12,
      organic: true,
      tags: ["red", "cotton"],
    });
  });

  it("coerces text, textarea, select, and date fields as strings", () => {
    const fields: ProductTemplateField[] = [
      field("shortText", "Short text", "TEXT", "PRODUCT", false),
      field("longText", "Long text", "TEXTAREA", "PRODUCT", false),
      field("material", "Material", "SELECT", "PRODUCT", false),
      field("madeOn", "Made on", "DATE", "PRODUCT", false),
    ];

    expect(coerceDynamicAttributes(fields, {
      shortText: " Cotton ",
      longText: "Breathable fabric",
      material: "Khadi",
      madeOn: "2026-06-18",
    })).toEqual({
      shortText: "Cotton",
      longText: "Breathable fabric",
      material: "Khadi",
      madeOn: "2026-06-18",
    });
  });
});

describe("buildCreateProductPayload", () => {
  it("builds fashion product and variant attributes like web", () => {
    const state = createValidFashionState();

    const payload = buildCreateProductPayload(state, fashionProductFields, fashionVariantFields);

    expect(payload.attributes).toMatchObject({
      brand: "Local label",
      gender: "Men",
      fabric: "Cotton",
      fit: "Regular",
    });
    expect(payload.variants[0]).toMatchObject({
      variantName: "M / Black",
      pricePaise: 9950,
      attributes: {
        size: "M",
        color: "Black",
      },
    });
  });
});

describe("validateProductForm", () => {
  it("requires template product and variant fields", () => {
    const state = createValidFashionState();
    state.attributes.gender = "";
    state.variants[0]!.attributes.size = "";

    const result = validateProductForm(state, fashionProductFields, fashionVariantFields);

    expect(result.valid).toBe(false);
    expect(result.errors["attribute.gender"]).toBe("Gender is required.");
    expect(result.messages).toContain("Black: Size is required.");
  });

  it("uses the variant name fallback chain", () => {
    const variant = createValidFashionState().variants[0]!;

    expect(generateVariantName(variant, fashionVariantFields, 0)).toBe("M / Black");
    expect(generateVariantName({ ...variant, attributes: {}, sku: "SKU-1" }, fashionVariantFields, 0)).toBe("SKU-1");
    expect(generateVariantName({ ...variant, attributes: {}, sku: "" }, fashionVariantFields, 2)).toBe("Variant 3");
  });

  it("allows manual HSN and GST save without requiring a suggestion result", () => {
    const state = createValidFashionState();
    state.base.hsnCode = "610910";
    state.base.gstRatePercent = "5";

    const result = validateProductForm(state, fashionProductFields, fashionVariantFields);

    expect(result.valid).toBe(true);
  });

  it("enforces 10-image and 20-variant caps", () => {
    const state = createValidFashionState();
    state.images = Array.from({ length: 11 }, (_, index) => image(index));
    state.variants = Array.from({ length: 21 }, (_, index) => ({
      ...state.variants[0]!,
      clientId: `variant_${index}`,
    }));

    const result = validateProductForm(state, fashionProductFields, fashionVariantFields);

    expect(result.errors.images).toBe("Add up to 10 product images.");
    expect(result.errors.variants).toBe("Add up to 20 active variants.");
  });
});

describe("buildUpdateProductPayload", () => {
  it("preserves variant ids and omits unchanged images through the shared helper", () => {
    const product: ProductSummary = {
      id: "product_1",
      name: "Cotton Shirt",
      description: "Comfortable cotton shirt for daily wear.",
      imageUrl: "image-one.jpg",
      attributes: { brand: "Local label", condition: "New", unitOfMeasure: "Piece", hsnCode: "6109", gstRatePercent: 5, returnEligibility: "Returnable", packageWeightGrams: 500 },
      category: { id: "category_fashion", name: "Fashion" },
      images: [{ url: "image-one.jpg", altText: "Cotton Shirt", sortOrder: 0, isPrimary: true }],
      variants: [{ id: "variant_1", variantName: "M / Black", pricePaise: 9950, stockQuantity: 10 }],
    };
    const editForm = createBlankProductEditForm();
    Object.assign(editForm, {
      categoryId: "category_fashion",
      name: "Cotton Shirt",
      description: "Comfortable cotton shirt for daily wear.",
      brand: "Local label",
      condition: "New",
      unitOfMeasure: "Piece",
      hsnCode: "6109",
      gstRatePercent: "5",
      returnEligibility: "Returnable",
      packageWeightGrams: "500",
      images: [{ id: "image-one.jpg-0", url: "image-one.jpg", altText: "Cotton Shirt", sortOrder: 0, isPrimary: true }],
      variants: [{ ...editForm.variants[0]!, id: "variant_1", variantName: "M / Black", price: "99.50", stock: "10" }],
    });

    const payload = buildUpdateProductPayload(productEditFormToProductFormState(editForm), [], [], product);

    expect(payload).not.toHaveProperty("images");
    expect(payload.variants?.[0]).toMatchObject({ id: "variant_1", pricePaise: 9950 });
  });
});

function createValidFashionState() {
  const state = createBlankProductFormState();
  state.base = {
    ...state.base,
    categoryId: "category_fashion",
    name: "Cotton Shirt",
    description: "Comfortable cotton shirt for daily wear.",
    brand: "Local label",
    condition: "New",
    unitOfMeasure: "Piece",
    hsnCode: "6109",
    gstRatePercent: "5",
    returnEligibility: "Returnable",
    packageWeightGrams: "500",
  };
  state.attributes = {
    gender: "Men",
    fabric: "Cotton",
    fit: "Regular",
  };
  state.variants = [
    {
      ...state.variants[0]!,
      price: "99.50",
      stock: "10",
      attributes: {
        size: "M",
        color: "Black",
      },
    } satisfies ProductFormVariant,
  ];
  return state;
}

function field(
  fieldKey: string,
  label: string,
  fieldType: ProductTemplateField["fieldType"],
  scope: ProductTemplateField["scope"],
  isRequired: boolean,
): ProductTemplateField {
  return {
    id: `${scope}_${fieldKey}`,
    productTemplateId: "template_fashion",
    fieldKey,
    label,
    fieldType,
    scope,
    isRequired,
    options: fieldType === "SELECT" ? ["Men", "Women", "M", "L", "Regular"] : null,
    sortOrder: 1,
  };
}

function image(index: number): ProductImageFormValue {
  return {
    id: `image_${index}`,
    url: `image-${index}.jpg`,
    altText: `Image ${index}`,
    isPrimary: index === 0,
    sortOrder: index,
  };
}
