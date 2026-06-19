import { apiBaseUrl } from "../../lib/api";
import { paiseToRupees, rupeesToPaise } from "../../lib/money";
import type { ProductSummary, SellerProductUpdatePayload } from "./seller-api";

export const MAX_PRODUCT_IMAGES = 10;
export const MAX_PRODUCT_VARIANTS = 20;

export const CONDITION_OPTIONS = [
  { label: "New", value: "New" },
  { label: "Refurbished", value: "Refurbished" },
  { label: "Used", value: "Used" },
];

export const UNIT_OPTIONS = [
  { label: "Piece", value: "Piece" },
  { label: "Pack", value: "Pack" },
  { label: "Box", value: "Box" },
  { label: "Set", value: "Set" },
  { label: "Pair", value: "Pair" },
  { label: "Kg", value: "Kg" },
  { label: "Gram", value: "Gram" },
  { label: "Litre", value: "Litre" },
  { label: "Millilitre", value: "Millilitre" },
  { label: "Meter", value: "Meter" },
];

export const RETURN_OPTIONS = [
  { label: "Returnable", value: "Returnable" },
  { label: "Replacement only", value: "Replacement only" },
  { label: "Non-returnable", value: "Non-returnable" },
  { label: "Service/warranty only", value: "Service/warranty only" },
];

export const GST_OPTIONS = [
  { label: "0%", value: "0" },
  { label: "5%", value: "5" },
  { label: "12%", value: "12" },
  { label: "18%", value: "18" },
  { label: "28%", value: "28" },
];

export type ProductImageFormValue = {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
  localUri?: string;
};

export type ProductVariantFormValue = {
  id?: string;
  clientId: string;
  sku: string;
  variantName: string;
  price: string;
  mrp: string;
  stock: string;
  packageWeightGrams: string;
  packageLengthCm: string;
  packageBreadthCm: string;
  packageHeightCm: string;
  status: "ACTIVE" | "INACTIVE";
};

export type ProductEditFormValues = {
  categoryId: string;
  name: string;
  description: string;
  brand: string;
  condition: string;
  unitOfMeasure: string;
  hsnCode: string;
  gstRatePercent: string;
  countryOfOrigin: string;
  manufacturerName: string;
  manufacturerAddress: string;
  packerName: string;
  importerName: string;
  returnEligibility: string;
  packageWeightGrams: string;
  packageLengthCm: string;
  packageBreadthCm: string;
  packageHeightCm: string;
  warranty: string;
  highlights: string;
  searchTags: string;
  gtin: string;
  seoTitle: string;
  seoDescription: string;
  images: ProductImageFormValue[];
  variants: ProductVariantFormValue[];
  removedVariantIds: string[];
};

export type ProductEditValidationResult = {
  valid: boolean;
  errors: string[];
};

export function createBlankProductEditForm(): ProductEditFormValues {
  return {
    categoryId: "",
    name: "",
    description: "",
    brand: "",
    condition: "",
    unitOfMeasure: "",
    hsnCode: "",
    gstRatePercent: "",
    countryOfOrigin: "",
    manufacturerName: "",
    manufacturerAddress: "",
    packerName: "",
    importerName: "",
    returnEligibility: "",
    packageWeightGrams: "",
    packageLengthCm: "",
    packageBreadthCm: "",
    packageHeightCm: "",
    warranty: "",
    highlights: "",
    searchTags: "",
    gtin: "",
    seoTitle: "",
    seoDescription: "",
    images: [],
    variants: [createBlankVariant()],
    removedVariantIds: [],
  };
}

export function createBlankVariant(): ProductVariantFormValue {
  return {
    clientId: createClientId("variant"),
    sku: "",
    variantName: "",
    price: "",
    mrp: "",
    stock: "0",
    packageWeightGrams: "",
    packageLengthCm: "",
    packageBreadthCm: "",
    packageHeightCm: "",
    status: "ACTIVE",
  };
}

