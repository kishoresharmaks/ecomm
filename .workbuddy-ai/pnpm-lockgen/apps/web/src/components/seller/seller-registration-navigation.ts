import type { SellerCapability } from "@/lib/seller-api";

export type SellerRegistrationMode = SellerCapability | "BOTH";

export function registrationModeFromQuery(
  value?: string | null,
): SellerRegistrationMode {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "service" || normalized === "services") {
    return "SERVICE";
  }
  if (
    normalized === "both" ||
    normalized === "combined" ||
    normalized === "retail-service"
  ) {
    return "BOTH";
  }
  return "RETAIL";
}

export function primaryCapabilityForMode(
  mode: SellerRegistrationMode,
): SellerCapability {
  return mode === "SERVICE" ? "SERVICE" : "RETAIL";
}

export function sellerRegistrationPath(
  initialMode?: string | null,
  initialPlanId?: string | null,
) {
  const params = new URLSearchParams();
  const mode = normalizedRegistrationMode(initialMode);
  const planId = initialPlanId?.trim();

  if (mode) {
    params.set("mode", mode);
  }
  if (planId) {
    params.set("plan", planId);
  }

  const query = params.toString();
  return query ? `/seller/register?${query}` : "/seller/register";
}

function normalizedRegistrationMode(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "service" || normalized === "services") {
    return "service";
  }
  if (normalized === "both" || normalized === "hybrid") {
    return "both";
  }
  if (
    normalized === "retail" ||
    normalized === "product" ||
    normalized === "products"
  ) {
    return "retail";
  }
  return null;
}
