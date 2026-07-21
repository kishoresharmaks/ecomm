export const productReturnEligibilityOptions = [
  "Return and replacement",
  "Return only",
  "Replacement only",
  "Non-returnable",
  "Service/warranty only",
] as const;

export type ProductReturnEligibility = (typeof productReturnEligibilityOptions)[number];

export const productReturnReasons = [
  "Damaged on arrival",
  "Wrong item received",
  "Missing parts or accessories",
  "Product differs from description",
  "Size or fit issue",
  "Defective or not working",
  "Quality not as expected",
  "Changed mind",
] as const;

export type ProductReturnReason = (typeof productReturnReasons)[number];

export type ProductReturnPolicy = {
  returnAllowed: boolean;
  replacementAllowed: boolean;
  returnWindowDays: number;
  replacementWindowDays: number;
  returnReasons: ProductReturnReason[];
};

export function normalizeProductReturnPolicy(
  attributes: unknown,
  fallbackWindowDays = 7,
): ProductReturnPolicy {
  const record =
    attributes && typeof attributes === "object" && !Array.isArray(attributes)
      ? (attributes as Record<string, unknown>)
      : {};
  const eligibility = normalizedEligibility(record.returnEligibility ?? record.returnPolicy);
  const returnAllowed =
    eligibility === "Return and replacement" ||
    eligibility === "Return only" ||
    eligibility === "Returnable";
  const replacementAllowed =
    eligibility === "Return and replacement" ||
    eligibility === "Replacement only" ||
    eligibility === "Returnable";

  return {
    returnAllowed,
    replacementAllowed,
    returnWindowDays: returnAllowed
      ? normalizedWindowDays(record.returnWindowDays, fallbackWindowDays)
      : 0,
    replacementWindowDays: replacementAllowed
      ? normalizedWindowDays(record.replacementWindowDays, fallbackWindowDays)
      : 0,
    returnReasons: normalizedReasons(record.returnReasons),
  };
}

export function productPolicyAllowsResolution(
  policy: ProductReturnPolicy,
  resolution: "REFUND" | "REPLACEMENT",
) {
  return resolution === "REPLACEMENT" ? policy.replacementAllowed : policy.returnAllowed;
}

function normalizedEligibility(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Returnable";
}

function normalizedWindowDays(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : fallback;
  return Math.min(365, Math.max(0, Math.round(Number.isFinite(parsed) ? parsed : fallback)));
}

function normalizedReasons(value: unknown): ProductReturnReason[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];
  const allowed = new Set<string>(productReturnReasons);
  const normalized = values
    .map((reason) => (typeof reason === "string" ? reason.trim() : ""))
    .filter((reason): reason is ProductReturnReason => allowed.has(reason));

  return normalized.length
    ? [...new Set(normalized)]
    : [...productReturnReasons];
}