export function productToEditForm(product: ProductSummary | undefined): ProductEditFormValues {
  const attributes = asRecord(product?.attributes);
  const variants = (product?.variants ?? []).map((variant) => ({
    id: variant.id,
    clientId: variant.id || createClientId("variant"),
    sku: variant.sku ?? "",
    variantName: variant.variantName ?? "",
    price: paiseToRupees(variant.pricePaise),
    mrp: variant.mrpPaise ? paiseToRupees(variant.mrpPaise) : "",
    stock: String(variant.stockQuantity ?? 0),
    packageWeightGrams: stringFromNumber(variant.packageWeightGrams),
    packageLengthCm: stringFromNumber(variant.packageLengthCm),
    packageBreadthCm: stringFromNumber(variant.packageBreadthCm),
    packageHeightCm: stringFromNumber(variant.packageHeightCm),
    status: variant.status === "INACTIVE" ? "INACTIVE" as const : "ACTIVE" as const,
  }));

  return {
    ...createBlankProductEditForm(),
    categoryId: product?.category?.id ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    brand: stringFromAttribute(attributes.brand),
    condition: stringFromAttribute(attributes.condition),
    unitOfMeasure: stringFromAttribute(attributes.unitOfMeasure),
    hsnCode: stringFromAttribute(attributes.hsnCode ?? product?.hsnCode),
    gstRatePercent: stringFromAttribute(attributes.gstRatePercent ?? product?.gstRatePercent),
    countryOfOrigin: stringFromAttribute(attributes.countryOfOrigin),
    manufacturerName: stringFromAttribute(attributes.manufacturerName),
    manufacturerAddress: stringFromAttribute(attributes.manufacturerAddress),
    packerName: stringFromAttribute(attributes.packerName),
    importerName: stringFromAttribute(attributes.importerName),
    returnEligibility: stringFromAttribute(attributes.returnEligibility),
    packageWeightGrams: stringFromAttribute(attributes.packageWeightGrams),
    packageLengthCm: stringFromAttribute(attributes.packageLengthCm),
    packageBreadthCm: stringFromAttribute(attributes.packageBreadthCm ?? attributes.packageWidthCm),
    packageHeightCm: stringFromAttribute(attributes.packageHeightCm),
    warranty: stringFromAttribute(attributes.warranty),
    highlights: arrayAttributeToLines(attributes.highlights),
    searchTags: arrayAttributeToCsv(attributes.searchTags),
    gtin: stringFromAttribute(attributes.gtin),
    seoTitle: stringFromAttribute(attributes.seoTitle),
    seoDescription: stringFromAttribute(attributes.seoDescription),
    images: normalizeProductImages(product),
    variants: variants.length ? variants : [createBlankVariant()],
    removedVariantIds: [],
  };
}

export function buildSellerProductUpdatePayload(
  product: ProductSummary | undefined,
  values: ProductEditFormValues,
): SellerProductUpdatePayload {
  const attributes = buildProductAttributes(values);
  const payload: SellerProductUpdatePayload = {
    categoryId: values.categoryId.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    attributes,
    variants: [
      ...values.variants.map((variant) => buildVariantPayload(variant)),
      ...values.removedVariantIds.map((id) => ({ id, status: "INACTIVE" as const })),
    ],
  };

  if (hasImageListChanged(product, values.images)) {
    payload.images = values.images.map((image, index) => ({
      url: image.url,
      isPrimary: image.isPrimary,
      sortOrder: index,
      altText: image.altText.trim() || values.name.trim(),
    }));
  }

  return payload;
}

export function buildProductAttributes(values: ProductEditFormValues) {
  const attributes: Record<string, unknown> = {
    brand: values.brand.trim(),
    condition: values.condition,
    unitOfMeasure: values.unitOfMeasure,
    gstRatePercent: numberOrZero(values.gstRatePercent),
    hsnCode: values.hsnCode.trim(),
    returnEligibility: values.returnEligibility,
    packageWeightGrams: numberOrZero(values.packageWeightGrams),
  };

  addStringAttribute(attributes, "countryOfOrigin", values.countryOfOrigin);
  addStringAttribute(attributes, "manufacturerName", values.manufacturerName);
  addStringAttribute(attributes, "manufacturerAddress", values.manufacturerAddress);
  addStringAttribute(attributes, "packerName", values.packerName);
  addStringAttribute(attributes, "importerName", values.importerName);
  addStringAttribute(attributes, "warranty", values.warranty);
  addStringAttribute(attributes, "gtin", values.gtin);
  addStringAttribute(attributes, "seoTitle", values.seoTitle);
  addStringAttribute(attributes, "seoDescription", values.seoDescription);
  addOptionalNumberAttribute(attributes, "packageLengthCm", values.packageLengthCm);
  addOptionalNumberAttribute(attributes, "packageBreadthCm", values.packageBreadthCm);
  addOptionalNumberAttribute(attributes, "packageHeightCm", values.packageHeightCm);

  const highlights = linesToArray(values.highlights);
  if (highlights.length) {
    attributes.highlights = highlights;
  }

  const searchTags = csvToArray(values.searchTags);
  if (searchTags.length) {
    attributes.searchTags = searchTags;
  }

  return attributes;
}

