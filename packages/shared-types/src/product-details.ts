import { marketplaceProductEssentialFields } from "./product-essentials";

export type ProductDetailTemplateField = {
  fieldKey: string;
  label: string;
  scope: "PRODUCT" | "VARIANT";
  sortOrder?: number;
};

export type ProductDetailSource = {
  attributes?: Record<string, unknown> | null;
  taxClassification?: string | null;
  hsnCode?: string | null;
  gstRatePercent?: number | string | null;
  hsnMaster?: {
    description?: string | null;
  } | null;
  category?: {
    productTemplate?: {
      fields?: ProductDetailTemplateField[] | null;
    } | null;
  } | null;
};

export type ProductDetailVariantSource = {
  sku?: string | null;
  variantName?: string | null;
  packageWeightGrams?: number | string | null;
  packageLengthCm?: number | string | null;
  packageBreadthCm?: number | string | null;
  packageHeightCm?: number | string | null;
  attributes?: Record<string, unknown> | null;
};

export type ProductDetailRow = {
  key: string;
  label: string;
  value: string;
  scope: "PRODUCT" | "VARIANT";
};

export type ProductDetailSection = {
  key: "OVERVIEW" | "COMPLIANCE" | "FULFILMENT" | "IDENTIFIERS" | "SPECIFICATIONS" | "VARIANT";
  title: string;
  rows: ProductDetailRow[];
};

export type ProductDetailContent = {
  highlights: string[];
  sections: ProductDetailSection[];
};

const internalProductAttributeKeys = new Set([
  "highlights",
  "searchTags",
  "seoTitle",
  "seoDescription",
]);

const essentialGroupSections = {
  ESSENTIALS: { key: "OVERVIEW", title: "Product overview" },
  COMPLIANCE: { key: "COMPLIANCE", title: "Product and tax information" },
  FULFILMENT: { key: "FULFILMENT", title: "Delivery, returns and warranty" },
  DISCOVERY: { key: "IDENTIFIERS", title: "Product identifiers" },
} as const;

export function buildProductDetailContent(
  product: ProductDetailSource,
  variant?: ProductDetailVariantSource | null,
): ProductDetailContent {
  const productAttributes = product.attributes ?? {};
  const variantAttributes = variant?.attributes ?? {};
  const consumedProductKeys = new Set<string>([
    ...internalProductAttributeKeys,
    "taxClassification",
    "packageBreadthCm",
  ]);
  const consumedVariantKeys = new Set<string>();
  const rowsBySection = new Map<ProductDetailSection["key"], ProductDetailRow[]>();

  const taxClassification = displayProductDetailValue(
    "taxClassification",
    product.taxClassification ?? productAttributes.taxClassification,
  );
  if (taxClassification) {
    addRow(rowsBySection, "COMPLIANCE", {
      key: "taxClassification",
      label: "Tax classification",
      value: taxClassification,
      scope: "PRODUCT",
    });
  }

  for (const field of marketplaceProductEssentialFields) {
    consumedProductKeys.add(field.key);
    if (internalProductAttributeKeys.has(field.key)) {
      continue;
    }

    const rawValue = productEssentialValue(product, productAttributes, field.key);
    const value = displayProductDetailValue(field.key, rawValue);
    if (!value) {
      continue;
    }

    const section = essentialGroupSections[field.group];
    addRow(rowsBySection, section.key, {
      key: field.key,
      label: field.label,
      value,
      scope: "PRODUCT",
    });
  }

  const hsnDescription = stringValue(product.hsnMaster?.description);
  if (hsnDescription) {
    addRow(rowsBySection, "COMPLIANCE", {
      key: "hsnDescription",
      label: "HSN description",
      value: hsnDescription,
      scope: "PRODUCT",
    });
  }

  const templateFields = [...(product.category?.productTemplate?.fields ?? [])].sort(
    (first, second) =>
      (first.sortOrder ?? 0) - (second.sortOrder ?? 0) ||
      first.label.localeCompare(second.label),
  );

  for (const field of templateFields) {
    if (internalProductAttributeKeys.has(field.fieldKey)) {
      continue;
    }

    const source = field.scope === "VARIANT" ? variantAttributes : productAttributes;
    const consumedKeys = field.scope === "VARIANT" ? consumedVariantKeys : consumedProductKeys;
    if (consumedKeys.has(field.fieldKey)) {
      continue;
    }
    consumedKeys.add(field.fieldKey);

    const value = displayProductDetailValue(field.fieldKey, source[field.fieldKey]);
    if (!value) {
      continue;
    }

    addRow(rowsBySection, field.scope === "VARIANT" ? "VARIANT" : "SPECIFICATIONS", {
      key: field.fieldKey,
      label: field.label,
      value,
      scope: field.scope,
    });
  }

  if (variant) {
    const variantRows = [
      ["variantName", "Selected option", variant.variantName],
      ["sku", "SKU", variant.sku],
      ["packageWeightGrams", "Packed weight", variant.packageWeightGrams],
      ["packageLengthCm", "Packed length", variant.packageLengthCm],
      ["packageBreadthCm", "Packed breadth", variant.packageBreadthCm],
      ["packageHeightCm", "Packed height", variant.packageHeightCm],
    ] as const;

    for (const [key, label, rawValue] of variantRows) {
      consumedVariantKeys.add(key);
      const value = displayProductDetailValue(key, rawValue);
      if (value) {
        addRow(rowsBySection, "VARIANT", { key, label, value, scope: "VARIANT" });
      }
    }
  }

  addAdditionalRows(rowsBySection, "SPECIFICATIONS", productAttributes, consumedProductKeys, "PRODUCT");
  addAdditionalRows(rowsBySection, "VARIANT", variantAttributes, consumedVariantKeys, "VARIANT");

  return {
    highlights: stringArray(productAttributes.highlights),
    sections: [
      section(rowsBySection, "OVERVIEW", "Product overview"),
      section(rowsBySection, "COMPLIANCE", "Product and tax information"),
      section(rowsBySection, "FULFILMENT", "Delivery, returns and warranty"),
      section(rowsBySection, "IDENTIFIERS", "Product identifiers"),
      section(rowsBySection, "SPECIFICATIONS", "Specifications"),
      section(rowsBySection, "VARIANT", "Selected option details"),
    ].filter((item): item is ProductDetailSection => Boolean(item)),
  };
}

