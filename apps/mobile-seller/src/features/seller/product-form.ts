import { rupeesToPaise } from "../../lib/money";
import type {
  CategorySummary,
  ProductSummary,
  ProductTemplateField,
  SellerProductPayload,
  SellerProductUpdatePayload,
} from "./seller-api";
import {
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_VARIANTS,
  buildSellerProductUpdatePayload,
  createBlankProductEditForm,
  hasImageListChanged,
  type ProductEditFormValues,
  type ProductImageFormValue,
  type ProductVariantFormValue,
} from "./product-edit";

export type ProductBaseFields = {
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
};

export type ProductFormVariant = ProductVariantFormValue & {
  attributes: Record<string, string>;
};

export type ProductFormState = {
  base: ProductBaseFields;
  attributes: Record<string, string>;
  variants: ProductFormVariant[];
  images: ProductImageFormValue[];
  removedVariantIds: string[];
  errors: Record<string, string>;
  submitted: boolean;
};

export type ProductFormAction =
  | { type: "setBase"; key: keyof ProductBaseFields; value: string }
  | { type: "setProductAttribute"; key: string; value: string }
  | { type: "setVariant"; clientId: string; key: keyof ProductFormVariant; value: string }
  | { type: "setVariantAttribute"; clientId: string; key: string; value: string }
  | { type: "addVariant" }
  | { type: "removeVariant"; clientId: string }
  | { type: "addImage"; image: ProductImageFormValue }
  | { type: "updateImage"; id: string; patch: Partial<ProductImageFormValue> }
  | { type: "removeImage"; id: string }
  | { type: "moveImage"; id: string; direction: -1 | 1 }
  | { type: "setPrimaryImage"; id: string }
  | { type: "setErrors"; errors: Record<string, string> }
  | { type: "markSubmitted" }
  | { type: "reset"; state: ProductFormState };

export type ProductFormValidation = {
  valid: boolean;
  errors: Record<string, string>;
  messages: string[];
};

let variantSequence = 0;

export function createBlankProductFormState(): ProductFormState {
  const baseEdit = createBlankProductEditForm();
  return {
    base: {
      categoryId: baseEdit.categoryId,
      name: baseEdit.name,
      description: baseEdit.description,
      brand: baseEdit.brand,
      condition: baseEdit.condition,
      unitOfMeasure: baseEdit.unitOfMeasure,
      hsnCode: baseEdit.hsnCode,
      gstRatePercent: baseEdit.gstRatePercent,
      countryOfOrigin: baseEdit.countryOfOrigin,
      manufacturerName: baseEdit.manufacturerName,
      manufacturerAddress: baseEdit.manufacturerAddress,
      packerName: baseEdit.packerName,
      importerName: baseEdit.importerName,
      returnEligibility: baseEdit.returnEligibility,
      packageWeightGrams: baseEdit.packageWeightGrams,
      packageLengthCm: baseEdit.packageLengthCm,
      packageBreadthCm: baseEdit.packageBreadthCm,
      packageHeightCm: baseEdit.packageHeightCm,
      warranty: baseEdit.warranty,
      highlights: baseEdit.highlights,
      searchTags: baseEdit.searchTags,
      gtin: baseEdit.gtin,
      seoTitle: baseEdit.seoTitle,
      seoDescription: baseEdit.seoDescription,
    },
    attributes: {},
    variants: [createBlankProductFormVariant()],
    images: [],
    removedVariantIds: [],
    errors: {},
    submitted: false,
  };
}

export function createBlankProductFormVariant(): ProductFormVariant {
  variantSequence += 1;
  return {
    clientId: `variant_${Date.now()}_${variantSequence}`,
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
    attributes: {},
  };
}