export function validateProductEditForm(values: ProductEditFormValues): ProductEditValidationResult {
  const errors: string[] = [];
  const activeVariants = values.variants.filter((variant) => variant.status !== "INACTIVE");

  requireText(values.categoryId, "Category is required.", errors);
  requireText(values.name, "Product name is required.", errors);
  if (values.description.trim().length < 10) {
    errors.push("Description must be at least 10 characters.");
  }
  requireText(values.brand, "Brand / local label is required.", errors);
  requireText(values.condition, "Condition is required.", errors);
  requireText(values.unitOfMeasure, "Unit of sale is required.", errors);
  requireText(values.hsnCode, "HSN code is required.", errors);
  if (!isNonNegativeNumber(values.gstRatePercent)) {
    errors.push("GST rate is required.");
  }
  requireText(values.returnEligibility, "Return policy is required.", errors);
  if (!isPositiveNumber(values.packageWeightGrams)) {
    errors.push("Package weight must be greater than 0.");
  }

  if (values.images.length > MAX_PRODUCT_IMAGES) {
    errors.push(`Add up to ${MAX_PRODUCT_IMAGES} product images.`);
  }
  if (activeVariants.length === 0) {
    errors.push("Add at least one active variant.");
  }
  if (activeVariants.length > MAX_PRODUCT_VARIANTS) {
    errors.push(`Add up to ${MAX_PRODUCT_VARIANTS} active variants.`);
  }

  activeVariants.forEach((variant, index) => {
    const label = variant.variantName.trim() || `Variant ${index + 1}`;
    if (!isNonNegativeNumber(variant.price)) {
      errors.push(`${label}: selling price is required.`);
    }
    if (variant.mrp.trim() && !isNonNegativeNumber(variant.mrp)) {
      errors.push(`${label}: MRP must be a valid amount.`);
    }
    if (!isNonNegativeInteger(variant.stock)) {
      errors.push(`${label}: stock must be a whole number.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function hasImageListChanged(product: ProductSummary | undefined, images: ProductImageFormValue[]) {
  const original = normalizeProductImages(product).map(imageComparisonValue);
  const next = images.map((image, index) => imageComparisonValue({ ...image, sortOrder: index }));
  return JSON.stringify(original) !== JSON.stringify(next);
}

export function resolveProductImageUri(image: ProductImageFormValue | string | null | undefined) {
  const source = typeof image === "string" ? image : image?.localUri || image?.url;
  if (!source) {
    return null;
  }
  if (/^(https?:|file:|content:|data:)/i.test(source)) {
    return source;
  }
  return `${apiBaseUrl()}/storage/public-image?key=${encodeURIComponent(source)}`;
}

function normalizeProductImages(product: ProductSummary | undefined): ProductImageFormValue[] {
  const productImages = product?.images?.length
    ? product.images
    : product?.imageUrl
      ? [{ url: product.imageUrl, isPrimary: true, sortOrder: 0, altText: product.name }]
      : [];

  return productImages
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((image, index) => ({
      id: `${image.url}-${index}`,
      url: image.url,
      altText: image.altText ?? product?.name ?? "",
      isPrimary: image.isPrimary ?? index === 0,
      sortOrder: index,
    }));
}

function buildVariantPayload(variant: ProductVariantFormValue) {
  const payload: NonNullable<SellerProductUpdatePayload["variants"]>[number] = {
    variantName: variant.variantName.trim() || "Default",
    pricePaise: rupeesToPaise(variant.price),
    stockQuantity: integerOrZero(variant.stock),
    status: variant.status,
  };

  if (variant.id) {
    payload.id = variant.id;
  }
  if (variant.sku.trim()) {
    payload.sku = variant.sku.trim();
  }
  payload.mrpPaise = variant.mrp.trim() ? rupeesToPaise(variant.mrp) : null;
  if (variant.packageWeightGrams.trim()) {
    payload.packageWeightGrams = integerOrZero(variant.packageWeightGrams);
  }
  if (variant.packageLengthCm.trim()) {
    payload.packageLengthCm = integerOrZero(variant.packageLengthCm);
  }
  if (variant.packageBreadthCm.trim()) {
    payload.packageBreadthCm = integerOrZero(variant.packageBreadthCm);
  }
  if (variant.packageHeightCm.trim()) {
    payload.packageHeightCm = integerOrZero(variant.packageHeightCm);
  }

  return payload;
}

function imageComparisonValue(image: ProductImageFormValue) {
  return {
    url: image.url,
    altText: image.altText.trim(),
    isPrimary: image.isPrimary,
    sortOrder: image.sortOrder,
  };
}

function addStringAttribute(attributes: Record<string, unknown>, key: string, value: string) {
  if (value.trim()) {
    attributes[key] = value.trim();
  }
}

function addOptionalNumberAttribute(attributes: Record<string, unknown>, key: string, value: string) {
  if (value.trim()) {
    attributes[key] = numberOrZero(value);
  }
}

function requireText(value: string, message: string, errors: string[]) {
  if (!value.trim()) {
    errors.push(message);
  }
}

function isNonNegativeNumber(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0;
}

function isPositiveNumber(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed > 0;
}

function isNonNegativeInteger(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isInteger(parsed) && parsed >= 0;
}

function numberOrZero(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function integerOrZero(value: string) {
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function stringFromNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function stringFromAttribute(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function arrayAttributeToLines(value: unknown) {
  return Array.isArray(value) ? value.map(String).join("\n") : "";
}

function arrayAttributeToCsv(value: unknown) {
  return Array.isArray(value) ? value.map(String).join(", ") : "";
}

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function createClientId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