function productEssentialValue(
  product: ProductDetailSource,
  attributes: Record<string, unknown>,
  key: string,
) {
  if (key === "hsnCode") {
    return product.hsnCode ?? attributes.hsnCode;
  }
  if (key === "gstRatePercent") {
    return product.gstRatePercent ?? attributes.gstRatePercent;
  }
  if (key === "packageWidthCm") {
    return attributes.packageWidthCm ?? attributes.packageBreadthCm;
  }
  return attributes[key];
}

function addAdditionalRows(
  rowsBySection: Map<ProductDetailSection["key"], ProductDetailRow[]>,
  sectionKey: ProductDetailSection["key"],
  attributes: Record<string, unknown>,
  consumedKeys: Set<string>,
  scope: ProductDetailRow["scope"],
) {
  for (const key of Object.keys(attributes).sort()) {
    if (consumedKeys.has(key) || internalProductAttributeKeys.has(key)) {
      continue;
    }

    const value = displayProductDetailValue(key, attributes[key]);
    if (value) {
      addRow(rowsBySection, sectionKey, {
        key,
        label: labelFromKey(key),
        value,
        scope,
      });
    }
  }
}

function addRow(
  rowsBySection: Map<ProductDetailSection["key"], ProductDetailRow[]>,
  sectionKey: ProductDetailSection["key"],
  row: ProductDetailRow,
) {
  const rows = rowsBySection.get(sectionKey) ?? [];
  if (!rows.some((item) => item.key === row.key && item.scope === row.scope)) {
    rows.push(row);
    rowsBySection.set(sectionKey, rows);
  }
}

function section(
  rowsBySection: Map<ProductDetailSection["key"], ProductDetailRow[]>,
  key: ProductDetailSection["key"],
  title: string,
) {
  const rows = rowsBySection.get(key);
  return rows?.length ? { key, title, rows } : null;
}

function displayProductDetailValue(key: string, value: unknown) {
  const displayValue = Array.isArray(value)
    ? stringArray(value).join(", ")
    : typeof value === "boolean"
      ? value
        ? "Yes"
        : "No"
      : stringValue(value);

  if (!displayValue) {
    return "";
  }

  if (key === "taxClassification") {
    return {
      TAXABLE: "Taxable",
      NIL_RATED: "Nil-rated",
      EXEMPT: "GST exempt",
      NON_GST: "Non-GST supply",
    }[displayValue] ?? labelFromKey(displayValue);
  }
  if (key === "gstRatePercent") {
    return `${displayValue}%`;
  }
  if (key === "packageWeightGrams") {
    return `${displayValue} g`;
  }
  if (key === "returnWindowDays" || key === "replacementWindowDays") {
    return Number(displayValue) === 0
      ? "Not available"
      : `${displayValue} ${Number(displayValue) === 1 ? "day" : "days"}`;
  }
  if (/^(package|packed).*(Length|Width|Breadth|Height)Cm$/i.test(key)) {
    return `${displayValue} cm`;
  }

  return displayValue;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(stringValue).filter(Boolean);
}

function stringValue(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function labelFromKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