export function productFormReducer(state: ProductFormState, action: ProductFormAction): ProductFormState {
  switch (action.type) {
    case "setBase":
      return { ...state, base: { ...state.base, [action.key]: action.value } };
    case "setProductAttribute":
      return { ...state, attributes: { ...state.attributes, [action.key]: action.value } };
    case "setVariant":
      return {
        ...state,
        variants: state.variants.map((variant) =>
          variant.clientId === action.clientId ? { ...variant, [action.key]: action.value } : variant,
        ),
      };
    case "setVariantAttribute":
      return {
        ...state,
        variants: state.variants.map((variant) =>
          variant.clientId === action.clientId
            ? { ...variant, attributes: { ...variant.attributes, [action.key]: action.value } }
            : variant,
        ),
      };
    case "addVariant":
      if (activeVariantCount(state) >= MAX_PRODUCT_VARIANTS) {
        return state;
      }
      return { ...state, variants: [...state.variants, createBlankProductFormVariant()] };
    case "removeVariant": {
      const variant = state.variants.find((item) => item.clientId === action.clientId);
      if (!variant || activeVariantCount(state) <= 1) {
        return state;
      }
      return {
        ...state,
        variants: state.variants.filter((item) => item.clientId !== action.clientId),
        removedVariantIds: variant.id ? [...state.removedVariantIds, variant.id] : state.removedVariantIds,
      };
    }
    case "addImage":
      if (state.images.length >= MAX_PRODUCT_IMAGES) {
        return state;
      }
      return { ...state, images: normalizeImageOrder([...state.images, action.image]) };
    case "updateImage":
      return {
        ...state,
        images: normalizeImageOrder(
          state.images.map((image) => (image.id === action.id ? { ...image, ...action.patch } : image)),
        ),
      };
    case "removeImage":
      return { ...state, images: normalizeImageOrder(state.images.filter((image) => image.id !== action.id)) };
    case "moveImage":
      return { ...state, images: moveImage(state.images, action.id, action.direction) };
    case "setPrimaryImage":
      return { ...state, images: state.images.map((image) => ({ ...image, isPrimary: image.id === action.id })) };
    case "setErrors":
      if (sameErrorMap(state.errors, action.errors)) {
        return state;
      }
      return { ...state, errors: action.errors };
    case "markSubmitted":
      return { ...state, submitted: true };
    case "reset":
      return action.state;
    default:
      return state;
  }
}

export function flattenCategories(categories: CategorySummary[]): CategorySummary[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children ?? [])]);
}

export function templateFields(
  category: CategorySummary | null | undefined,
  scope: ProductTemplateField["scope"],
) {
  return [...(category?.productTemplate?.fields ?? [])]
    .filter((field) => field.scope === scope)
    .sort((first, second) => first.sortOrder - second.sortOrder || first.label.localeCompare(second.label));
}

export function buildCreateProductPayload(
  state: ProductFormState,
  productFields: ProductTemplateField[],
  variantFields: ProductTemplateField[],
): SellerProductPayload {
  return {
    categoryId: state.base.categoryId.trim(),
    name: state.base.name.trim(),
    description: state.base.description.trim(),
    attributes: {
      ...buildMarketplaceAttributes(state.base),
      ...coerceDynamicAttributes(productFields, state.attributes),
    },
    images: state.images.map((image, index) => ({
      url: image.url,
      isPrimary: image.isPrimary || (!state.images.some((item) => item.isPrimary) && index === 0),
      sortOrder: index,
      altText: image.altText.trim() || state.base.name.trim(),
    })),
    variants: state.variants.map((variant, index) => buildCreateVariantPayload(variant, variantFields, index)),
  };
}

export function buildUpdateProductPayload(
  state: ProductFormState,
  productFields: ProductTemplateField[],
  variantFields: ProductTemplateField[],
  product?: ProductSummary,
): SellerProductUpdatePayload {
  const editForm = createBlankProductEditForm();
  Object.assign(editForm, state.base, {
    images: state.images,
    variants: state.variants.map(({ attributes: _attributes, ...variant }) => variant),
    removedVariantIds: state.removedVariantIds,
  });
  const payload = buildSellerProductUpdatePayload(product, editForm);
  payload.attributes = {
    ...buildMarketplaceAttributes(state.base),
    ...coerceDynamicAttributes(productFields, state.attributes),
  };
  payload.variants = [
    ...state.variants.map((variant, index) => buildUpdateVariantPayload(variant, variantFields, index)),
    ...state.removedVariantIds.map((id) => ({ id, status: "INACTIVE" as const })),
  ];
  if (hasImageListChanged(product, state.images)) {
    payload.images = buildCreateProductPayload(state, productFields, variantFields).images ?? [];
  } else {
    delete payload.images;
  }
  return payload;
}

export function productEditFormToProductFormState(
  values: ProductEditFormValues,
  attributes: Record<string, string> = {},
): ProductFormState {
  return {
    base: {
      categoryId: values.categoryId,
      name: values.name,
      description: values.description,
      brand: values.brand,
      condition: values.condition,
      unitOfMeasure: values.unitOfMeasure,
      hsnCode: values.hsnCode,
      gstRatePercent: values.gstRatePercent,
      countryOfOrigin: values.countryOfOrigin,
      manufacturerName: values.manufacturerName,
      manufacturerAddress: values.manufacturerAddress,
      packerName: values.packerName,
      importerName: values.importerName,
      returnEligibility: values.returnEligibility,
      packageWeightGrams: values.packageWeightGrams,
      packageLengthCm: values.packageLengthCm,
      packageBreadthCm: values.packageBreadthCm,
      packageHeightCm: values.packageHeightCm,
      warranty: values.warranty,
      highlights: values.highlights,
      searchTags: values.searchTags,
      gtin: values.gtin,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    },
    attributes,
    variants: values.variants.map((variant) => ({ ...variant, attributes: {} })),
    images: values.images,
    removedVariantIds: values.removedVariantIds,
    errors: {},
    submitted: false,
  };
}

