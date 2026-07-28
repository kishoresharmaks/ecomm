export type IndiaPostalLookupMode = "pincode" | "postOffice";

export const indiaLocationImportGuideCards = [
  {
    title: "Official bulk import",
    source: "Department of Posts / data.gov.in",
    command: '$env:DATAGOVINDIA_API_KEY="your-data-gov-in-api-key"\npnpm locations:import:india -- --dry-run\npnpm locations:import:india',
    description:
      "Preview first, then load India states, district city nodes, post-office local areas, pincodes, and postal metadata through the staging-table bulk importer."
  },
  {
    title: "CSV fallback",
    source: "Approved Department of Posts CSV",
    command:
      'pnpm locations:import:india -- --file data/location-imports/all_india_pin_code.csv --source-url "https://data.gov.in/sites/default/files/all_india_pin_code.csv"',
    description: "Use this when the data.gov.in API key is unavailable or the API is rate-limited; it uses the same bulk staging path."
  },
  {
    title: "PostalPin verification",
    source: "api.postalpincode.in",
    command: "GET /api/admin/locations/india-postal-lookup?pincode=110001",
    description: "Checks a single pincode or post-office name without writing to the location tables."
  }
] as const;

export function validateIndiaPostalLookupForm(mode: IndiaPostalLookupMode, value: string) {
  const normalized = normalizeIndiaPostalLookupValue(value);

  if (!normalized) {
    return mode === "pincode" ? "Enter a 6-digit India pincode." : "Enter a post office name.";
  }

  if (mode === "pincode" && !/^[1-9][0-9]{5}$/.test(normalized)) {
    return "Enter a valid 6-digit India pincode.";
  }

  if (mode === "postOffice" && normalized.length < 2) {
    return "Post office search must contain at least 2 characters.";
  }

  return "";
}

export function buildIndiaPostalLookupPath(mode: IndiaPostalLookupMode, value: string) {
  const normalized = normalizeIndiaPostalLookupValue(value);
  const query = new URLSearchParams();
  query.set(mode === "pincode" ? "pincode" : "postOffice", normalized);
  return `/api/admin/locations/india-postal-lookup?${query.toString()}`;
}

export function normalizeIndiaPostalLookupValue(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
