export type MarketplaceProductEssentialInputType = "TEXT" | "TEXTAREA" | "NUMBER" | "SELECT" | "MULTI_TEXT";

export type MarketplaceProductEssentialGroup = "ESSENTIALS" | "COMPLIANCE" | "FULFILMENT" | "DISCOVERY";

export type MarketplaceProductEssentialField = {
  key: string;
  label: string;
  inputType: MarketplaceProductEssentialInputType;
  group: MarketplaceProductEssentialGroup;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: readonly string[];
  displayInCards?: boolean;
  displayInAdmin?: boolean;
  displayInSpecifications?: boolean;
};

export const marketplaceProductEssentialFields = [
  {
    key: "brand",
    label: "Brand / local label",
    inputType: "TEXT",
    group: "ESSENTIALS",
    required: true,
    placeholder: "Aachi, Apple, or Unbranded local",
    helpText: "Use Unbranded local when the item has no registered brand.",
    displayInCards: true,
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "condition",
    label: "Condition",
    inputType: "SELECT",
    group: "ESSENTIALS",
    required: true,
    options: ["New", "Refurbished", "Used"],
    displayInCards: true,
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "unitOfMeasure",
    label: "Unit of sale",
    inputType: "SELECT",
    group: "ESSENTIALS",
    required: true,
    options: ["Piece", "Pack", "Box", "Set", "Pair", "Kg", "Gram", "Litre", "Millilitre", "Meter"],
    displayInCards: true,
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "gstRatePercent",
    label: "GST rate %",
    inputType: "NUMBER",
    group: "COMPLIANCE",
    required: true,
    placeholder: "0, 5, 12, 18, 28",
    helpText: "Needed for GST-ready invoices and marketplace tax review.",
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "hsnCode",
    label: "HSN code",
    inputType: "TEXT",
    group: "COMPLIANCE",
    required: true,
    placeholder: "4 to 8 digit product HSN",
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "returnEligibility",
    label: "Return policy",
    inputType: "SELECT",
    group: "FULFILMENT",
    required: true,
    options: ["Returnable", "Replacement only", "Non-returnable", "Service/warranty only"],
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "packageWeightGrams",
    label: "Package weight grams",
    inputType: "NUMBER",
    group: "FULFILMENT",
    required: true,
    placeholder: "500",
    helpText: "Used for delivery estimates and courier readiness.",
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "highlights",
    label: "Key highlights",
    inputType: "MULTI_TEXT",
    group: "DISCOVERY",
    required: false,
    placeholder: "One highlight per line",
    helpText: "Short buyer-facing points shown on the product detail page.",
    displayInSpecifications: false,
  },
  {
    key: "searchTags",
    label: "Search tags",
    inputType: "MULTI_TEXT",
    group: "DISCOVERY",
    required: false,
    placeholder: "rice, grocery, organic",
    helpText: "Extra search words for local marketplace discovery.",
  },
  {
    key: "countryOfOrigin",
    label: "Country of origin",
    inputType: "TEXT",
    group: "COMPLIANCE",
    required: false,
    placeholder: "India",
    displayInSpecifications: true,
  },
  {
    key: "manufacturerName",
    label: "Manufacturer name",
    inputType: "TEXT",
    group: "COMPLIANCE",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "manufacturerAddress",
    label: "Manufacturer address",
    inputType: "TEXTAREA",
    group: "COMPLIANCE",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "packerName",
    label: "Packer name",
    inputType: "TEXT",
    group: "COMPLIANCE",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "importerName",
    label: "Importer name",
    inputType: "TEXT",
    group: "COMPLIANCE",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "warranty",
    label: "Warranty",
    inputType: "TEXT",
    group: "FULFILMENT",
    required: false,
    placeholder: "1 year brand warranty, 7 day seller support, etc.",
    displayInSpecifications: true,
  },
  {
    key: "packageLengthCm",
    label: "Package length cm",
    inputType: "NUMBER",
    group: "FULFILMENT",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "packageWidthCm",
    label: "Package width cm",
    inputType: "NUMBER",
    group: "FULFILMENT",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "packageHeightCm",
    label: "Package height cm",
    inputType: "NUMBER",
    group: "FULFILMENT",
    required: false,
    displayInSpecifications: true,
  },
  {
    key: "gtin",
    label: "Manufacturer GTIN / barcode",
    inputType: "TEXT",
    group: "DISCOVERY",
    required: false,
    placeholder: "EAN, UPC, ISBN, or printed pack barcode",
    helpText: "Optional product-level barcode printed by the manufacturer. Per-piece generated inventory labels are handled separately from bulk product creation.",
    displayInAdmin: true,
    displayInSpecifications: true,
  },
  {
    key: "seoTitle",
    label: "SEO title",
    inputType: "TEXT",
    group: "DISCOVERY",
    required: false,
    placeholder: "Short search-friendly title",
  },
  {
    key: "seoDescription",
    label: "SEO description",
    inputType: "TEXTAREA",
    group: "DISCOVERY",
    required: false,
    placeholder: "Short search result description",
  },
] as const satisfies readonly MarketplaceProductEssentialField[];

export type MarketplaceProductEssentialKey = (typeof marketplaceProductEssentialFields)[number]["key"];

export const marketplaceProductRequiredEssentialFields = marketplaceProductEssentialFields.filter(
  (field) => field.required,
);

export const marketplaceProductCardFields = marketplaceProductEssentialFields.filter(
  (field) => "displayInCards" in field && field.displayInCards === true,
);

export const marketplaceProductAdminSummaryFields = marketplaceProductEssentialFields.filter(
  (field) => "displayInAdmin" in field && field.displayInAdmin === true,
);

export const marketplaceProductSpecificationFields = marketplaceProductEssentialFields.filter(
  (field) => "displayInSpecifications" in field && field.displayInSpecifications === true,
);