export function validateProductForm(
  state: ProductFormState,
  productFields: ProductTemplateField[],
  variantFields: ProductTemplateField[],
): ProductFormValidation {
  const errors: Record<string, string> = {};
  const messages: string[] = [];
  const add = (key: string, message: string) => {
    errors[key] = message;
    messages.push(message);
  };

  requireText(state.base.categoryId, "base.categoryId", "Category is required.", add);
  requireText(state.base.name, "base.name", "Product name is required.", add);
  if (state.base.description.trim().length < 10) {
    add("base.description", "Description must be at least 10 characters.");
  }
  requireText(state.base.brand, "base.brand", "Brand / local label is required.", add);
  requireText(state.base.condition, "base.condition", "Condition is required.", add);
  requireText(state.base.unitOfMeasure, "base.unitOfMeasure", "Unit of sale is required.", add);
  requireText(state.base.hsnCode, "base.hsnCode", "HSN code is required.", add);
  if (!isNonNegativeNumber(state.base.gstRatePercent)) {
    add("base.gstRatePercent", "GST rate is required.");
  }
  requireText(state.base.returnEligibility, "base.returnEligibility", "Return policy is required.", add);
  if (!isPositiveNumber(state.base.packageWeightGrams)) {
    add("base.packageWeightGrams", "Package weight must be greater than 0.");
  }
  if (state.images.length > MAX_PRODUCT_IMAGES) {
    add("images", `Add up to ${MAX_PRODUCT_IMAGES} product images.`);
  }

  for (const field of productFields) {
    if (field.isRequired && !state.attributes[field.fieldKey]?.trim()) {
      add(`attribute.${field.fieldKey}`, `${field.label} is required.`);
    }
  }

  const activeVariants = state.variants.filter((variant) => variant.status !== "INACTIVE");
  if (!activeVariants.length) {
    add("variants", "Add at least one active variant.");
  }
  if (activeVariants.length > MAX_PRODUCT_VARIANTS) {
    add("variants", `Add up to ${MAX_PRODUCT_VARIANTS} active variants.`);
  }

  activeVariants.forEach((variant, index) => {
    const label = generateVariantName(variant, variantFields, index);
    if (!isNonNegativeNumber(variant.price)) {
      add(`variant.${variant.clientId}.price`, `${label}: selling price is required.`);
    }
    if (variant.mrp.trim() && !isNonNegativeNumber(variant.mrp)) {
      add(`variant.${variant.clientId}.mrp`, `${label}: MRP must be a valid amount.`);
    }
    if (!isNonNegativeInteger(variant.stock)) {
      add(`variant.${variant.clientId}.stock`, `${label}: stock must be a whole number.`);
    }
    for (const field of variantFields) {
      if (field.isRequired && !variant.attributes[field.fieldKey]?.trim()) {
        add(`variant.${variant.clientId}.attribute.${field.fieldKey}`, `${label}: ${field.label} is required.`);
      }
    }
  });

  return { valid: messages.length === 0, errors, messages };
}

export function generateVariantName(
  variant: Pick<ProductFormVariant, "variantName" | "sku" | "attributes">,
  variantFields: ProductTemplateField[],
  index: number,
) {
  if (variant.variantName.trim()) {
    return variant.variantName.trim();
  }
  const values = variantFields
    .map((field) => displayAttributeValue(coerceDynamicAttributeValue(field, variant.attributes[field.fieldKey])))
    .filter(Boolean)
    .slice(0, 3);
  if (values.length) {
    return values.join(" / ");
  }
  if (variant.sku.trim()) {
    return variant.sku.trim();
  }
  return `Variant ${index + 1}`;
}

export function coerceDynamicAttributes(fields: ProductTemplateField[], values: Record<string, string>) {
  const attributes: Record<string, unknown> = {};
  for (const field of fields) {
    const value = coerceDynamicAttributeValue(field, values[field.fieldKey]);
    if (value !== undefined) {
      attributes[field.fieldKey] = value;
    }
  }
  return attributes;
}

export function coerceDynamicAttributeValue(field: ProductTemplateField, rawValue: string | undefined) {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (field.fieldType === "NUMBER") {
    const numberValue = Number(trimmed);
    return Number.isFinite(numberValue) ? numberValue : trimmed;
  }
  if (field.fieldType === "BOOLEAN") {
    return trimmed === "true";
  }
  if (field.fieldType === "MULTI_SELECT") {
    const values = trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    return values.length ? values : undefined;
  }
  return trimmed;
}

function buildMarketplaceAttributes(base: ProductBaseFields) {
  const attributes: Record<string, unknown> = {
    brand: base.brand.trim(),
    condition: base.condition,
    unitOfMeasure: base.unitOfMeasure,
    gstRatePercent: numberOrZero(base.gstRatePercent),
    hsnCode: base.hsnCode.trim(),
    returnEligibility: base.returnEligibility,
    packageWeightGrams: numberOrZero(base.packageWeightGrams),
  };

  addStringAttribute(attributes, "countryOfOrigin", base.countryOfOrigin);
  addStringAttribute(attributes, "manufacturerName", base.manufacturerName);
  addStringAttribute(attributes, "manufacturerAddress", base.manufacturerAddress);
  addStringAttribute(attributes, "packerName", base.packerName);
  addStringAttribute(attributes, "importerName", base.importerName);
  addStringAttribute(attributes, "warranty", base.warranty);
  addStringAttribute(attributes, "gtin", base.gtin);
  addStringAttribute(attributes, "seoTitle", base.seoTitle);
  addStringAttribute(attributes, "seoDescription", base.seoDescription);
  addOptionalNumberAttribute(attributes, "packageLengthCm", base.packageLengthCm);
  addOptionalNumberAttribute(attributes, "packageBreadthCm", base.packageBreadthCm);
  addOptionalNumberAttribute(attributes, "packageHeightCm", base.packageHeightCm);

  const highlights = splitList(base.highlights, "\n");
  if (highlights.length) {
    attributes.highlights = highlights;
  }
  const searchTags = splitList(base.searchTags, ",");
  if (searchTags.length) {
    attributes.searchTags = searchTags;
  }

  return attributes;
}

function buildCreateVariantPayload(
  variant: ProductFormVariant,
  variantFields: ProductTemplateField[],
  index: number,
): SellerProductPayload["variants"][number] {
  const payload: SellerProductPayload["variants"][number] = {
    variantName: generateVariantName(variant, variantFields, index),
    pricePaise: rupeesToPaise(variant.price),
    stockQuantity: integerOrZero(variant.stock),
    status: variant.status,
  };
  const attributes = coerceDynamicAttributes(variantFields, variant.attributes);
  if (Object.keys(attributes).length) {
    payload.attributes = attributes;
  }
  if (variant.sku.trim()) {
    payload.sku = variant.sku.trim();
  }
  if (variant.mrp.trim()) {
    payload.mrpPaise = rupeesToPaise(variant.mrp);
  }
  addVariantNumber(payload, "packageWeightGrams", variant.packageWeightGrams);
  addVariantNumber(payload, "packageLengthCm", variant.packageLengthCm);
  addVariantNumber(payload, "packageBreadthCm", variant.packageBreadthCm);
  addVariantNumber(payload, "packageHeightCm", variant.packageHeightCm);
  return payload;
}

function buildUpdateVariantPayload(
  variant: ProductFormVariant,
  variantFields: ProductTemplateField[],
  index: number,
): NonNullable<SellerProductUpdatePayload["variants"]>[number] {
  const payload: NonNullable<SellerProductUpdatePayload["variants"]>[number] = buildCreateVariantPayload(
    variant,
    variantFields,
    index,
  );
  if (variant.id) {
    payload.id = variant.id;
  }
  return payload;
}

function activeVariantCount(state: ProductFormState) {
  return state.variants.filter((variant) => variant.status !== "INACTIVE").length;
}

function sameErrorMap(first: Record<string, string>, second: Record<string, string>) {
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  return firstKeys.length === secondKeys.length && firstKeys.every((key) => first[key] === second[key]);
}

function normalizeImageOrder(images: ProductImageFormValue[]) {
  const withPrimary = images.length && !images.some((image) => image.isPrimary)
    ? images.map((image, index) => ({ ...image, isPrimary: index === 0 }))
    : images;
  return withPrimary.map((image, index) => ({ ...image, sortOrder: index }));
}

function moveImage(images: ProductImageFormValue[], id: string, direction: -1 | 1) {
  const index = images.findIndex((image) => image.id === id);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= images.length) {
    return images;
  }
  const nextImages = [...images];
  const [image] = nextImages.splice(index, 1);
  if (!image) {
    return images;
  }
  nextImages.splice(targetIndex, 0, image);
  return normalizeImageOrder(nextImages);
}

function displayAttributeValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(" / ");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  return "";
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

function addVariantNumber(
  payload: SellerProductPayload["variants"][number],
  key: "packageWeightGrams" | "packageLengthCm" | "packageBreadthCm" | "packageHeightCm",
  value: string,
) {
  if (value.trim()) {
    payload[key] = integerOrZero(value);
  }
}

function requireText(
  value: string,
  key: string,
  message: string,
  add: (key: string, message: string) => void,
) {
  if (!value.trim()) {
    add(key, message);
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

function splitList(value: string, separator: string) {
  return value.split(separator).map((item) => item.trim()).filter(Boolean);
}
